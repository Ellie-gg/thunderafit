# Runbook — Operação do ThunderaFit em produção

## Rollback

Cloud Run guarda todas as revisions já implantadas — reverter é instantâneo,
sem rebuild:

```bash
gcloud run revisions list --service=thunderafit-backend --region=us-central1
gcloud run services update-traffic thunderafit-backend \
  --region=us-central1 --to-revisions=<REVISION_ANTERIOR>=100
```

Mesmo comando para `thunderafit-frontend`, trocando o nome do serviço.

**Isso NÃO desfaz uma migration do Prisma.** Se o deploy problemático
incluiu uma migration, o rollback de tráfego sozinho pode deixar código
antigo apontando pra um schema novo incompatível. Por isso as migrations
deste projeto devem ser aditivas/compatíveis-pra-trás por convenção
(expand-then-contract) — nunca um `DROP COLUMN`/`RENAME` na mesma migration
que o deploy que o introduz, sempre em 2 passos separados com um deploy
inteiro no meio.

## Rotacionar um secret (JWT ou DATABASE_URL)

```bash
openssl rand -base64 48 | gcloud secrets versions add jwt-secret --data-file=-
```

Cloud Run está configurado para sempre ler a versão `latest` do secret
(ver `secrets.tf`/`cloud_run.tf`) — não precisa de `terraform apply` pra
rotacionar, só de uma nova revision (redeploy manual ou o próximo push).

**Rotacionar `jwt-secret`/`jwt-refresh-secret` derruba todas as sessões
ativas na hora** — não há período de graça com chave dupla. Aceitável pra
esse tamanho de produto, mas avise os usuários se for uma rotação
planejada, não só uma resposta a incidente.

## Por que o backend não é público

Decisão da fase de deploy: o app guarda dado de saúde (anamnese) — uma URL
de backend aberta seria uma porta de entrada direta pro Postgres/Neon pra
qualquer um que a descobrisse. Só o service account do frontend tem
`roles/run.invoker` no backend (`iam.tf`). Isso significa:

- **Nunca** chame o backend direto do navegador — sempre pelo proxy em
  `frontend/app/api/[...path]/route.ts`.
- Debugar o backend manualmente (curl, Postman) a partir de fora do Cloud
  Run exige se autenticar como o próprio service account do frontend:

  ```bash
  gcloud auth print-identity-token \
    --impersonate-service-account=$(terraform output -raw frontend_service_account) \
    --audiences=$(terraform output -raw backend_url)
  # cole o token retornado como header: Authorization: Bearer <token>
  ```

## Neon: connection string pooled, não a direta

`DATABASE_URL` em produção **precisa** ser a connection string em modo
pooled (PgBouncer) do Neon, não a direta — o Cloud Run escala de zero em
rajadas, e a conexão direta do Neon tem um teto de conexões simultâneas
baixo o bastante pra estourar rápido nesse padrão de tráfego.

## Cold start duplo (Cloud Run + Neon)

Depois de um período ocioso, os dois lados podem estar "frios" ao mesmo
tempo: o Cloud Run precisa subir uma instância nova E o endpoint do Neon
precisa acordar do auto-suspend. A primeira requisição depois de um tempo
parado pode demorar bem mais que o normal — não é bug, é o trade-off de
manter tudo no free tier (nenhum dos dois serviços está com instância
mínima > 0).

## Alternativas de hospedagem do banco (avaliação, sem ação — 2026-07-30)

Motivado por compute-hours alto no Neon (ver Fase 102 no STATUS.md — poll do sino de
notificação reduzido de 30s pra 6h). O plano **Free** do Neon tem o autosuspend delay
**fixo em 5 minutos, não editável pela UI** (confirmado pelo fundador ao tentar mudar —
o que existe pra editar no console é só o range de CU do autoscaling, um eixo diferente
de custo, não o tempo de inatividade). Avaliação de alternativas pra ter opções
documentadas antes de crescer pra ~100 usuários, **nenhuma decisão tomada, nenhuma
ação executada** — só análise.

