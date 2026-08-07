# Migração do Postgres de produção: Neon (AWS) → VM e2-micro no GCP (Always Free)

> **Status: plano aprovado pelo fundador, execução ainda não iniciada** (2026-08-06).
> Este documento é o plano de referência para a migração — atualizar conforme cada
> fase for executada, ou substituir pela entrada correspondente em `STATUS.md` quando
> concluído.

## Context

Hoje o Postgres de produção é **Neon, em AWS `us-east-1`**, enquanto o app roda em
**Cloud Run `us-central1`** — ou seja, toda query cruza dois provedores. A motivação
original (registrada em `infra/RUNBOOK.md`, avaliação de 2026-07-30) foi consumo alto de
compute-hours no Neon; a Fase 102 mitigou o driver principal (poll do sino de 30s → 6h),
mas a avaliação ficou explicitamente **sem decisão**. Esta fase executa a decisão.

Três problemas reais do arranjo atual, todos verificados nesta sessão:

1. **Teto que derruba produção.** O plano Free do Neon suspende o compute ao passar de
   100 CU-hours/mês e suspende o projeto ao passar de 0.5 GB de storage. O modo de falha
   não é "fica mais lento", é **produção fora do ar**. Numa VM esse penhasco não existe.
2. **Latência e egress cross-cloud.** Cada requisição paga RTT entre GCP e AWS, e o
   egress do Cloud Run pra internet custa $0.12/GiB depois de 1 GiB/mês (a AWS ainda
   cobra a volta). Na mesma região do GCP isso vira ~$0.
3. **Cold start duplo** (já documentado no RUNBOOK): Cloud Run subindo instância **e**
   Neon acordando do autosuspend de 5 min — que no plano Free **não é editável**.

Resultado pretendido: Postgres em `us-central1`, na mesma VPC do Cloud Run, custo
mensal ~$0, sem tetos que suspendam produção, e com backup testado antes de desativar
o Neon.

### Custos verificados (us-central1, 2026-08-06)

| Item | Custo/mês |
|---|---|
| `e2-micro` (Always Free, 730h — 1 VM/conta de faturamento) | **$0** |
| 30 GB **standard** PD (`pd-standard`, não balanced/SSD) | **$0** |
| **Direct VPC egress** (GA, recomendado pelo Google, sem cobrança de VM) | **$0** |
| Tráfego privado Cloud Run → VM | $0–0.01/GiB → **≤ $0.10** |
| Backup em GCS (Always Free 5 GB; banco tem ~20 MB) | **$0** |
| **Total** | **≈ $0** |

Duas armadilhas que **evitamos de propósito**, ambas confirmadas na documentação:

- **IP externo na VM = $3.65/mês** (não está incluído no Always Free). Evitado usando
  **IAP TCP forwarding** pra SSH, sem IP público.
- **Serverless VPC Access connector = ~$11–12/mês** (cobra 2 instâncias 24/7, mínimo
  não-zerável, e *ignora spend caps*). Estouraria sozinho o alerta de orçamento de $10.
  Por isso usamos **Direct VPC egress**, não connector.

