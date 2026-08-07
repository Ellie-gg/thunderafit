# Auditoria — 2026-08-06

> **Situação (atualizado na Fase 119):** **todos os achados de risco ALTO e MÉDIO estão
> fechados.**
>
> - **Fase 118**: A1, A2, A3, M1, M2, M3, M5, os baixos B1, B2, B3, B4, B5, B8, os dois
>   de i18n (I1, I2) e **todo o drift de documentação** (D1-D4 + menores + `infra/README.md`).
> - **Fase 119**: **A4** (idempotência do `/complete`, com janela de dedupe de 2 min) e
>   **M4** (`ClientInvite` no cascade de deleção, fechando PII que sobrevivia à exclusão
>   de conta). Verificado em produção: **0 convites órfãos**, então o M4 é preventivo.
>
> **Ainda abertos, todos de risco BAIXO** (escopo em
> [`PROXIMAS-FASES-AUDITORIA.md`](PROXIMAS-FASES-AUDITORIA.md)): **B6** (`startedAt`
> derivado), **B7** (`dayKey` UTC), **B9** (criação em 2 chamadas), **B10** (limpeza de
> fixture de teste), **B11** (retenção de `LoginLog`), e **M6-Terraform** (avisar quando
> um secret existe sem versão).
>
> A Fase 119 também corrigiu a **inconsistência de catálogo** que este documento apontou
> de passagem (o teste de contagem falhando desde a Fase 110) e fechou uma lacuna de
> tradução **descoberta só ao auditar o banco de produção**: 20 exercícios sem nenhuma
> tradução EN/ES, agora 0. Ver `STATUS.md` (Fase 119).
>
> O texto abaixo é o **laudo original**, preservado como estava — os cenários de falha
> descrevem o comportamento de ANTES da correção. Não edite os achados para refletir o
> estado atual; use este bloco e o `STATUS.md` (Fase 118) pra saber o que mudou.

Varredura **somente-leitura, nenhuma correção aplicada**. Sucessora da
`AUDITORIA-2026-07-31.md`, cujos achados foram em grande parte corrigidos nas Fases
105-108 — **nada dela é re-reportado aqui**. O foco é o código escrito depois
(Fases 109-117: renomear, `WorkoutSessionLog`/dashboard, RPE, seeds, e o painel admin)
mais padrões transversais que a anterior não cobriu.

