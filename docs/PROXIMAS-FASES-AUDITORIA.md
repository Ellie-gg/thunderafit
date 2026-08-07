# Próximas fases — achados da auditoria 2026-08-06 ainda abertos

A Fase 118 corrigiu tudo que dava pra agrupar com segurança num lote só: os achados com
**correção clara, sem decisão de produto pendente e sem migration**. Os 8 abaixo ficaram
de fora **de propósito** — cada um precisa de uma decisão, de uma migration, ou de
trabalho de infraestrutura que não cabe num lote de correções pontuais.

Ordem sugerida: **A4 → M4 → B10 → B9 → B6 → B7 → B11 → M6**. A4 primeiro porque é o
único que ainda grava dado errado em produção; M4 em seguida porque envolve PII.

Laudo completo de cada item em [`AUDITORIA-2026-08-06.md`](AUDITORIA-2026-08-06.md).

---

## Fase A — A4: idempotência do `POST /api/workouts/:id/complete` (risco ALTO)

**O que está errado.** Cada chamada cria uma linha nova em `WorkoutSessionLog`, sem guard
de reentrega e sem unique constraint (`src/fitness/services/workouts.service.ts`). Numa
2ª chamada, `previousLastCompletedAt` já é o instante da 1ª conclusão, então a janela do
resumo exclui todas as séries reais e grava uma sessão fantasma com `volumeKg: 0` /
`setsCompleted: 0` — que entra nos gráficos de `/evolucao`. Alcançável por 2 abas no
mesmo treino, ou por retry após resposta perdida (a sessão é preservada de propósito em
erro de rede, fix do `Fr1`/`Fr4`).

**Por que não entrou na Fase 118.** Exige escolher a semântica de idempotência, e a
escolha errada quebra conclusão legítima. As opções não são equivalentes:

| Opção | Prós | Contras |
|---|---|---|
| Janela de dedupe (ignorar se já existe log deste `workoutId` nos últimos N s) | Sem migration; pega os 2 caminhos reais | `N` é arbitrário; 2 sessões legítimas muito próximas seriam fundidas |
| Não gravar log quando `setsLogged === 0` | Mata exatamente a assinatura do fantasma | Descarta também a conclusão legítima sem séries (que ainda tem duração útil) |
| Chave de idempotência enviada pelo cliente | Correto de verdade, resistente a retry | Migration + mudança de contrato + mudança no cliente |

**Recomendação**: janela de dedupe como correção imediata (sem migration), e a chave de
idempotência como evolução se o caminho de retry crescer em importância. Em qualquer
caso: **teste cobrindo duas chamadas seguidas de `/complete`** — hoje não existe, e é a
ausência dele que deixou isso passar. Corrigir também o comentário já marcado com ⚠️ no
próprio `completeWorkout`.

## Fase B — M4: `ClientInvite` fora do cascade de deleção (risco MÉDIO, envolve PII)