### Opção A — Postgres self-hosted numa VM e2-micro do GCP (Always Free)

O GCP tem 1 instância `e2-micro` **permanentemente grátis** (Always Free, não um trial
de tempo limitado) por conta de faturamento, restrita às regiões `us-west1`,
`us-central1` ou `us-east1` — e o projeto já roda em **`us-central1`**
(`infra/variables.tf`), então uma VM assim ficaria na MESMA região do Cloud Run, o que
tende a reduzir latência (mesmo datacenter/rede interna) e evitar custo de egress
entre provedores. A franquia inclui 30GB de disco padrão por mês, suficiente pra rodar
o Postgres do tamanho atual do banco.

Como não é um serviço serverless com autosuspend, **o conceito de "compute-hours" nem
existe aqui** — é uma VM ligada o tempo todo, sem cobrança adicional enquanto ficar
dentro da franquia Always Free (1 instância, região elegível, disco dentro do limite).
Isso elimina o problema de raiz (nada resetando um timer de suspensão), ao custo de
trocar "gerenciar autosuspend" por "gerenciar a VM":

- **Sem HA/backup automático** — teria que configurar backup próprio (`pg_dump`
  agendado, snapshot de disco), diferente do que Neon/Cloud SQL já dão de fábrica.
- **Manutenção própria**: patch de SO, atualização do Postgres, firewall, TLS,
  hardening de acesso (hoje isso tudo é responsabilidade da Neon).
- **Teto de performance real**: `e2-micro` é uma VM pequena (2 vCPU compartilhada/
  "burstable" via créditos de CPU, ~1GB RAM) — provavelmente OK pro volume de dados já
  mapeado nesta sessão (poucas dezenas de linhas por Personal, `limiteAlunos` 3/20 nos
  planos Free/Base), mas é um teto real que não escala sozinho como o autoscaling do
  Neon — se a carga real crescer bastante, precisaria trocar de tamanho de VM (que aí
  sai do Always Free) ou migrar pra algo gerenciado de novo.
- **Migração**: exportar o banco atual do Neon (`pg_dump`) e restaurar na VM nova,
  trocar o secret `DATABASE_URL`, validar todas as rotas — trabalho de migração real,
  não é só trocar uma flag.

### Opção B — Cloud SQL for PostgreSQL

**Não tem tier Always Free** — só um trial de 30 dias (instância Enterprise Plus 8
vCPU/64GB, bem maior do que o necessário) ou os $300 de crédito de conta nova do GCP.
Depois disso, cobra desde o primeiro minuto pelo tamanho da instância — sem o modelo
"paga só quando ativo" do Neon. Pode fazer sentido mais adiante (backup/HA gerenciados,
sem manutenção de VM), mas não resolve o problema de custo atual — troca um modelo de
cobrança por outro, sem eliminar gasto.

### Opção C — Continuar no Neon, mas no plano pago

Planos pagos da Neon permitem configurar o autosuspend delay livremente (inclusive
bem mais curto que 5 min) — resolveria o problema de raiz sem trocar de provedor nem
assumir manutenção de VM, ao custo de uma assinatura mensal. Vale comparar o preço do
plano de entrada da Neon contra o tempo de manutenção real da Opção A antes de decidir.

### Recomendação preliminar (não decidido)

Pra HOJE (bem baixo uso, ~1 pessoa testando), a correção do poll (Fase 102) já deve
resolver a maior parte do problema sem nenhuma mudança de infra. Se o compute-hours
continuar alto mesmo depois disso, a Opção A (VM `e2-micro`) é a que elimina o problema
por completo sem custo mensal novo, mas exige aceitar manutenção própria — decisão a
retomar com o fundador se/quando o Neon voltar a ser um problema real, não antes.

## `terraform destroy`

Derruba Cloud Run, Artifact Registry, Cloud Build triggers/connection,
service accounts, IAM bindings e os *containers* dos secrets (sem os
valores, que nunca estiveram no state). **Não toca no Neon** — o banco de
produção sobrevive a um `destroy` acidental por design.