**Método e limite de confiança.** Três frentes paralelas (backend novo · i18n+docs ·
frontend) mais uma frente própria (dados órfãos e crescimento). Todo achado exige
cenário concreto de falha — achado sem cenário foi descartado. **Cada item abaixo foi
verificado por mim**, lendo o caminho de código completo, e não apenas repassado das
frentes: 3 afirmações foram **rebaixadas ou corrigidas** na verificação (ver
[Corrigido na verificação](#corrigido-na-verificação)). Onde o desfecho dependia de
runtime, foi executado — marcado *(medido)*.

**Não reproduzido em produção**: sem acesso ao banco de produção (bloqueado por
permissão nesta sessão), sem inspeção de logs de produção, sem teste manual no app.

---

## Placar

| Risco | Bugs de código | Documentação |
|---|---|---|
| **ALTO** | 4 | 0 |
| **MÉDIO** | 6 | 4 |
| **BAIXO** | 11 | 7 |

**Os 4 de maior risco real**, em ordem de prioridade:

1. **A1** — modal pós-treino fica **inacessível** em celulares de até 375px: não há como fechar, compartilhar nem baixar
2. **A2** — template SELF **vazio** é aplicável e substitui o treino real do aluno, apagando histórico de séries
3. **A3** — o seletor de RPE contradiz o gráfico: responder "Leve" aparece como "Moderado"
4. **A4** — `/complete` perdeu a idempotência e grava sessões fantasma de volume zero no dashboard novo

Ponto positivo isolado: **a camada de i18n está impecável** — paridade estrutural
perfeita (1081/1081/1081 chaves-folha, 90 namespaces idênticos), zero português vazando
para ES ou EN. A regra PT/EN/ES está sendo cumprida no catálogo.

---

# RISCO ALTO

### A1 · Modal pós-treino inacessível em telas de até 375px — sem como fechar, compartilhar ou baixar
`frontend/components/post-workout-summary-modal.tsx:127` (overlay), `:139` (RPE inserido), `:151-163` (ações)

O overlay é `fixed inset-0 flex items-center justify-center p-4` — **sem `overflow-y-auto`**,
sem clique no backdrop e sem handler de `Escape`. O card é `aspect-[9/16] w-full` dentro
de `max-w-xs`, logo tem altura fixa (~569px) e não encolhe. A Fase 112 inseriu o
`RpeQuickPicker` (~168px: título + 5 botões que quebram em 2 linhas) **entre** o card e a
linha de botões.

*(medido em Chromium via Playwright, DOM/CSS replicados)*: com o upsell de treino SELF,
o conteúdo passa de 884-921px. Em 320×568, 360×640 e 375×667 (iPhone SE), **"Fechar" e
"Baixar imagem" ficam abaixo da borda inferior** e o overlay não rola. Removendo apenas
o bloco de RPE, "Fechar" volta a caber em todos os aparelhos testados — a correção do
`Fr9` estava boa; foi a Fase 112 que a desfez.

**Cenário**: aluno conclui um treino num iPhone SE ou Android de 360px. Vê o card e a
pergunta de RPE, mas os três botões estão fora da tela. Na web a única saída é recarregar
(perde o resumo); no app Capacitor o botão físico de voltar dispara
`window.history.back()` (`android-back-button-handler.tsx:29`), que desmonta a tela e
também descarta o resumo.

**Por que é alto**: a feature de compartilhamento (Fases 35/37 — o laço de crescimento do
produto) fica inalcançável justamente nos tamanhos de celular mais comuns, e o aluno é
obrigado a sair do fluxo para escapar do modal.

### A2 · Template SELF com zero sessões é visível e aplicável — substitui o treino real e apaga histórico de séries
`src/admin/repository/admin.repository.ts:371-373` · `src/fitness/repository/workout-programs.repository.ts:283-289` · `src/fitness/services/workout-programs.service.ts:466` e `:498-547`

A cadeia inteira não tem guarda de "template precisa ter ≥1 sessão":
`createSelfTemplate` cria o programa **sem nenhuma sessão** (elas são adicionadas depois,
em chamadas separadas); `listSelfTemplates` devolve todo `origin: SELF, isTemplate: true`
sem filtrar vazios; o service apenas traduz; e `applySelfTemplate` valida origem
(`:512`) e Premium (`:515`) mas **nunca** a contagem de sessões.

**Cenário**: o admin cria "Programa X" no `/nimbus` e vai adicionar as sessões. Nessa
janela todo aluno já vê o card, com "0 sessões". Um aluno que tenha treino pessoal ativo
toca em aplicar → recebe `409 SELF_PROGRAM_EXISTS` → confirma a substituição (o texto do
aviso cita o programa **antigo**, e nada avisa que o novo está vazio) → o treino real é
apagado junto com `SetLog`/exercícios/sessões e ele fica com um programa vazio, sem
desfazer.

**Por que é alto**: perda de dado do usuário (histórico de séries), alcançável em
produção, por um caminho que passa por **todas** as validações existentes. O `F1` da
auditoria anterior foi corrigido de verdade — `:503-514` valida antes de apagar — este é
um caminho **diferente**.

### A3 · O seletor de RPE contradiz o gráfico: responder "Leve" aparece como "Moderado"
`frontend/components/rpe-quick-picker.tsx:15-21` × `src/progress/services/progress.service.ts:186-191`

Achado independentemente por **duas frentes** da varredura. O picker grava exatamente 5
valores; o backend agrupa em 3 faixas com limiares 3/6:

| Resposta do aluno | `rpe` gravado | Faixa exibida |
|---|---|---|
| 😌 Muito leve | 2 | Leve |
| 🙂 **Leve** | 4 | **Moderado** ← contradiz o rótulo |
| 😐 Moderado | 6 | Moderado |
| 😖 Difícil | 8 | Intenso |
| 🥵 Muito difícil | 10 | Intenso |

A faixa "Leve" só é alcançável por "Muito leve"; **"Leve" é impossível de reportar**. Os
dois lados usam o mesmo vocabulário na UI, nos três idiomas, então a contradição é
literal para o usuário.

**Cenário**: aluno responde 🙂 "Leve" nas últimas 5 sessões → `/evolucao` →
"Distribuição de esforço" mostra **Leve (0) · Moderado (5) · Intenso (0)**.

**Por que é alto**: das três peças do dashboard novo, essa é a única que reporta o que o
aluno **respondeu** (as outras duas são medidas) — e reporta errado, de forma
determinística. Pior: em `frontend/app/personal/alunos/[alunoId]/page.tsx:364` o
**Personal** lê a mesma barra para decidir carga de prescrição, sobre dado deslocado uma
faixa para cima. Nenhum `.md` do repo justifica os limiares 3/6, então é lacuna, não
decisão. O teste `progress.test.ts:305-341` insere `rpe: 2/5/9` direto no banco — e `5`
**não é produzível pelo picker**, o que fez um valor cair em cada faixa e mascarou o
desalinhamento.

### A4 · `POST /api/workouts/:id/complete` perdeu a idempotência e grava sessões fantasma de volume zero
`src/fitness/services/workouts.service.ts:349` e `:355` (doc) × `:397-405` (código)

O comentário da própria função ainda afirma **"Idempotente: só atualiza
lastCompletedAt"** e, 42 linhas acima do código que a cria, que **"não existe uma
entidade de sessão/conclusão própria no banco"**. Verdadeiro até a Fase 111, falso desde
a 112: cada chamada executa `workoutSessionLogRepository.create(...)`
**incondicionalmente**, sem guard de reentrega e sem unique constraint.

**Cenário**: na 2ª chamada, `previousLastCompletedAt` já é o instante da 1ª conclusão, e
a janela do resumo (`workout-summary.service.ts:85-87`, filtro `loggedAt: { gte: start }`)
passa a excluir **todas** as séries reais → grava um `WorkoutSessionLog` com
`volumeKg: 0`, `setsCompleted: 0` e a duração reenviada. Esse ponto entra nos dois
gráficos de tendência de `/evolucao` e conta na distribuição de esforço se o aluno
responder o RPE. Caminhos reais: (a) duas abas no mesmo treino — a aba B ainda tem
`session` truthy e passa o guard de `frontend/app/treinos/[id]/page.tsx:228`; (b) retry
após resposta perdida — a sessão é **deliberadamente** preservada em erro de rede (fix do
`Fr1`/`Fr4`, `page.tsx:117-128`) e o botão reabilita.

**Por que é alto**: escreve dado permanentemente errado na feature mais nova do produto,
sem nenhuma barreira, e o comentário de idempotência **desencoraja** quem for mexer ali
de adicionar o guard. Nenhum teste cobre duas chamadas seguidas.

---

# RISCO MÉDIO

### M1 · Lembrete de pagamento: a data escolhida é exibida um dia antes, no mesmo card *(medido)*
`frontend/app/personal/alunos/[alunoId]/page.tsx:83` (envio) × `:74` (exibição) · `:55` (estado)

`<Input type="date">` devolve `"YYYY-MM-DD"`; `new Date("2026-08-10")` é interpretado como
**meia-noite UTC** e `.toISOString()` preserva isso. Executado com `TZ=America/Sao_Paulo`:

```
escolhido: 2026-08-10  →  enviado: 2026-08-10T00:00:00.000Z  →  exibido: 09/08/2026
```

**Cenário**: o Personal escolhe 10/08, salva, o card recarrega e passa a dizer "Próximo
lembrete: **09/08/2026**" — enquanto o campo de data logo abaixo continua em 10/08
(`dueDate` é estado local, nunca ressincronizado). Recarregar não resolve: `:55` relê
`iso.slice(0,10)`, então a contradição é permanente. O aluno recebe a cobrança na noite
do dia anterior ao escolhido (o backend compara `dueDate <= now`). Vale para **todo o
Brasil e toda a América** (qualquer fuso a oeste de UTC).

### M2 · `updateMyProfile` decide autorização lendo `planoAssinatura` cru — a classe de bug da Fase 117, no backend
`src/connections/services/connections.service.ts:76-77`

É o **único** ponto de decisão de autorização do backend que lê `planoAssinatura` direto
do banco sem passar por `revertExpiredPersonalPlan`/`getPersonalAccessStatus` (verificado
por varredura: os demais — `billing.service.ts:100`, `workout-programs.service.ts:281` —
consomem `billingService.getStatus`, que reverte antes).

**Cenário**: admin concede cortesia BASE por 7 dias. Vencido o prazo, nada reescreve a
linha até que algum caminho chame o helper. Nessa janela o Personal chama
`PUT /api/professionals/me` com `availableForNewStudents: true` → a linha 77 lê `"BASE"` →
permitido → volta ao diretório público, e `searchProfessionals`
(`connections.repository.ts:60`, filtro `not: "FREE"`, `orderBy planoAssinatura desc`) o
exibe **e o rankeia acima dos FREE**, com cortesia vencida.

É exatamente o padrão que a Fase 117 documentou como bug, e que o `B7`/`C2` fechou só na
direção *desligar* — a direção *religar* ficou aberta. **Médio, não alto**: a janela se
autocura quando o Personal abre qualquer tela que bata em `GET /api/billing/status`.

### M3 · `/programas/[id]`: falha do status de Premium **afirma** que o aluno não tem Premium e apaga os controles de edição
`frontend/app/programas/[id]/page.tsx:61-64`, `:74`, `:122`, `:166`, `:184`

```
const canEdit = isSelfProgram && !!premiumStatusQuery.data?.hasAccess;
```

`premiumStatusQuery` **não tem nenhum ramo `isLoading`/`isError` na página inteira** — só
`programQuery` renderiza `<QueryError>`. Com `isError`, `data` é `undefined` →
`canEdit = false` → desaparecem em silêncio o ✏️ do título, o ✏️ por sessão e o botão
"Adicionar treino".

**Cenário**: aluno **com Premium ativo** abre um treino pessoal; a chamada de status
falha (timeout/503). O programa carrega normal, mas sem nenhum controle de edição e
**sem erro, sem retry, sem explicação** — ele conclui que perdeu o Premium. Classe do
`Fr13`, em local novo, introduzido pela própria correção do `F7`.

### M4 · `ClientInvite` ficou fora do cascade de deleção de usuário — e a regra estava escrita no próprio doc
`prisma/schema.prisma:284-298` × `src/lib/user-deletion.ts` · regra em `src/admin/AGENTS.md:146-148`

`src/admin/AGENTS.md` diz explicitamente: *"If you add a NEW table with a `userId`-style
column in the future, you must add it to this cascade by hand — nothing enforces this
automatically."* A Fase 104 adicionou `ClientInvite` e não o fez: `clientInvite` aparece
**zero vezes** em `user-deletion.ts`, que apaga 16 outras tabelas. O modelo **não tem FK**
(`personalId` é `String` puro, só indexado), então a deleção não falha — as linhas
sobrevivem.

**Cenário**: um Personal é deletado; seus convites pendentes continuam vivos e válidos.
Um aluno que clique no link recebe erro *(verificado: `assertUnderAlunoLimit`,
`relations.service.ts:23-27`, valida `if (!user) throw`, e o `unconsume` do fix do `F2`
restaura o convite)* — ou seja **não** há vínculo corrompido, só um link que falha para
sempre. O problema real é duplo: linhas órfãs acumulando sem limpeza, e **PII sobrevivendo
à exclusão de conta** — `label` é texto livre escrito pelo Personal (tipicamente o nome
do convidado) e `consumedByAlunoId` permanece.

### M5 · `durationSeconds` negativo trava a conclusão do treino, contra a intenção declarada
`src/fitness/services/workouts.service.ts:379-383` (e `:356-361` para a intenção)

O comentário promete: *"Continua opcional (nunca 400 sem ele)… ainda consegue concluir
normalmente, só sem duração real registrada."* Mas se o relógio do dispositivo recuar
durante a sessão, `Math.round((Date.now() - session.startedAt)/1000)`
(`frontend/app/treinos/[id]/page.tsx:230`) fica negativo, o backend responde **400**, e o
frontend **não tem fallback para reenviar sem duração** — o `startedAt` persiste no
`localStorage`, então o retry falha igual. Uma métrica **opcional** de telemetria passa a
bloquear a ação central do produto. `workouts.test.ts:444-458` assevera o 400 para `-5`,
mas testa só o status HTTP, não o beco sem saída no cliente.

Relacionado, mesmo trecho, menor: não há **teto** — qualquer valor até 2³¹−1 é aceito e
vira ponto no gráfico; acima disso estoura o `INTEGER` da coluna *(medido: `3000000000` →
`PrismaClientUnknownRequestError`)* **depois** de `markCompleted` já ter rodado, deixando
o treino concluído sem `WorkoutSessionLog` e com 500.

### M6 · `infra/README.md`: setup do zero sobe produção com 3 secrets vazios, e todos os blocos `gcloud` falham
`infra/README.md:102` e `:104-113` × `infra/secrets.tf` · `infra/README.md:9-11` × `AGENTS.md:30-47`

Duas contradições no arquivo que alguém abre justamente para executar o deploy:

1. O doc diz que o apply cria *"os 3 secrets vazios"* e o passo 5 preenche três
   (`jwt-secret`, `jwt-refresh-secret`, `database-url`). O Terraform cria **6** —
   faltam `resend-api-key`, `stripe-secret-key`, `stripe-webhook-secret`. Seguindo o
   setup à risca, sobe-se produção com e-mail transacional (verificação de e-mail, reset
   de senha) e **todo o billing/webhook** quebrados, sem nenhum aviso.
2. O doc afirma *"Nenhum dos dois exige WSL — rodam igual em Git Bash/PowerShell"*. O
   `AGENTS.md:30` da raiz diz o oposto e está certo (verificado nesta sessão: `gcloud`
   não existe no Git Bash; `terraform` existe). Todos os blocos `gcloud` do README falham
   como escritos. O `AGENTS.md:32` existe exatamente para evitar que se conclua "logs de
   produção indisponíveis" — e é este README que reintroduz o engano.

---

# RISCO BAIXO

## Código

| # | Achado | Local | Consequência |
|---|---|---|---|
| B1 | `["session-history"]` nunca é invalidada — nem ao concluir treino, nem ao responder RPE | `frontend/app/treinos/[id]/page.tsx:127-143` · `rpe-quick-picker.tsx:27-30` | Concluir → responder → abrir `/evolucao` em menos de 30s (`staleTime` global) mostra os gráficos sem a sessão recém-registrada. Autocorrige em 30s |
| B2 | Gráfico "Carga de treino (RPE × duração)" renderiza área **em branco** quando nenhuma sessão tem RPE | `frontend/app/evolucao/page.tsx:210-211` · `personal/alunos/[alunoId]/page.tsx:355-356` | `trainingLoad` é `null` sem RPE, mas os 2 gráficos são renderizados sob a mesma condição. Aluno que nunca respondeu vê um gráfico vazio sem explicação — o `EffortDistributionBar` já tem o texto que faltaria |
| B3 | Os 3 `PATCH` novos respondem **500 com corpo vazio** em vez de 400 | `workouts.controller.ts:203` e `:267` (fora do `try`) · `workout-programs.controller.ts:145` | `PATCH` sem corpo/`content-type` → `request.body` é `undefined` → TypeError não capturado. O irmão do mesmo commit faz certo: `request.body?.durationSeconds` (`:246`) |
| B4 | Nomes de programa/sessão sem limite de tamanho nem checagem de tipo | `workouts.service.ts:222` · `workout-programs.service.ts:198` e `:439` | Só `!name?.trim()`. Coluna é `text`: 1 MB persiste e viaja em toda listagem. `{"name": 123}` → TypeError → 500. Comparar com `MAX_NOTES_LENGTH = 500` no mesmo service |
| B5 | "Baixar imagem" falha em silêncio; fallback do compartilhar gera unhandled rejection | `post-workout-summary-modal.tsx:69-82` e `:114-121` | `handleDownload` tem `try/finally` **sem `catch`** — botão pisca e nada acontece. Se a 2ª captura (dentro do catch do share) falhar, a rejeição escapa |
| B6 | `startedAt` é derivado, e fica errado no auto-encerramento por inatividade | `workouts.service.ts:400` × `prisma/schema.prisma:653-657` | O schema diz que é "quando o aluno clicou Iniciar"; o código calcula `completedAt − duração`. No auto-encerramento grava até 45 min adiantado e **posterior à última atividade real**. Hoje nenhuma query lê a coluna — corrupção latente |
| B7 | `dayKey` UTC rotula sessão noturna no dia seguinte | `progress.service.ts:3-5` e `:177` · `session-trend-chart.tsx:23-26` | Conclusão segunda 21:30 BRT → `completedAt` 00:30 UTC de terça → ponto rotulado como terça. `progress/AGENTS.md:56-59` documenta o UTC como deliberado, mas só analisa streak/`load-history` |
| B8 | "Cancelar" no `RoleEditor`/`PremiumEditor` não reseta o estado pendente | `frontend/app/nimbus/usuarios/page.tsx:42`, `:86`, `:134-135`, `:220` | Selecionar `ADMIN`, cancelar e reabrir deixa a promoção a **um clique**, com o confirmar já habilitado — anula o passo de confirmação deliberado. `inline-rename.tsx:46` faz o oposto, corretamente |
| B9 | Criação de treino pessoal em 2 chamadas encadeadas deixa programa órfão | `frontend/app/meu-treino-pessoal/criar/page.tsx:35-39`, `:51-62` | Programa criado, POST da sessão A expira: o retry vira `409 SELF_PROGRAM_EXISTS` perguntando se quer substituir o programa que ele mesmo acabou de criar. Desistindo, fica com programa sem nenhuma sessão |
| B10 | Fixtures de teste poluem o catálogo do aluno, sem limpeza | `src/admin/__tests__/admin-self-templates.test.ts` · 3 specs em `frontend/e2e/` | 31 specs E2E, **zero** `afterAll`/`afterEach`. O banco local acumulou **124** templates SELF de teste, todos com 0 sessões, todos visíveis no catálogo. Local-only (testes não rodam contra produção), mas mascara o **A2** e torna a tela inutilizável em dev. O comentário em `meu-treino-pessoal/page.tsx:297` afirma que GERAL está "hoje sem nenhum template curado de verdade" — premissa falsa assim que os testes rodam |
| B11 | `LoginLog` cresce sem retenção | `src/auth/repository/auth.repository.ts:171` | ~250 bytes/linha, sem pruning em nenhum lugar (16 mil linhas só no dev). Leitura é limitada por `take` e `user-deletion.ts:131` apaga na exclusão de conta — então não é bug, é vetor de custo, e o principal contra o teto de 0,5 GB do Neon Free |

## Documentação

O padrão é consistente: as Fases 87/102/103/104/112 atualizaram código e `STATUS.md`,
mas **não** propagaram para `MASTER_SPEC.md` nem para os `AGENTS.md` de domínio. Nenhum
dos 8 arquivos auditados escapou. Os quatro primeiros são os que ativamente induzem erro:

| # | Doc afirma | Código real | Consequência |
|---|---|---|---|
| D1 | `src/fitness/AGENTS.md:18` e **`:43`** (seção *"Handle with care"*): *"there is no separate 'session log' entity"* | `prisma/schema.prisma:639` — `model WorkoutSessionLog`, escrito em `workouts.service.ts:397-405` | Quem mexer em conclusão de treino re-deriva da heurística de 6h e **não grava** o session log → dashboard da Fase 112 fica silenciosamente vazio naquele caminho. Nem a entidade, nem o campo `rpe`, nem a rota `/api/workout-sessions/*` constam do doc |
| D2 | `src/billing/AGENTS.md:36`: *"o limite só bloqueia **novos** vínculos… Não 'conserte' isso num corte retroativo sem checar com o produto primeiro"* | Fase 103 entregou o corte: `plan-expiry.ts:116`, `:160-161`, `:185-194`, `:213-227`, ligado em 8 pontos de `fitness` | O doc **proíbe** o que o código já faz. Um dev tratará os 403 `PERSONAL_OVER_LIMIT`/`PERSONAL_PLAN_RESTRICTED` legítimos como bug |
| D3 | `MASTER_SPEC.md:145-148` e `:762-764` (nomeando as constantes): *"R$ 9,90/mês… 30% off no trimestral"* | `src/billing/stripe.ts:99` = `999`; `:103` = `20` | Gêmeo do bug já corrigido em `src/billing/AGENTS.md:66`, não propagado ao documento de entrada. Erro de receita de ~15% no trimestral (2079 vs **2398**) |
| D4 | `src/billing/AGENTS.md:53`: *"Checkout supports monthly and **annual** intervals (4 Stripe Price IDs)"*; e `.env.example:60,66,68` documenta vars `_ANNUAL` | `stripe.ts:44` — `BillingInterval = "monthly" \| "quarterly"`; `billing.controller.ts:89` joga tudo que não é `"quarterly"` em `"monthly"` | Um dev constrói opção "anual" que **degrada em silêncio para mensal** — cobra 1 mês vendendo 1 ano. Um ambiente novo configurado pelo `.env.example` fica sem preço trimestral → 500 no checkout. **Produção não é afetada** (verificado: o Cloud Run já tem `STRIPE_PRICE_ID_*_QUARTERLY`); o risco é ambiente novo/local. `src/billing/BILLING_SETUP.md:110-133` está correto |

Menores, mesma família — contagens e listas defasadas: `MASTER_SPEC.md:94` descreve
`planoAssinatura FREE/PAGO` e limite 3/50 (o enum é `FREE BASE PLUS`, limites 3/20/1M —
`PAGO` daria erro de enum); `MASTER_SPEC.md:1403` diz paginação 300/500 (é **1000/2000**,
`src/lib/pagination.ts:25-26`); `MASTER_SPEC.md:45-46` e `:1737-1740` listam verificação
de e-mail, reset de senha e login Google como *"fora do escopo"*/*"adiado"* — todos
entregues (Fases 77/81), e são justamente as seções usadas para decidir o que **não**
construir; `src/notifications/AGENTS.md:80-82` diz que o sino faz poll a cada **30s** (é
**6h** desde a Fase 102 — erro de 720×, e a carga no Neon era a *razão* da mudança);
`src/progress/AGENTS.md:77-79` documenta **4** endpoints (são 5) e omite
`WorkoutSessionLog` dos models lidos; `src/admin/AGENTS.md:21-23` diz que a única ação
auditada é `ROLE_CHANGE` (são 4: `+USER_DELETE`, `PREMIUM_TOGGLE`,
`EMAIL_VERIFIED_BY_ADMIN`); `src/connections/AGENTS.md:78-80` audita o payload público
contra uma allowlist errada (cita `location`, campo morto; omite `city`, `state`,
`specialties`, `avatarUrl`, que são expostos); `src/fitness/AGENTS.md:57` descreve o
carrossel Premium como *"decorativo, sem paywall"*, contradizendo `:17` do mesmo arquivo
e o gate real de 402; `AGENTS.md:97-108` (índice de navegação do repo) omite os domínios
`src/contact/` e `src/dashboard/`, e os models `ClientInvite`/`WorkoutSessionLog`.

## i18n

Só dois gaps pontuais, ambos de reuso e nenhum de tradução faltante:

| # | Achado | Local |
|---|---|---|
| I1 | Enum `Role` cru como label de `<option>`: o editor mostra `PERSONAL`/`ALUNO` em caixa alta ao lado do filtro, que aparece traduzido. As chaves `nimbusUsuarios.roleFilter.*` **já existem nos 3 idiomas e já são usadas no mesmo arquivo** (`:388-391`) — correção é reuso, não tradução nova. Baixo por ser tela só de admin | `frontend/app/nimbus/usuarios/page.tsx:28`, `:69-73` |
| I2 | Unidade `kg` concatenada no JSX (`{p.maxWeightKg}kg`), contra a convenção do projeto de embutir a unidade na mensagem (`"{reps} reps × {weight}kg"`) | `frontend/app/evolucao/page.tsx:155` |

Cosmético isolado: `cityStateInput.cityPlaceholder` foi adaptado em EN (`"E.g., Boston"`)
mas o ES manteve a cidade brasileira (`"Ej: Palhoça"`) — único caso no catálogo em que o
ES ficou a meio caminho.

---

## Corrigido na verificação

Três afirmações das frentes paralelas foram **rebaixadas ou corrigidas** ao conferir o
código — registrado para que a revisão não reintroduza a versão errada:

1. **`ClientInvite` órfão não corrompe dado** (M4). Foi reportado que `consumeInvite`
   criaria um `ClientRelation` apontando para usuário deletado. Não cria:
   `assertUnderAlunoLimit` (`relations.service.ts:23-27`) valida `if (!user) throw`, e o
   `unconsume` do fix do `F2` restaura o convite. O problema real é linha órfã + PII
   sobrevivendo à exclusão, não corrupção.
2. **`.env.example` com `_ANNUAL` não afeta produção** (D4). Foi classificado como ALTA
   por "500 em produção". Verifiquei o Cloud Run: `STRIPE_PRICE_ID_BASE_QUARTERLY` e
   `..._PLUS_QUARTERLY` já estão configurados. O risco é ambiente novo/local → MÉDIO.
3. **`take` fracionário no Prisma** foi levantado como possível erro e **descartado** pela
   própria frente após teste contra o Postgres real (`take: 2.5` → 200 OK). Não é achado.

## Verificado e descartado

Para não regastar tempo: o cascade do `WorkoutSessionLog` **está completo** (a migration
tem `ON DELETE CASCADE` real e os 3 sites que apagam `Workout` passam por ele);
`assertAluno` cobre o endpoint novo `session-history` com o mesmo guard de IDOR dos
outros 4; `setSessionRpe` valida RPE 0-10 antes de tocar o banco e checa posse; o `limit`
de `session-history` tem teto 100; `frontend/lib/premium.ts#hasActivePremium` (Fase 117)
está correto e trata `NaN`; `["billing-status"]` (`staleTime: Infinity`) **tem** todos os
invalidadores necessários — os 2 caminhos que mudam contagem de alunos já invalidam;
`/personal/programas/[id]` sem `hidden` no `InlineRename` está correto (renomear não tem
gate de billing); todas as queries da Fase 112 em `/evolucao` e na tela do Personal têm
ramo `isError` com `<QueryError>`; e as Fases 110/113/114/115/116 são exclusivamente
scripts de seed, sem lógica de backend nova.

**Não confirmado**: `session-trend-chart.tsx:73` — o `t("noAnswer")` do formatter do
tooltip parece código morto (recharts normalmente omite pontos `null` do payload), não
reproduzido em runtime; sem impacto se confirmado.