Alternativas descartadas: **Neon Launch** (~$3/mês, zero ops — perde a correção de
latência/egress e mantém dependência cross-cloud); **Cloud SQL `db-f1-micro`** (~$9.50,
bate no alerta de $10 e é documentado pelo Google como *"dev/test only, não coberto pelo
SLA"*); **AlloyDB** (~$117+).

### Decisões tomadas com o fundador nesta sessão

- **Backup = `pg_dump` agendado → GCS.** Replicação lógica pro Neon foi **rejeitada**:
  o Neon não pode ser standby físico (storage próprio, sem WAL shipping), então só
  restaria replicação lógica — que **não replica DDL**. Com 45 migrations já no repo e
  cadência alta, cada `migrate deploy` quebraria a replicação em silêncio.
- **Sem split de leitura pra um segundo banco.** A ~0,004 req/s (340 req/dia, 83% GET),
  uma réplica serviria ~0,003 req/s, e uma leitura cross-cloud seria **mais lenta** que
  a local. Não se justifica.
- **Cutover com janela de manutenção curta** (~15–30 min), não zero-downtime.

## Restrições técnicas que moldam o plano

- **`e2-micro` é menor do que parece**: 2 vCPU *mas* **0.25 vCPU sustentado** (25% de um
  core), **1 GB RAM**, burst limitado a **~30s**, e um **virtio memory balloon** (o
  hypervisor pode reclamar memória do guest — hostil ao buffer pool do Postgres).
- **Conexões são o gargalo real.** `maxScale=20` × pool default do Prisma (3) = até **60
  conexões**. Hoje o Neon absorve isso com o endpoint *pooled* (PgBouncer). Numa VM de
  1 GB, 60 backends é inviável.
- **Direct VPC egress tem dois requisitos duros**: a sub-rede precisa ser **`/26` ou
  maior**, e a doc avisa que pode haver **"connection establishment delays of a minute or
  more on instance startup"** — risco relevante justamente porque este app é
  cold-start-dominado (`minScale=0` + tráfego esparso). O Google recomenda um **startup
  probe HTTP que teste a conexão de egress**; o `/health` atual (`src/app.ts:102`) **não
  toca o banco**, então precisa de um endpoint novo.
- **Sem IP externo, `apt` não alcança a internet.** Repos do PGDG não são espelhados
  pelo Private Google Access. Provisionamento e patching usam **IP efêmero anexado
  temporariamente** e removido depois (centavos), não Cloud NAT (~$4.67/mês).
- **Propriedade de segurança que não pode ser perdida**: hoje o Neon está *fora* do
  Terraform de propósito, pra que `terraform destroy` nunca derrube o banco de produção
  (`infra/README.md`). Trazendo o banco pra dentro do Terraform, isso vira
  `prevent_destroy` explícito.

## Implementação

### Fase 0 — Pré-flight (bloqueante, antes de mexer em infra)

1. **Versão do Postgres do Neon**: `SELECT version();` — a VM precisa ter major **igual
   ou maior**, senão o restore falha. (Não foi medido durante o planejamento: a conexão
   ao banco de produção foi bloqueada pelo classificador de permissão da sessão.
   Precisa ser rodado manualmente, ou com a permissão liberada.)
2. **Tamanho real e uso atual do Neon**: `pg_database_size`, mais CU-hours e storage no
   console do Neon. Confirma que 30 GB de PD e o dump cabem folgados (local hoje: 20 MB).
3. **Baseline de latência**: p50/p95 de uma rota que bate no banco, pra comparar depois.
   Sem isso não há como afirmar que a migração melhorou algo.
4. `pg_dump` disponível: **18.4** no Windows (scoop) — serve pra dumpar qualquer server
   mais antigo. Usar esse, não o 16.14 do WSL.

### Fase 1 — Rede + VM via Terraform (sem dados ainda)

- `infra/apis.tf` — adicionar `compute.googleapis.com` e `iap.googleapis.com` à lista
  `required_apis`.
- **`infra/network.tf`** (novo) — VPC dedicada + duas sub-redes em `us-central1`:
  uma pra VM, e uma **`/26`** exclusiva pro Direct VPC egress (requisito da doc; o
  Cloud Run consome ~2× IPs por instância, em blocos de `/28`).
- **`infra/database_vm.tf`** (novo) — `google_compute_instance` `e2-micro`,
  `pd-standard` (≤30 GB), **sem `access_config`** (nenhum IP externo), com
  `lifecycle { prevent_destroy = true }` no disco e na VM.
- **Firewall** (em `network.tf`): ingress `5432` **apenas** do range da sub-rede do
  Cloud Run (a doc diz explicitamente *"don't create policies based on individual IPs…
  use the IP address range of the entire subnet"*); e ingress `22` de
  **`35.235.240.0/20`** (IAP TCP forwarding). Nada aberto pra `0.0.0.0/0`.
  - *Nota*: usar network tag do Cloud Run como **source** de regra de ingress é ambíguo
    na doc — validar com um Connectivity Test; o fallback documentado (range da
    sub-rede) é o que vai no plano.
- `infra/iam.tf` — service account própria da VM com `roles/storage.objectCreator`
  **só** no bucket de backup, e `roles/iap.tunnelResourceAccessor` pro seu usuário.
- `infra/storage.tf` — bucket `thunderafit-db-backups`, uniform access, **lifecycle rule
  de retenção** (ex: 30 dias) pra não crescer sem limite.

### Fase 2 — Postgres na VM (script de provisionamento, idempotente)

Anexar IP efêmero → provisionar → remover o IP.

- Instalar Postgres na major confirmada na Fase 0.
- **Tuning pra 1 GB** (a doc oficial do Postgres diz que a regra dos 25% *não* se aplica
  abaixo de 1 GB): `shared_buffers≈128MB`, `work_mem` pequeno (~4MB),
  `effective_cache_size` conservador, `max_connections≈45`, `huge_pages=off`.
  Mais **swap de ~2 GB** — mitigação contra o memory balloon.
  *Flag honesto*: os números exatos de `max_connections`/swap são prática de comunidade,
  não doc oficial; tratar como ponto de partida a medir, não verdade.
- **TLS obrigatório** (`ssl=on`) mesmo em IP interno; role da aplicação sem superuser.
- **Backup**: cron diário `pg_dump -Fc | gzip` → `gs://thunderafit-db-backups/…`.
- Deixar **PgBouncer documentado como escalada**, não instalar já: o controle inicial de
  conexões é mais barato (ver Fase 3).

### Fase 3 — Ligar o Cloud Run à VM

- `infra/cloud_run.tf` — adicionar `vpc_access { network_interfaces {…} egress =
  "PRIVATE_RANGES_ONLY" }` no template do backend. O `lifecycle.ignore_changes` atual
  cobre só `image` e `scaling`, então **o Terraform gerencia `vpc_access` sem conflito**;
  e o Cloud Build faz `services update --image=…` (update parcial), então não remove.
- **`src/app.ts`** — novo endpoint de readiness (ex: `/health/db`) que faz um
  `SELECT 1` via Prisma, para usar como **startup probe**. Mitiga o atraso de conexão do
  Direct VPC egress fazendo o Cloud Run só rotear tráfego quando a rede realmente está
  pronta. O `/health` existente segue como liveness puro.
- **Controle de conexões sem código novo**: acrescentar `?connection_limit=2&pool_timeout=…`
  ao valor do secret `database-url`. O Prisma lê pool config da própria connection
  string, então isso não exige mudança em `src/lib/prisma.ts`. Pior caso passa de 60
  para ~40 conexões, dentro do `max_connections=45`.

### Fase 4 — Cutover (janela de manutenção)

1. **Ensaio completo primeiro**, em banco descartável na VM: `pg_dump` do Neon → restore
   → conferir contagem de linhas **tabela por tabela** (27 tabelas) e
   `prisma migrate status`. Nada de cutover sem ensaio.
2. Janela: `pg_dump -Fc` final do Neon → restore na VM → comparar contagens de novo.
3. Nova versão do secret: `gcloud secrets versions add database-url` com a connection
   string interna (+ `connection_limit`). O secret já é lido como `latest`
   (`infra/cloud_run.tf`), então **nenhuma mudança de código é necessária**.
4. Forçar revisão nova do Cloud Run (o `latest` só é resolvido no start da instância).
5. **Não deletar o Neon.** Ele é o caminho de rollback durante a janela de validação.

### Fase 5 — Validação e backup provado

- Paridade de contagem em todas as 27 tabelas; smoke test das rotas principais
  (login, listar programas, executar treino, dashboard, admin).
- Comparar latência com o baseline da Fase 0.
- **Restaurar um backup do GCS num banco descartável.** Backup não testado não é backup —
  este é o passo que fecha o risco de "VM única sem HA", e é pré-requisito pra
  desativar o Neon.
- Observar por alguns dias com atenção a memória (balloon) e contagem de conexões.

### Fase 6 — Documentação (não opcional aqui)

- `infra/RUNBOOK.md` — a seção atual diz *"avaliação, sem ação"*: reescrever com o que
  foi decidido e executado, e adicionar procedimentos novos: patching mensal com IP
  efêmero, restore, e o que fazer se a VM morrer.
- `infra/README.md` — a decisão *"Neon não é gerenciado por Terraform… destroy nunca
  derruba o banco"* deixou de valer: documentar que a proteção agora é `prevent_destroy`,
  **e que por isso `terraform destroy` vai falhar de propósito** até alguém remover o
  bloqueio conscientemente.
- `STATUS.md` — entrada da fase, no padrão das anteriores.

## Riscos que assumimos (explicitamente)

| Risco | Mitigação | Resíduo |
|---|---|---|
| Atraso de conexão do Direct VPC egress no cold start ("a minute or more") | Startup probe em `/health/db` | **Real e precisa ser medido.** Se a primeira requisição piorar de forma perceptível, as saídas são `minScale=1` (sai do free tier) ou voltar pro Neon |
| VM única, sem HA | Backup diário em GCS + restore testado | Um desastre = downtime até restaurar (na ordem de dezenas de minutos, não segundos) |
| 1 GB RAM + 25% CPU + memory balloon | Tuning conservador, swap, `connection_limit` | Teto real; se a carga crescer, sair do Always Free ou voltar pra algo gerenciado |
| Patching de SO agora é seu | Janela mensal com IP efêmero | Trabalho recorrente que hoje é da Neon |
| `terraform destroy` deixa de ser limpo | `prevent_destroy` proposital | Falha ruidosa (é o comportamento desejado) |

## Verificação

- `terraform plan` sem diffs inesperados; `terraform apply` por fase, não tudo de uma vez.
- **Connectivity Test** do Cloud Run até a VM na porta 5432 antes de tocar em dados.
- Contagem de linhas idêntica nas 27 tabelas, pré e pós-cutover.
- `npx prisma migrate status` limpo contra a VM (as 45 migrations reconhecidas, nenhuma
  pendente) — as migrations continuam rodando sozinhas no boot
  (`docker/start-backend.sh`), sem mudança.
- Backend: `npm test` e `npx tsc --noEmit` (o endpoint novo em `src/app.ts` precisa de
  teste, no padrão de `src/**/__tests__/`). Os testes continuam usando o Postgres local
  do Docker — **nada aqui muda o ambiente de dev/CI**.
- Restore de backup do GCS concluído com sucesso num banco descartável.
- Confirmar no faturamento, depois de ~1 semana, que não apareceu SKU de IP externo nem
  de VPC connector.

## Rollback

Nova versão do secret `database-url` apontando de volta pro Neon (string *pooled*) +
revisão nova. O Neon permanece intacto durante toda a validação. **Perde-se o que foi
escrito na VM depois do cutover** — a ~1.700 writes/mês é um risco pequeno, mas real e
precisa ser aceito conscientemente antes da janela.