**O que está errado.** `src/lib/user-deletion.ts` apaga 16 tabelas e **não** inclui
`clientInvite`. O modelo não tem FK (`personalId` é `String` puro), então a deleção não
falha — as linhas sobrevivem. Isso viola a regra escrita em `src/admin/AGENTS.md`
("qualquer tabela nova com coluna estilo `userId` precisa ser adicionada a este cascade à
mão"), quebrada pela própria Fase 104 que criou a tabela.

Verificado: um convite órfão **não** cria vínculo corrompido (`assertUnderAlunoLimit`
valida `if (!user) throw` e o `unconsume` do fix do `F2` restaura o convite). O problema
real é (a) linhas órfãs acumulando sem limpeza, e (b) **PII sobrevivendo à exclusão de
conta** — `label` é texto livre escrito pelo Personal, tipicamente o nome do convidado, e
`consumedByAlunoId` permanece.

**Por que não entrou na Fase 118.** Duas decisões em aberto: adicionar só ao cascade em
código, ou também criar a FK com `onDelete: Cascade` (migration, e aí decidir o que fazer
com as linhas órfãs já existentes)? E há um backfill a considerar — convites órfãos que
já existam hoje no banco. Adicionar FK é a correção estrutural; só o cascade em código
repete o padrão que já falhou uma vez.

## Fase C — B10: fixtures de teste poluindo o catálogo do aluno (risco BAIXO)

31 specs E2E e o `src/admin/__tests__/admin-self-templates.test.ts` criam templates SELF
e **nunca limpam** — zero `afterAll`/`afterEach`. O banco local acumulou 124 desses.

O filtro adicionado na Fase 118 (`workouts: { some: {} }` em `listSelfTemplates`) já
**esconde** todos eles do aluno, porque nascem sem sessão — então o sintoma visível está
resolvido. O que falta é a causa: testes que não limpam o que criam. Precisa de trabalho
de infraestrutura de teste (helper de cleanup compartilhado, ou prefixo/namespace de
fixture que um teardown global remova), não de uma correção pontual.

## Fase D — B9: criação de treino pessoal em 2 chamadas encadeadas (risco BAIXO)

`frontend/app/meu-treino-pessoal/criar/page.tsx` chama `createSelfWorkoutProgram` e
depois `addSelfProgramSession`. Se a 2ª falhar (rede), o programa fica criado sem
sessão: o retry vira `409 SELF_PROGRAM_EXISTS` perguntando se o aluno quer substituir o
programa que ele mesmo acabou de criar sem perceber.

**Por que não entrou.** A correção certa é atomicidade no backend (um endpoint que cria
programa + 1ª sessão numa transação), não remendo no cliente — é mudança de contrato de
API. Nota: o filtro da Fase 118 faz o programa órfão desaparecer do catálogo, mas ele
continua contando como "treino pessoal ativo" do aluno, então o 409 permanece.

## Fase E — B6: `startedAt` derivado, errado no auto-encerramento (risco BAIXO, latente)

`workouts.service.ts` grava `startedAt` como `completedAt − durationSeconds`, mas o
schema afirma que é "quando o aluno clicou Iniciar Treino". No auto-encerramento por
inatividade a duração é `lastActivityAt − startedAt` enquanto `completedAt` é o instante
do encerramento (até 45 min depois), então grava um `startedAt` adiantado e **posterior à
última atividade real**.

Hoje nenhuma query lê a coluna — é corrupção latente. Corrigir bem exige o cliente
**enviar** o `startedAt` real (mudança de contrato + cliente + teste), e decidir o que
fazer com as linhas já gravadas. Enquanto isso, não construa nada que leia `startedAt`
(ex: "hora do dia em que o aluno treina").

## Fase F — B7: `dayKey` em UTC rotula sessão noturna no dia seguinte (risco BAIXO)

`progress.service.ts` agrupa por dia em UTC. Uma conclusão às 21:30 BRT vira 00:30 UTC do
dia seguinte e aparece rotulada como o dia seguinte nos 2 gráficos de tendência.
`src/progress/AGENTS.md` documenta o UTC como deliberado, mas só analisou os efeitos em
streak/`load-history`/array semanal — o endpoint da Fase 112 herdou o comportamento sem
análise, e nele é mais visível porque cada ponto carrega uma data explícita na tela.

**Por que não entrou.** É decisão de produto com alcance amplo: passar a agrupar pelo
fuso do usuário afeta streak, frequência mensal e histórico de carga **de uma vez**, e
provavelmente exige guardar o fuso do usuário. Mudar só o endpoint novo criaria
inconsistência entre telas — pior que o problema atual.

## Fase G — B11: `LoginLog` sem retenção (risco BAIXO)

Cresce sem limite (~250 bytes/linha; 16 mil linhas só no ambiente de dev). Não é bug — a
leitura é limitada por `take` e `user-deletion.ts` apaga na exclusão de conta. É vetor de
custo, e o principal contra o teto de 0,5 GB do Neon Free.

Precisa de uma decisão de produto/compliance (**quanto tempo** guardar log de acesso?) e
de um mecanismo de expurgo — e este projeto **não tem nenhuma infraestrutura de cron**
por design. Amarrar isso à migração de banco planejada em
[`MIGRACAO-BANCO-GCP-2026-08-06.md`](MIGRACAO-BANCO-GCP-2026-08-06.md) faz sentido: numa
VM existe cron de verdade, e o teto de 0,5 GB deixa de existir.

## Fase H — M6 (resto): o Terraform não cria o que o README agora manda preencher

A Fase 118 corrigiu o `infra/README.md` (6 secrets em vez de 3, e a exigência de WSL pro
`gcloud`). Fica em aberto a parte de infraestrutura de verdade: avaliar se
`infra/secrets.tf` deveria falhar explicitamente — ou ao menos avisar — quando um secret
existe sem nenhuma versão, em vez de deixar o Cloud Run subir com valor vazio e quebrar
e-mail transacional e billing em silêncio. É mudança em Terraform com risco de bloquear
deploy legítimo, então merece rodada própria.

---

## Não confirmado (não vale fase até reproduzir)

`frontend/components/session-trend-chart.tsx` — o `t("noAnswer")` no formatter do tooltip
parece código morto (recharts normalmente omite pontos `null` do payload). Não
reproduzido em runtime; sem impacto se confirmado. Verificar antes de investir nisso.
