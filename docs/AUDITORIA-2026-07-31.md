# Auditoria ampla — 2026-07-31

Varredura somente-leitura, sem nenhuma correção aplicada. Cinco frentes em paralelo
(auth · fitness · billing · connections+admin+support+notifications · frontend), cada
uma comparando o código real contra a intenção documentada em `AGENTS.md`,
`src/*/AGENTS.md`, `MASTER_SPEC.md` e `STATUS.md`.

**Método e limite de confiança**: todos os achados vêm de leitura de código, com
cenário concreto de falha exigido pra cada um (achado sem cenário foi descartado).
**Nada foi reproduzido em runtime** — sem execução de fluxo real, sem inspeção de logs
de produção, sem teste manual. Os itens marcados `[NÃO CONFIRMADO]` são os que os
auditores explicitamente não fecharam. O domínio `nutrition` foi excluído do escopo
(dormente, fora de uso).

Legenda: **[AUTZ]** toca autorização · **[BILL]** toca billing · **[SENS]** toca dado
sensível/PII · **[SCHEMA]** a correção exigiria mudança de schema Prisma.

---

## Placar

| Severidade | Seção 1 (bugs) | Seção 2 (casos de uso) |
|---|---|---|
| Alta | 11 | 3 |
| Média | 21 | 10 |
| Baixa | 12 | 6 |

Só **4 achados** exigem mudança de schema (A2, A6, F9, B1/B3 na correção robusta).
O resto é corrigível em código.

**Os 6 de maior risco real**, na minha ordem de prioridade:

1. **B1** — falha de pagamento temporária tira o plano **para sempre** e pode gerar cobrança dupla
2. **B2** — webhook de checkout sem idempotência → plano pago vitalício de graça, ou rebaixar quem pagou mais
3. **B3** — cortesia do admin vencendo rebaixa um assinante Stripe **pagante**
4. **F1** — `applySelfTemplate` apaga o treino do aluno (com histórico de séries) antes de validar
5. **X1** — `NUTRICIONISTA` prescreve treino, contra regra documentada explicitamente
6. **A2** — e-mail nunca normalizado → contas duplicadas e SSO Google que deixa de vincular

---

# SEÇÃO 1 — BUGS

## Severidade ALTA

### B1 · Falha de pagamento temporária destrói o vínculo com a assinatura e o plano nunca volta
`src/billing/services/billing.service.ts:201,211-213` + `src/billing/repository/billing.repository.ts:61-72`
**[BILL] [AUTZ] [SCHEMA na correção robusta]**

`customer.subscription.updated` com status ≠ `active`/`trialing` cai em `applyFreePlan`, que
zera `stripeSubscriptionId: null`. O guard da linha 201 (`user.stripeSubscriptionId !== sub.id`
→ `return`) passa a rejeitar **todos** os eventos futuros daquela subscription, inclusive o de
recuperação.

Cenário: Personal BASE, cartão vence → `updated(past_due)` → FREE, `stripeSubscriptionId=null`.
Ele atualiza o cartão no Portal, o Stripe cobra com sucesso e emite `updated(active)` para o
mesmo `sub_X` → `null !== "sub_X"` → `return`. **Plano fica FREE para sempre enquanto o Stripe
cobra todo mês.** Não existe reconciliação (`subscriptions.retrieve`), cron, nem endpoint de
sincronizar. A única saída é um novo Checkout, que cria uma **segunda** subscription no mesmo
customer — cobrança dupla, com a primeira nunca cancelada.

Contradiz `billing.service.ts:230-236` e STATUS.md Fase 103, que assumem esse downgrade como
reversível pelo mesmo canal. Nenhum teste cobre: `billing.test.ts:231` só testa o caso
*desejável* do guard.

⚠️ **Cuidado na correção**: `src/billing/AGENTS.md:48` avisa que não zerar `stripeSubscriptionId`
reabre a corrida de reordenação de eventos. B1 e B2 estão em tensão direta com esse guard e
precisam ser corrigidos **juntos** — corrigir B1 ingenuamente reintroduz a corrida.

### B2 · `checkout.session.completed` sem nenhum guard de reentrega
`src/billing/services/billing.service.ts:165-189` · **[BILL] [AUTZ]**

`src/billing/AGENTS.md:48` e `BILLING_SETUP.md:180-182` afirmam que "eventos obsoletos
reentregues são ignorados" — mas essa proteção só existe nos ramos `customer.subscription.*`.
O ramo de checkout aplica `applyPaidPlan` incondicionalmente, com o `metadata.tier` congelado
na criação da sessão, sem comparar com o estado atual.

Cenário A (acesso pago sem pagamento vigente): assinatura BASE, webhook responde 500 por erro
transitório (o controller devolve 500 de propósito pra o Stripe re-tentar, `billing.controller.ts:52`).
O Stripe re-tenta por até ~3 dias. Nesse meio-tempo o cliente cancela → `deleted` → FREE. A
retentativa chega depois → `applyPaidPlan(BASE, sub_1)` → volta a BASE apontando pra uma
subscription cancelada. Como está cancelada, nenhum evento futuro rebaixa: **BASE vitalício de graça.**

Cenário B (rebaixa quem pagou mais): assina BASE, faz upgrade pra PLUS pelo Portal. Uma
reentrega do checkout original (`metadata.tier=BASE`) → limite cai de 1.000.000 pra 20 pagando
PLUS; com 30 alunos, dispara o bloqueio da Fase 103 em 5 dias.

A tabela de idempotência por `event.id` já está listada como gap em `BILLING_SETUP.md:186`.

### B3 · `revertExpiredPersonalPlan` pode rebaixar uma assinatura Stripe REAL
`src/lib/plan-expiry.ts:16-20` (comentário) vs. `src/admin/repository/admin.repository.ts:274-282`
**[BILL] [AUTZ] [SCHEMA na correção robusta]**

O comentário afirma: *"Nunca reduz uma assinatura Stripe REAL: o webhook sempre limpa
`planoAssinaturaExpiresAt` em toda escrita"*. **A invariante é falsa na ordem inversa** —
`setPersonalPlano` sobrescreve plano/limite/`expiresAt` sem olhar `stripeSubscriptionId`.

Cenário: Personal BASE pagante (`sub_1`, `expiresAt=null`). Suporte concede cortesia "PLUS por
30 dias" → `expiresAt = hoje+30d`. No dia 31, a primeira leitura que dispara
`revertExpiredPersonalPlan` → **FREE, limite 3**, enquanto o Stripe segue cobrando os R$ 14,99
da BASE. O Stripe não emite evento nenhum (nada mudou lá), então não há autocorreção. Com mais
de 3 alunos, entra na carência e depois é bloqueado de prescrever.

### B4 · Trocar o Price no Stripe rebaixa silenciosamente todos os assinantes PLUS legados
`src/billing/services/billing.service.ts:38-51` vs. `BILLING_SETUP.md:93-95` · **[BILL] [AUTZ]**

`tierForPriceId` devolve `"BASE"` quando o price atual não casa com as 4 env vars
("conservador"). Mas `BILLING_SETUP.md:93-95` promete que *"ajustes futuros de preço só exigem
criar um novo Price no Stripe e trocar a env var, sem deploy de código"*. Incompatível.

Cenário: preço do Plus sobe, cria-se `price_new_plus`, a env var passa a apontar pra ele. Os
assinantes PLUS antigos seguem (corretamente) em `price_old_plus`. No próximo
`updated` de qualquer um deles (renovação, troca de cartão) → não casa → `applyPaidPlan(BASE)`
→ limite cai de 1.000.000 pra 20. Estúdio PLUS com 40 alunos vira over-limit e é bloqueado em
5 dias, pagando PLUS. **Sem nenhum log** no price desconhecido — rebaixamento 100% silencioso.

### F1 · `applySelfTemplate` apaga o treino do aluno ANTES de validar a origem do template
`src/fitness/services/workout-programs.service.ts:451-497` · perda de dado do usuário

Busca com `findProgramById` (linha 456, **sem filtro de `origin`/`isTemplate`**), apaga a
instância SELF existente (linha 491), e só então chama `applySelfTemplateToAluno` — a **única**
camada que filtra `origin: "SELF", isTemplate: true` (`repository/workout-programs.repository.ts:302-307`).
Se não casar, retorna `null` e a linha 495 lança 404 — mas o delete já aconteceu, fora de
transação compartilhada.

Cenário: aluno com "Treino em Casa 3x" ativo (com histórico de séries) faz
`POST /api/workout-programs/<id>/apply-self-template` com `{"replace": true}`, onde `<id>` é um
template `PERSONAL_CATALOG`, o id do próprio programa aplicado, ou um UUID que não existe mais.
`deleteProgram` apaga programa + sessões + `WorkoutExercise` + **`SetLog`**, e a resposta é
`404 "Template não encontrado."` — o aluno fica sem treino e sem histórico, com uma mensagem
dizendo que nada aconteceu.

### A1 · `refresh()` roda o lembrete de pagamento depois de rotacionar o token — uma falha ali desloga o usuário
`src/auth/services/auth.service.ts:528-534` (introduzido na Fase 106)

O novo hash é gravado na linha 528; só depois vem `checkAndFireDueReminders`, que faz
`findMany` + `notify` + `advanceReminder` **sem try/catch em nenhum dos 3 call sites de auth**.

Cenário: aluno com lembrete vencido chama `/api/auth/refresh`; o `notify` falha (timeout do
Neon, deadlock). O banco já tem `refreshTokenHash = hash(tokenNovo)`, mas o cliente recebe 500
e continua com o token antigo no cookie. Na tentativa seguinte, `bcrypt.compare` falha → a
detecção de reuso apaga `refreshTokenHash` → **o usuário é deslogado à força** sem ter feito
nada. Agravante: `refreshHandler` (`auth.controller.ts:191-194`) devolve `error.message` cru,
vazando mensagem interna do Prisma.

### A2 · E-mail nunca é normalizado — contas duplicadas e SSO Google que deixa de vincular
`src/auth/repository/auth.repository.ts:17-21`; `auth.service.ts:103,219,253,327,423,549`
**[SENS] [SCHEMA]**

`email` é `@unique` no Postgres — comparação **case-sensitive**. O único `toLowerCase()` do
domínio está no rate limiter. Nem register, nem login, nem check-email, nem `/google`, nem
forgot-password normalizam.

Cenário A: pessoa se cadastra como `Joao@gmail.com`; depois digita `joao@gmail.com` →
`check-email` diz `exists: false` → cadastro → `register` não vê conflito → **segunda conta
vazia**, e ela perde acesso aos treinos sem nenhuma mensagem que explique.

Cenário B (contradiz a Fase 77): conta `Joao@gmail.com` criada por senha. Clica "Entrar com o
Google"; o Google devolve minúsculas → `findByEmail` não acha → **conta nova em vez de
vincular**. `src/auth/AGENTS.md` afirma "Google SSO auto-links by e-mail, on purpose" — o
auto-link não acontece nesse caso.

Correção exige decidir a forma canônica + backfill/deduplicação dos registros existentes.

### A3 · Login via Google quebra com 500 se o e-mail da conta Google mudou; `findByGoogleId` é código morto
`auth.service.ts:423-447`, `auth.repository.ts:42-49` · **[AUTZ]**

O serviço só busca por e-mail. `findByGoogleId` existe e **não tem nenhum chamador** (grep em
`src/`), embora o comentário do schema diga que `googleId` é "sub do Google (estável mesmo se o
e-mail mudar) — usado pra vincular a conta na volta".

Cenário: usuário com `googleId = G` troca o e-mail primário da conta Google. Novo sign-in →
`findByEmail` não acha → `needsRole` → `createUser({ googleId: G })` → **violação de unique em
`googleId`** → exceção não tratada → **500** com `Unique constraint failed on the fields:
(googleId)`. Ele nunca mais entra por Google e vê uma mensagem técnica.

### X1 · `NUTRICIONISTA` pode criar, editar e aplicar programas de treino
`src/fitness/controllers/workout-programs.controller.ts:12-19` (`assertProfessional` aceita os
dois papéis), usado em `createProgramHandler:26`, `addSessionHandler:44`, `applyProgramHandler:59`,
`saveInstanceAsTemplateHandler:128`, `applyCatalogTemplateHandler:157`; frontend libera a UI em
`personal/programas/page.tsx:432` e `[id]/page.tsx:250` · **[AUTZ] [BILL]**

`AGENTS.md:100` e `src/fitness/AGENTS.md` §3 dizem textualmente: *"Only `PERSONAL`
creates/edits `Workout`s and programs with `origin: PERSONAL` (NUTRICIONISTA is deliberately
excluded, even though it can hold a `ClientRelation`)"*. E `workouts.controller.ts:47-53`
documenta a Fase 17 fechando essa brecha em `POST /api/workouts` — o fluxo de **programas**
nunca recebeu a mesma checagem.

Cenário (fluxo completo, sem tocar em nenhum endpoint bloqueado): Nutricionista vinculado à
aluna Y faz `POST /api/workout-programs` → `.../sessions` → `.../apply {alunoId: Y}` →
`POST /api/workouts/:sessionId/exercises` (que só ramifica em `role === "ALUNO"`,
`workouts.controller.ts:127-130`, e cuja posse é `workout.personalId`, gravado por ele mesmo).
Prescrição completa por um papel que o produto exclui explicitamente. `applyCatalogTemplate`
ainda aplica o gate Plus sobre o plano dele, estendendo o produto de templates pagos a um papel
não previsto.

### C1 · `acceptRequest` não é atômico: vínculo criado por fora deixa a solicitação presa em PENDENTE
`src/connections/services/connections.service.ts:226-250` e `:114-131`;
`src/fitness/services/relations.service.ts:55-61` · **[AUTZ]**

`acceptRequest` chama `createRelation` e só depois `setRequestStatus(id,"ACEITA")`.
`createRelation` lança **409** se o `ClientRelation` já existir — e `createRequest` **nunca
verifica se já existe vínculo**, só se existe `ConnectionRequest`. Há 2 caminhos que criam
vínculo por fora: `POST /api/relations` e o consumo de convite.

Cenário: aluno A manda mensagem pelo diretório (request PENDENTE). Enquanto isso P vincula A
por link de convite. P clica "Aceitar" → 409 → a linha continua PENDENTE e **não há como
resolver pela UI**: aceitar sempre dá 409, recusar encerra a conversa de um aluno que já é
cliente. O card fica em "Pendentes" indefinidamente. Mesma falta de atomicidade se
`setRequestStatus` falhar após o `createRelation` ter sucesso.

### Fr1 · Conclusão de treino pode ser disparada duas vezes
`frontend/app/treinos/[id]/page.tsx:204-209,327-339,345-351`

`handleCompleteManually` limpa o localStorage mas **não** faz `setSession(null)` — ao contrário
do auto-encerramento (linha 179-181). O botão é `disabled={isPending || !session}`; depois do
sucesso `session` segue não-nulo e `isPending` volta a `false` → **clicável de novo** (e o
rótulo virou "Sessão concluída", que convida ao clique) → `completeWorkout` roda 2x, duplicando
`lastCompletedAt`/streak/estatística semanal.

Pior caminho: o modal de inatividade continua montado e `autoFinishTriggeredRef` **não** foi
marcado nesse caminho. Aluno fica parado 30 min → "Ainda está treinando?" → clica "Concluir" →
fecha o resumo → o modal reaparece com o relógio rodando e, ao cruzar `IDLE_AUTO_FINISH_MS`, o
efeito da linha 174-183 conclui **de novo, sozinho, sem clique**.

### Fr2 · `/profissionais`: a busca nunca dispara se o perfil falhar
`frontend/app/profissionais/page.tsx:52-80`

`searchQuery` tem `enabled: hydrated`, e `hydrated` só vira `true` dentro do effect que consome
`profileQuery.data`. `profileQuery.isError` **não é tratado em nenhum lugar da página**, e a
chave `["my-profile"]` tem `staleTime: Infinity` (`providers.tsx`), então nem navegar e voltar
refaz.

Cenário: `GET /api/professionals/me` falha. Query desabilitada no TanStack v5 tem
`fetchStatus: "idle"` → `isLoading`, `isError` e `isSuccess` **todos `false`** → nenhum
loading, nenhum erro, nenhum "nada encontrado" (linhas 150-154 mortas). O aluno clica em
"Buscar" e literalmente nada acontece, para sempre. Única saída: F5.

### Fr3 · Adicionar sessão em `/programas/[id]` cai em "sessão não encontrada"
`frontend/app/programas/[id]/page.tsx:61-65` → `meu-treino-pessoal/[id]/sessoes/[sessionId]/page.tsx:39-42,82`

`addSessionMutation.onSuccess` só faz `router.push` — não invalida `["workout-program", programId]`,
que é a **mesma** queryKey da página de destino.

Cenário: aluno abre `/programas/<id>` (popula a chave), clica "adicionar sessão B", é levado
pra sessão nova; a chave está fresh (staleTime 30 s), não há refetch,
`program.workouts.find(w => w.id === sessionId)` → `undefined` → a tela renderiza
**"sessão não encontrada"**. A tela irmã do Personal (`personal/programas/[id]/page.tsx:67`) e a
própria página de destino (`:44-50`) **invalidam antes do push** — a assimetria confirma a intenção.

---

## Severidade MÉDIA

### B5 · Upgrade pago não reinicia a carência: quem paga pra sair do bloqueio continua bloqueado
`src/billing/repository/billing.repository.ts:36-46` + `src/lib/plan-expiry.ts:110-123` · **[BILL] [AUTZ]**

`applyPaidPlan` nunca limpa `overLimiteAlunosSince`; o campo só é limpo quando
`count <= limiteAlunos`. Cenário: Personal com 25 alunos cai pra FREE, fica 10 dias acima do
limite → bloqueado. Pra se regularizar assina **BASE** (limite 20). 25 > 20, o timestamp de 10
dias atrás permanece → `daysElapsed = 10 >= 5` → **continua bloqueado imediatamente após
pagar**, recebendo 403 `PERSONAL_OVER_LIMIT`, e os alunos dele 403 `PERSONAL_PLAN_RESTRICTED`.
Nada na UI explica que ele precisava do PLUS.

### B6 · Falha de pagamento apaga a presença no diretório de forma irreversível e silenciosa
`src/billing/repository/billing.repository.ts:68` · **[BILL]**

`applyFreePlan` seta `availableForNewStudents: false` (correto pra cancelamento), mas o mesmo
caminho serve `past_due` (B1) e o campo **nunca é restaurado** em `applyPaidPlan`. Cenário:
cobrança recusada por saldo → sai do diretório. Paga no dia seguinte; mesmo que o plano
voltasse, a visibilidade não volta. Nenhuma notificação informa que ele saiu do diretório.

### B7 / C2 · Revogação manual do admin e expiração de cortesia não desligam `availableForNewStudents`
`src/admin/repository/admin.repository.ts:272-282`, `src/lib/plan-expiry.ts:29-40` vs.
`src/billing/repository/billing.repository.ts:61-72` · **[BILL]**

`src/connections/AGENTS.md` afirma que a consistência do gate depende de `applyFreePlan`
continuar limpando o campo — e os dois caminhos acima escrevem `FREE` **sem** limpar (busca
global confirma que só `applyFreePlan` escreve esse campo, além do endpoint de perfil).

Cenário: admin concede Plus por 30 dias, o Personal liga a disponibilidade e monta bio. No dia
31 a cortesia vence → FREE, mas o toggle continua **ligado** em `/personal/perfil` com o preview
"como vou aparecer". O filtro `planoAssinatura: { not: "FREE" }`
(`connections.repository.ts:60`) o remove do diretório: **está invisível e a UI diz o
contrário**; se desligar e tentar religar, leva 403 sem nunca ter sido avisado da expiração.
Não é vazamento de recurso pago (o filtro protege), é estado/UI inconsistente.

Variante: admin revoga o Premium de um Personal com Stripe BASE ativo → FREE/3, mas
`stripeSubscriptionId` segue apontando pra `sub_1` e o Stripe segue cobrando. Nada reconcilia.

### B8 · `invoice.payment_failed` está implementado mas o endpoint do Stripe não escuta esse evento
`src/billing/services/billing.service.ts:228-250` vs. `BILLING_SETUP.md:26-29,59-61` · **[BILL]**

O `BILLING_SETUP.md` declara o webhook escutando exatamente 4 eventos, e o checklist de
ativação em modo live repete "**mesmos 4 eventos**". A Fase 103 adicionou o handler no código,
mas nenhum dos dois documentos foi atualizado. Cenário: ativa-se o modo live seguindo o
checklist ao pé da letra → o aviso proativo de falha de pagamento **nunca dispara em
produção**. Defeito de configuração/documentação com efeito funcional real.

### B9 · Um erro não-transitório em um único evento pode envenenar o webhook para todos os usuários
`src/billing/services/billing.service.ts:181` + `billing.controller.ts:49-53` · **[BILL]**

Toda exceção vira 500 pra o Stripe re-tentar, sem distinguir transitório de permanente e sem
caminho de "reconhecer e descartar". Cenário: usuário completa o Checkout e a conta é excluída
em seguida → `prisma.user.update` lança `P2025` → 500 → o Stripe re-tenta por ~3 dias. Variante
com `P2002` em `stripeCustomerId` (é `@unique`). Além do ruído, **o Stripe desabilita endpoints
com falha persistente**, o que derrubaria o processamento de plano de todos os clientes.

### B10 · Nada impede um segundo Checkout de quem já tem assinatura ativa
`src/billing/services/billing.service.ts:60-97` · **[BILL]**

`createCheckoutSession` não olha `stripeSubscriptionId`/`planoAssinatura`. O único freio é a UI
(`personal/upgrade/page.tsx:216`), e **essa UI falha aberta**: quando `statusQuery` erra, `tier`
é `undefined`, `isPago` é `false`, e a página renderiza o `QueryError` **junto com** os dois
botões "Assinar". Cenário: Personal BASE abre a tela durante instabilidade, vê "Plano
gratuito", paga de novo → `sub_1` e `sub_2` ativas no mesmo customer. O checkout de `sub_2`
sobrescreve o id, `sub_1` fica órfã: cancelá-la pelo Portal emite um `deleted` que o guard
descarta → **ele pode cancelar a assinatura errada e continuar pagando** sem registro nenhum.

### F2 / A4 · `consumeInvite` queima o convite antes de criar o vínculo, e o motivo é descartado
`src/fitness/services/client-invites.service.ts:108-113`; retorno ignorado em
`auth.service.ts:132-134` (register), `:371-373` (login), `:462-464` (google) · **[AUTZ] [BILL]**

`tryConsume` marca `consumedAt` atomicamente e **depois** `createRelation` roda — que valida
duplicata (409) e limite de plano (403). Se lançar, nada reverte, e `revokeInvite` recusa
convites já consumidos (`:64-66`), então o convite fica **permanentemente inutilizável**.

Cenário: Personal FREE com 2 alunos gera um convite (passa em `assertUnderAlunoLimit`), vincula
um 3º aluno por outro caminho, e só então o convidado abre o link. `tryConsume` marca consumido
→ `createRelation` lança 403 → o aluno tem conta, **nenhum vínculo**, e um link morto; o
Personal não consegue revogar nem reaproveitar (400 "já foi usado") e o convite desaparece da
lista (`findActiveByPersonal` filtra `consumedAt: null`). É a mesma classe de bug "aluno órfão"
da Fase 105, pelo caminho que o fix não cobriu — e os 3 callers de auth jogam o `reason` no lixo,
então o Personal acredita que funcionou.

### F3 · O código `PERSONAL_PLAN_RESTRICTED` nunca chega ao frontend — o tratamento da Fase 103 é código morto
Backend: `fitness/controllers/workouts.controller.ts:203-206`, `workout-programs.controller.ts:7-10`,
`setlogs.controller.ts:26-27,45-46` · Frontend: `components/query-error.tsx:24`,
`app/treinos/[id]/page.tsx:226-228`

`plan-expiry.ts:159-168` cria o erro com `err.code`, mas **nenhum handler do domínio serializa
`code`** no corpo — todos fazem `send({ error: err.message })`. Só `PREMIUM_REQUIRED`,
`PREMIUM_TEMPLATE_REQUIRED` e `SELF_PROGRAM_EXISTS` propagam `code`. Logo `error.data.code` é
sempre `undefined`.

Cenário: aluno de Personal bloqueado abre `/treinos/<id>` → 403 → `isPersonalRestricted` é
`false` → a mensagem aparece em `text-danger` (**vermelho, tom de alarme**) em vez do tom
neutro que a Fase 103 escolheu deliberadamente após pesquisa de UX. Mesmo vale pra
`PERSONAL_OVER_LIMIT` no lado do Personal (que aliás não tem tratamento nenhum no frontend).

### F4 · Nenhuma validação numérica em prescrição e em séries — negativos e zero são aceitos
`fitness/services/workouts.service.ts:84-128,189-218`; `setlogs.service.ts:47-65`; rotas sem
`schema` de body (`routes/workouts.routes.ts:42-48`, `routes/setlogs.routes.ts:5-12`)

`sets`, `restSeconds`, `order`, `repsRange`, `setNumber`, `repsDone`, `weightKg` vão do body
direto pro Prisma. A única validação existente é o limite de 500 chars de `notes`; o `min={1}`
do formulário é validação de navegador.

Cenários: `{"sets": -3, "restSeconds": -60, "order": -1}` grava → na execução, `totalSets`
negativo → `VoltageBar total={-3}`, contador "0/-3", `allSetsDone` travado em `false`.
`{"weightKg": -200, "repsDone": -10}` grava → `sumVolumeKg` devolve **volume positivo espúrio**
(−200 × −10 = 2000 kg) no resumo, e `findMaxHistoricalWeightForExercise` passa a comparar PRs
contra dado inválido.

### F5 · Falha ao concluir a sessão deixa a tela de execução num beco sem saída
`frontend/app/treinos/[id]/page.tsx:174-183,204-209,327-342`

`clearWorkoutSession` roda **antes** de saber se a mutation deu certo; o auto-encerramento
ainda faz `setSession(null)` e trava `autoFinishTriggeredRef`. O botão é `disabled={... || !session}`.

Cenário: aluno treina 50 min, o app auto-encerra por inatividade, o `POST /complete` falha
(rede, ou 403 porque a carência do Personal venceu no meio). `session` nulo, localStorage
limpo, botão **permanentemente desabilitado**, erro genérico, duração real perdida. Única saída:
recarregar e recomeçar o cronômetro do zero. (Ver também **Fr4** abaixo, mesma raiz no caminho manual.)

### Fr4 · Cronômetro apagado antes da confirmação: duração perdida em falha de rede
`frontend/app/treinos/[id]/page.tsx:207-208`

`clearWorkoutSession(workoutId)` roda antes de `completeMutation.mutate()`, não em `onSuccess`.
Aluno treina 50 min com sinal ruim, clica "Concluir", o POST falha. O localStorage já foi
zerado; ao recarregar — reação natural diante de um erro — a tela volta a "Iniciar Treino" e os
50 min estão perdidos, sem o treino ter sido registrado.

### Fr5 · Criar/substituir treino pessoal não invalida nada
`frontend/app/meu-treino-pessoal/criar/page.tsx:40-56` — o arquivo **não importa `useQueryClient`**

Chaves não invalidadas: `["aluno-dashboard-summary"]` e `["workout-programs","aluno"]` (ambas
staleTime 2 min). Cenário: aluno tem "Full Body" e abre o dashboard. Vai em
`/meu-treino-pessoal/criar`, cria "Treino em Casa" e confirma a substituição — o backend
**deleta** o antigo. Volta ao dashboard em <2 min → o bloco "Meus treinos" mostra o card do
**"Full Body" já deletado**, e clicar abre `/programas/<id-inexistente>`.

### Fr6 · Aplicar template pessoal não invalida o dashboard nem a lista de programas
`frontend/app/meu-treino-pessoal/page.tsx:74-79` (`applyMutation`, nenhuma invalidação) e
`:99-102` (`onApplySuccess` invalida só `["self-templates"]`)

Cenário: aluno abre `/dashboard` (bloco vazio), aplica "Treino em Casa 3x", volta em <2 min → o
dashboard continua dizendo que ele não tem treino pessoal. No caminho `replaceMutation`, o card
aponta pro programa **deletado**. A tela de sessão do mesmo fluxo
(`meu-treino-pessoal/[id]/sessoes/[sessionId]/page.tsx:44-50`) já invalida
`aluno-dashboard-summary` **com comentário explicando exatamente esse acoplamento**.

### Fr7 · Aceitar solicitação não invalida `["billing-status"]` (staleTime Infinity)
`frontend/app/personal/solicitacoes/page.tsx:38-42` · **[BILL] [AUTZ]**

`invalidate()` cobre só `["connection-requests"]` e `["relations"]`. `["billing-status"]`
alimenta o `PersonalOverLimitBanner`, renderizado no `AppHeader` de **toda** tela autenticada.

Cenário: Personal FREE com 3 alunos aceita a 4ª solicitação. O dashboard passa a mostrar "4/3",
mas o **banner de excesso/carência nunca aparece pelo resto da sessão** — ele só descobre que
está bloqueado quando o backend recusa uma prescrição com 403, ou depois de um F5. A tela
vizinha (`personal/alunos/page.tsx:114-119`) **já invalida** `billing-status` ao desvincular,
com comentário justificando ("o banner de carência precisa refletir isso na hora") — o lado
inverso ficou de fora.

### Fr8 · Dashboard do Nutricionista lê o limite de alunos do store persistido
`frontend/app/nutricionista/dashboard/page.tsx:34-35` · **[BILL]**

`const limite = user?.limiteAlunos ?? 0` — sem `getBillingStatus`. O `user` vive em
localStorage e só é reescrito por `setSession` (login / verificar-email / avatar-upload);
**nada refaz o `user` após mudança de plano**.

Cenário: admin concede plano Base a um Nutricionista com 3/3 alunos (limite 3→20 no banco). Ele
recarrega: continua vendo "3/3", o aviso vermelho e o botão de vincular desabilitado — recebeu
o upgrade e segue bloqueado até deslogar e logar. O dashboard do Personal
(`personal/dashboard/page.tsx:34-37`) tem o comentário explicando exatamente por que **não**
confia no store; o do Nutricionista ficou de fora.

### Fr9 · Modal pós-treino: botão "Fechar" sai da tela em celular estreito
`frontend/components/post-workout-summary-modal.tsx:126-151`

Linha `flex gap-2` (sem `flex-wrap`) com dois `Button className="flex-1"` + um ghost; todos os
`Button` carregam `whitespace-nowrap` e `px-5` (`ui/button.tsx:7,23`) — **não encolhem**.
Medido em Chromium: a linha exige 375px dentro de uma caixa `max-w-xs` (320px). No iPhone SE
(375px) a borda direita do "Fechar" cai 27px fora; num Android de 320px, **71px fora**.

Cenário: aluno termina o treino num iPhone SE, o resumo abre e o "Fechar" fica **fora da
viewport**; como o overlay é `fixed`, a página não rola pra alcançá-lo — única saída é
recarregar. Pior em es-ES ("Compartir/Descargar imagen/Cerrar").

### Fr10 · Rodapé de navegação da sessão estoura a página horizontalmente
`frontend/app/meu-treino-pessoal/[id]/sessoes/[sessionId]/page.tsx:136-157` e
`frontend/app/personal/programas/[id]/sessoes/[sessionId]/page.tsx:141-162`

`<div className="flex gap-3">` (sem `flex-wrap`/`min-w-0`) com dois `Button flex-1` — "← Voltar
ao programa" e "Próximo: {label} →" — dentro de `main` com `px-6`. Medido: com esquema **Dias da
semana** a linha pede 367px; disponível são 272px a 320px, 312px a 360px, 327px a 375px →
estouro em **todos os celulares até ~390px**. Confirmado que não há `overflow-x: hidden` em
`body`/`html`: é scroll horizontal real, com o texto cortado na borda.

### Fr11 · E-mail do aluno sem `truncate`/`break-all` estoura a lista
`frontend/app/nutricionista/dashboard/page.tsx:73-91` (min-content 447px vs. 228px disponíveis a
320px); `frontend/app/personal/solicitacoes/page.tsx:83,125` (380px);
`frontend/app/nimbus/logins/page.tsx:38-44` (327px)

E-mail é string sem espaços, nunca quebra sozinho. Cenário: Nutricionista abre o dashboard no
celular com um aluno de e-mail longo → a lista vaza pra fora do Card e a página rola na
horizontal. **Este mesmo bug já foi corrigido** em `personal/alunos/page.tsx:95-98` e
`personal/alunos/[alunoId]/page.tsx:203-206`, com comentário explicando `min-w-0` + `break-all`
— estas três telas ficaram de fora.

### Fr12 · Bolhas de conversa sem `break-words`: URL colada transborda
`frontend/components/conversation-thread.tsx:52-60` e `support-thread-detail.tsx:73,80-88`

`max-w-` não impede uma palavra única maior que o container. Medido: uma URL de YouTube com
lista → 248px num container de 230px a 320px; URLs de 80+ chars estouram em qualquer largura.
Cenário: aluno cola o link de um vídeo na conversa ou numa dúvida; o Personal abre no celular →
o texto sai da bolha e a tela rola na horizontal.

### Fr13 · Queries cujo `isError` deixa a tela **afirmar algo falso** (silêncio total)
O projeto usa `<QueryError>` consistentemente na maioria das queries; estes casos ficaram de
fora, e o efeito não é "falta um aviso" — é a UI mentindo:

| Local | Falha silenciosa | Cenário |
|---|---|---|
| `app/dashboard/page.tsx:226-229` (`myPersonalsQuery`) | `hasPersonalRelation` → `false`, Bloco 1 e `InvitePersonalCard` ambos não renderizam | Aluno com Personal vinculado abre o dashboard, a query falha → **o treino do dia prescrito simplesmente não existe na tela**; ele conclui que o Personal apagou o programa |
| `app/personal/alunos/page.tsx:32-43` (`programsQuery`) | `alunoIdsComTreino` vazio → **todos** ganham o selo "sem treino" | Personal acha que perdeu as prescrições e refaz treino em cima de aluno que já tinha |
| `app/personal/alunos/page.tsx:38,62` (`invitesQuery`) | seção de convites pendentes desaparece | Personal entra pra revogar um convite, a listagem falha → a tela diz implicitamente "nenhum convite", ele cria um segundo → **dois links de vínculo automático válidos circulando, sem poder revogar o primeiro**. **[AUTZ] [SENS]** |
| `app/meu-treino-pessoal/page.tsx:69-72` (`premiumStatusQuery`) | botão "Monte seu treino" e `PremiumUpsellCard` escondidos; carrossel Premium vem `locked` | Aluno **com Premium ativo** é informado de que o produto não existe. **[BILL]** |
| `components/conversation-thread.tsx:29-32` | `messages = []`, indistinguível de "nenhuma mensagem" | Personal abre a solicitação pra "ler o contexto antes de decidir" → entende que o aluno não escreveu nada e **decide às cegas** (justamente o contexto que a Fase 76 introduziu) |
| `app/duvidas/page.tsx:33` (`personalsQuery`) | Card "Nova dúvida" abre só com o título | Aluno vê um card em branco, sem erro nem retry |
| `app/nimbus/treinos-pessoais/page.tsx:255-259,290-293` | painel de edição abre vazio; exclusão que falha não dá feedback | Admin abre template de 4 sessões, o detalhe falha → painel vazio **com os botões "+ A/B/C" ativos** → monta sessões duplicadas |
| `app/dashboard/page.tsx:216-220` (`weeklySummaryQuery`) | barra "Últimos 7 dias" e card de streak somem | Aluno interpreta como perda do histórico. **Baixa** |
| `app/personal/dashboard/page.tsx:42-43` (`threadsQuery`) | `pendingThreads` → `0` | Personal assume que não há dúvida aguardando. **Baixa** |

Mesma família no backend-adjacente: `frontend/app/meu-treino-pessoal/page.tsx:140-146` e
`criar/page.tsx:52-57` (`replaceMutation` **sem nenhum** tratamento de erro — o diálogo só fecha
em `onSuccess`, então um 402 de Premium expirado não mostra nada e o aluno clica repetidamente);
`app/profissionais/page.tsx:81-84,254-256` (`requestsQuery` — `statusByPro` vazio faz o botão
"Enviar mensagem" reaparecer pra quem já tem solicitação → 409 inesperado);
`app/duvidas/page.tsx`, `app/nimbus/treinos-pessoais/page.tsx:284-293`.

### Fr14 · Mutações sem `isPending`/erro visível → ação duplicada
- `components/template-preview-dialog.tsx:90-97` + `app/personal/programas/page.tsx:150-157,419-425`:
  o botão "Aplicar" não recebe estado de pendência, e `applyCatalogMutation.isError` é
  renderizado **depois do `</main>`, atrás do overlay `fixed inset-0 z-50` do dialog**. Cenário:
  aplica template a um aluno que já tem programa → 409 → o modal continua idêntico, sem spinner
  e **sem mensagem visível** → clica 2-3 vezes achando que travou. **[BILL]**
- `app/meu-treino-pessoal/page.tsx:336,386,410,434-443`: o `TemplatePreviewDialog` fecha no
  clique e nem o carrossel nem os banners recebem `isPending`. Cenário: em 3G o aluno aplica
  "Treino em Casa A", nada muda, clica de novo → o segundo volta 409 `SELF_PROGRAM_EXISTS` e
  abre o diálogo "quer substituir *Treino em Casa A*?", perguntando se ele quer trocar o treino
  que acabou de aplicar, ao mesmo tempo que o `router.push` do primeiro navega.

### Fr15 · Mensagens reais do backend engolidas por textos fixos
`app/programas/[id]/page.tsx:160-161`; `app/meu-treino-pessoal/[id]/sessoes/[sessionId]/page.tsx:159-161`;
`app/treinos/[id]/page.tsx:341`

Comparar com `app/personal/programas/[id]/page.tsx:155-161`, corrigido na Fase 103 exatamente
por esse motivo. Cenário: aluno sem Premium clica "Adicionar treino B" → 402 *"Editar seu treino
pessoal é um recurso do Aluno Premium. Assine ou inicie o teste grátis de 7 dias."* → a tela
mostra só "Erro ao adicionar sessão", **sem nenhuma pista de que é recurso pago nem CTA**.

### Fr16 · Erro de "aplicar template do catálogo" renderizado atrás do overlay
`app/personal/programas/page.tsx:409-425` vs. `components/template-preview-dialog.tsx:44`

`setPreviewTemplate(null)` só acontece em `onSuccess`, então em caso de erro o modal permanece
cobrindo a tela e o `<p className="text-danger">` fica atrás dele. Cenário: Personal bloqueado
por `PERSONAL_OVER_LIMIT` aplica um template Básico → 403 → **nenhuma reação visível**. Parece
botão quebrado.

### C3 · Desvincular aluno não reverte a `ConnectionRequest` ACEITA → aluno bloqueado permanentemente
`src/fitness/services/relations.service.ts:85-93` + `connections.service.ts:129-131` · **[AUTZ]**

`removeRelation` (a única via de autorregularização da Fase 103) apaga o `ClientRelation` e
**não toca na `ConnectionRequest`**. Cenário: aluno conecta com P pelo diretório (request
`ACEITA`); P perde o Plus e desvincula pra voltar ao limite. Semanas depois o aluno quer voltar
→ `createRequest` vê `status === "ACEITA"` → **409 "Você já está vinculado a este
profissional."**, embora não exista vínculo. Não há endpoint pra limpar/reabrir esse par (o
`@@unique([alunoId, professionalId])` garante 1 linha) — **o aluno nunca mais consegue
solicitar aquele profissional**.

### C4 · Corrida na checagem de limite de alunos ao aceitar em paralelo
`src/fitness/services/relations.service.ts:21-37,42-73` (leitura, contagem e `create` em 3
queries, sem transação/lock), acionado por `connections.service.ts:238` · **[BILL]**

Cenário: Personal FREE (limite 3) com 2 alunos e 2 solicitações pendentes. Dois cliques
quase simultâneos em "Aceitar" (ou 2 abas): ambas leem `count = 2 < 3`, ambas criam → **4
vínculos com limite 3**. O `@@unique` é por par, não por contagem. Ele fica acima do limite sem
ter pago e depois cai no bloqueio da Fase 103 sem entender por quê.

### C5 · Mudança de role e gravação do `AdminAuditLog` não são atômicas
`src/admin/services/admin.service.ts:534-541` · **[AUTZ]**

`src/admin/AGENTS.md` afirma: *"A successful change always writes an `AdminAuditLog` row
(`ROLE_CHANGE`) before returning"* — na prática são 2 escritas independentes. Cenário: admin
promove alguém a ADMIN, o `UPDATE` em `users` comita, o `INSERT` no log falha (timeout do Neon
acordando). O endpoint devolve 500, o admin acha que não funcionou — mas **o usuário já é ADMIN
e não existe nenhum registro de auditoria da promoção**. Exatamente o caso de escalada sem
rastro que o log deveria cobrir. Mesmo padrão em `deleteUser:580-590` (documentado como
intencional) e `setUserPremium:640-655`.

### F6 · `NUTRICIONISTA` bloqueado por excesso de alunos não tem nenhuma UI pra se autorregularizar
`components/remove-aluno-button.tsx` usado só em `app/personal/alunos/page.tsx:111`, cuja página
é `AuthGuard allowedRoles={["PERSONAL"]}` · **[BILL] [AUTZ]**

`relations.controller.ts:36-42` libera o DELETE pros dois papéis **com comentário explícito**
("senão um Nutricionista acima do limite não teria como se autorregularizar"), e o Grupo Z do
MASTER_SPEC registra que a regra vale igual pros dois. Mas o `/nutricionista/dashboard` só lista
alunos com link pra anamnese, e **não existe** `app/nutricionista/alunos/page.tsx`.

Cenário: Nutricionista com 8 alunos cai de Base pra FREE; passados 5 dias é bloqueado. **Ele
não tem em nenhuma tela do app um botão pra desvincular** — a via de saída existe só no
backend. Exatamente o beco sem saída que a Fase 103 diz ter eliminado. (Ver **X2** na Seção 2:
o mesmo papel também não tem tela de upgrade nem de solicitações.)

### F7 · Aluno sem Premium recebe os controles de edição do treino pessoal aplicado
`app/programas/[id]/page.tsx:56` (`canEdit = program?.origin === "SELF"`, sem checar
entitlement) vs. `workout-programs.service.ts:355-363` e `workouts.service.ts:32-42` · **[BILL]**

Instâncias aplicadas dos carrosséis **gratuitos** ("Treino em Casa"/"Treinos Prontos") são
`origin: SELF`, então o aluno sem Premium vê o ✏️ por sessão e o botão "Adicionar treino" — e
todo o backend por trás é gated com 402. Cenário: aluno gratuito aplica "Treino em Casa 3x",
clica em "Adicionar treino B" → 402 exibido como "Erro ao adicionar sessão" (ver Fr15); clica no
✏️ e cai numa **tela inteira de edição** cujos botões todos falham. A mesma tela em
`meu-treino-pessoal/page.tsx:230-236` só mostra o CTA quando `hasAccess` — a checagem existe no
produto, só não foi aplicada aqui.

### C6 · `/nimbus/treinos-pessoais`: excluir template e adicionar sessão falham em silêncio
`app/nimbus/treinos-pessoais/page.tsx:284-293` — nem `addSessionMutation` nem `deleteMutation`
renderizam `isError` (só `createMutation:399-401` e os editores de nome/tag exibem)

Cenário: admin confirma a exclusão de um template, o `DELETE` volta 500 (possivelmente porque o
`$transaction` de `adminRepository.deleteSelfTemplate:416-424` apaga `WorkoutExercise` sem
apagar `SetLog` que os referencie — FK real segundo `src/lib/user-deletion.ts:5-10`;
**[NÃO CONFIRMADO]** se existe `SetLog` apontando pra linhas de template). A UI não mostra nada
e, como `invalidate()` só roda no `onSuccess`, o card continua na lista: parece que o clique não
registrou.

### C7 · Sino de notificações: erro na lista deixa o dropdown em branco e "marcar lida" falha em silêncio
`components/notification-bell.tsx:95-115,181-187`

Sem ramo `isError` pra `listQuery`, e nem `markReadMutation` nem `markAllMutation` têm
`onError`. Cenário 1: badge mostra "3", usuário abre o sino, o GET falha → `isLoading` já é
`false` e `data` é `undefined` → **nem "carregando", nem "vazio", nem erro**: dropdown
totalmente em branco. Cenário 2: clica "Marcar todas como lidas", o POST falha → nenhuma
mensagem e o badge mantém o número antigo (a invalidação só ocorre no `onSuccess`), dando
impressão de UI travada.

### C8 · `/profissionais`: 4 erros de listagem engolidos
Detalhado em **Fr13** (mesmo cluster). Inclui `saveCityMutation` sem `onError`
(`app/profissionais/page.tsx:68-74`): salvar cidade falha → a busca roda, a cidade não
persiste, nenhum aviso, e na próxima visita o campo volta vazio.

### F8 · Corridas check-then-act nas travas de unicidade e no teto de templates
`workout-programs.service.ts:141-154` (1 programa aplicado por aluno/personal), `:323-338` e
`:474-494` (1 SELF ativo), `:28-36` (teto de 50 templates) · **[SCHEMA na correção definitiva]**

Nenhuma constraint no banco (`WorkoutProgram` só tem `@@index`, nenhum `@@unique`). Cenário:
duplo clique em "Aplicar programa" (`personal/programas/[id]/page.tsx:196-201` só desabilita
durante `isPending`, o que não cobre dois cliques no mesmo tick) → ambos leem "nenhum aplicado"
e ambos criam → o aluno passa a ter **2 instâncias do mesmo programa**, violando a regra
documentada da Fase 41 sem nenhum caminho de UI pra diagnosticar. Mesmo padrão permite 51+ templates.

### A5 · Erro interno no login conta como tentativa de senha errada
`src/auth/controllers/auth.controller.ts:111-115`

O `catch` chama `recordFailedAttempt` para **qualquer** exceção, inclusive 500. Cenário: aluno
com lembrete vencido e `notify` falhando (ver A1) tenta logar 5 vezes com a **senha correta** →
5 × 500 → o limiter atinge o máximo → as tentativas seguintes viram **429 "Muitas tentativas de
login inválidas"** por 15 min, sem nenhuma senha errada digitada.

### A6 · `register()` não valida tamanho de senha nem formato de e-mail
`auth.service.ts:102-139` vs. `:247-251` (`resetPassword`) e `:610-614` (`changePassword`) · **[SENS]**

`MIN_PASSWORD_LENGTH = 8` é aplicado em reset e change, **nunca** no cadastro; o
`EMAIL_FORMAT_REGEX` é usado em `check-email` e `forgot-password`, **não** em `register`.
Cenário: `POST /api/auth/register {"email":"nao-e-email","password":"1"}` → **201**, conta
criada com senha de 1 caractere e e-mail inválido (o `minLength={8}` é só client-side). A conta
nasce inverificável, e depois o próprio usuário não consegue trocar a senha por algo com menos
de 8 caracteres — regra que ele burlou no cadastro.

### A7 · `hydrate()` sem try/catch → "carregando" infinito em todas as telas protegidas
`frontend/lib/store/auth-store.ts:44-51` + `components/auth-guard.tsx:36-57`

`JSON.parse(raw)` roda sem proteção; se lançar, `set({ isHydrated: true })` nunca executa, e o
`AuthGuard` renderiza o spinner enquanto `!isHydrated` — sem timeout, sem fallback, sem
redirecionar. Cenário: `localStorage["thunderafit_user"]` fica truncado (quota, escrita
interrompida, extensão do navegador) → **toda tela autenticada mostra "carregando…" pra
sempre**, e o usuário não tem saída pela UI (nem o botão de logout aparece — ele vive no
`AppHeader`, dentro da árvore protegida).

### A8 · Rate limiter cresce sem limite a partir de endpoints públicos
`src/auth/services/login-rate-limiter.ts:30-65`

Entradas com `failedCount < 5` têm `blockedUntil = null` e **nunca** são varridas; não há TTL
nem tamanho máximo. Cenário: script anônimo faz `POST /api/auth/check-email` com e-mails
aleatórios (cada chamada registra uma "tentativa", por design) → cada e-mail novo cria uma
entrada permanente no `Map` do processo → crescimento monotônico até o container do Cloud Run
reiniciar por OOM. Efeito secundário: como o contador nunca decai, um usuário legítimo com 4
falhas antigas é bloqueado na 5ª falha **meses depois**.

### A9 · `requestPasswordReset` pode lançar (contra o invariante documentado) e queima o link anterior sem enviar nada
`auth.service.ts:219-238`

Ordem: token gravado (225) → `getEnv("ALLOWED_ORIGIN")` (227, **fora** do try) → `sendMail`
dentro do try. O `AGENTS.md` afirma "`requestPasswordReset(email)` NEVER throws"; `getEnv`
lança se a var faltar, e `ALLOWED_ORIGIN` é opcional no boot (`src/app.ts:70` tem fallback).
Cenário: ambiente sem essa var → o usuário pede reset, recebe **200** com a mensagem genérica,
nada é enviado, e o `passwordResetTokenHash` foi **sobrescrito, invalidando um link válido** que
ele já tivesse recebido.

Mesma família: `resendVerificationEmailHandler` propaga a exceção do Resend → **500 com a
mensagem `Resend: <detalhe>` exposta ao cliente**, e o token anterior já foi invalidado antes da
tentativa de envio. E se `RESEND_API_KEY` não existir, `sendMail` devolve `false`
silenciosamente e o handler responde "E-mail de confirmação reenviado." — **sucesso falso**.

### F9 · `previewInvite` conta toda visualização como tentativa falha → 429 depois de 5 aberturas
`src/fitness/controllers/client-invites.controller.ts:106-113` + `login-rate-limiter.ts:22-23,57-65`

`recordFailedAttempt(ip, token)` é chamado incondicionalmente, antes de saber se o token é
válido, e `recordSuccessfulAttempt` nunca é chamado nesse fluxo. Cenário: o convidado abre o
link do WhatsApp, sai, volta, recarrega — na **5ª renderização** de `/login?invite=<token>` o
preview responde 429 e a tela perde o contexto de quem convidou. Nenhum erro do usuário
provocou isso.

### F10 · Cap de paginação aplicado a listas cujos consumidores precisam do resultado completo
`src/lib/pagination.ts:10` (`DEFAULT_PAGE_SIZE = 300`) + `app/personal/alunos/page.tsx:41-43`,
`app/personal/programas/page.tsx:169`

O item 102 do MASTER_SPEC justifica o cap com "ceilings reais já pequenos" — mas
`PLUS_LIMITE_ALUNOS = 1_000_000` (`src/billing/stripe.ts:38`), então instâncias aplicadas não
têm teto prático. Cenário: Personal Plus de estúdio com 350 alunos, todos com programa aplicado,
criados depois dos seus 40 templates. `listByPersonal` ordena `createdAt: desc` e corta em 300 →
**as 40 linhas de template ficam fora da página**: "Meus Templates (0/50)" aparece vazio, e os
~50 alunos cortados ganham o selo "sem treino" indevidamente.

---

## Severidade BAIXA

| # | Achado | Arquivo |
|---|---|---|
| A10 | Botão do Google falha em silêncio e nunca tenta de novo (`scriptLoadPromise` guarda a promessa rejeitada pra sempre); com bloqueador de DNS o divisor "ou" aparece com um vazio embaixo | `components/google-sign-in-button.tsx:26-41,60-77` |
| A11 | Cadastro concorrente devolve 500 com `Unique constraint failed on the fields: (email)` em vez do 409 que o próprio serviço define | `auth.service.ts:103-117` |
| A12 | `JWT_SECRET` ausente se disfarça de "sessão expirada" (401 em loop, sem causa no log) em vez de falhar alto no boot | `auth/middlewares/authenticate.ts:41-47` |
| F11 | Comparação de volume nunca funciona pra treino de peso corporal — `previousVolumeKg <= 0` é tratado como "sem histórico", então todo o carrossel HOME/PRONTOS diz "sem histórico" pra sempre | `workout-summary.service.ts:153-155` |
| F12 | `/programas/[id]` só permite adicionar sessão após a **última** existente (`nextKey` vem de `sessions[length-1]`), então um programa WEEKDAY com SEGUNDA+DOMINGO esconde o botão embora o backend aceitasse QUARTA | `app/programas/[id]/page.tsx:57-59` |
| F13 | `POST /api/workouts` (legado, sem consumidor de UI) ignora "1 programa aplicado por aluno/personal" — 3 chamadas criam 3 programas | `fitness/repository/workouts.repository.ts:15-22` |
| F14/Fr17 | Campo "Salvar como template" não pode ser esvaziado (`value={templateName \|\| program.name}` reinjeta o nome a cada backspace) | `app/personal/programas/[id]/page.tsx:212-216` |
| B11 | Concessão manual de Premium pra ALUNO destrói o trial em andamento de forma irreversível (revogar zera `expiresAt`, `alunoTrialUsedAt` permanece → 409 "já utilizado" pra sempre) | `admin/repository/admin.repository.ts:256-263` |
| B12 | `invoice.payment_failed` notifica sem checar de qual subscription é a fatura (ao contrário de todos os outros ramos) → aviso falso no cenário de 2 subscriptions, e 3-4 notificações idênticas por ciclo (smart retries, sem dedup) | `billing.service.ts:238-248` |
| C9 | `?page=abc` / `?pageSize=x` / `?role=FOO` → `NaN` chega ao Prisma → **500 com o erro do Prisma vazado no corpo** em vez de 400 | `admin.service.ts:170-176`, `admin.repository.ts:51` |
| C10 | `addExerciseToSelfSession` não valida nada do corpo (único handler do domínio sem validação): `exerciseId` inexistente → 500 opaco; `order: -1` → gravado e exibido como `#-1` | `admin.service.ts:945-971` |
| C11 | Mensagem de erro contradiz a validação: a lista válida inclui `PRONTOS` mas o texto do 400 diz "GERAL, HOME ou PREMIUM" | `admin.service.ts:834-838` |
| C12 | `/personal/duvidas`: filtro aplicado antes da checagem de vazio → Personal com 5 dúvidas todas `RESPONDIDO` vê "nenhuma dúvida" (filtro default `ABERTO`) sem saber que é efeito do filtro | `app/personal/duvidas/page.tsx:34-36,77-81` |
| Fr18 | Card de template clicável não é focável por teclado (`<Card onClick>` sem `role`/`tabIndex`; a variante **com** banner usa `<button>` corretamente) → templates sem banner inalcançáveis por teclado/leitor de tela | `components/self-template-carousel.tsx:113-122` |
| Fr19 | Invalidações incompletas de menor impacto: `generate-workout-modal.tsx:101,123` não invalida `["workout-programs","personal"]` (template da Montagem Inteligente não aparece por até 2 min); `personal/alunos/[alunoId]/page.tsx:245-252` usa chave estreita demais; `personal/programas/[id]/page.tsx:64` deixa a contagem de sessões velha | vários |
| Fr20 | Altura/peso com vírgula viram `NaN` → serializados como `null`, e a tela diz "salvo com sucesso" (campos são texto livre, sem `type="number"`). **[SENS]** — dado de saúde. **[NÃO CONFIRMADO]** se o backend rejeitaria o `null` | `app/anamnese/page.tsx:66-69,78-90` |
| B13 | **[NÃO CONFIRMADO]** Corrida em `getPersonalAccessStatus` na gravação de `overLimiteAlunosSince` (leitura e escrita separadas, sem transação). Impacto prático desprezível nos cenários construídos — as duas datas ficam a milissegundos | `src/lib/plan-expiry.ts:110-114` |

---

# SEÇÃO 2 — VALIDAÇÃO DE CASOS DE USO

## X1 · O papel `NUTRICIONISTA` está pela metade em 4 fluxos diferentes
Severidade **ALTA** no agregado · **[AUTZ] [BILL]**

Não é um bug pontual, é um padrão: o backend aceita o papel, a UI não existe, e em um caso o
backend aceita **mais** do que deveria. Vale tratar como um tema só.

| Fluxo | Backend | Frontend | Consequência |
|---|---|---|---|
| Prescrever treino | **aceita (não deveria)** — ver **X1** na Seção 1 | libera a UI | Prescrição completa por papel que `AGENTS.md:100` exclui explicitamente |
| Desvincular aluno | aceita, com comentário dizendo que é a via de autorregularização | **não existe tela** | Bloqueado por excesso sem nenhuma saída na UI (**F6**) |
| Assinar/fazer upgrade | `billing.controller.ts:64` aceita checkout | `upgrade/page.tsx:264` é `allowedRoles={["PERSONAL"]}` | Recebe o banner de over-limit (`personal-over-limit-banner.tsx:26` dispara pro papel) e **não tem nenhum caminho de compra** |
| Receber solicitação de conexão | suportado ponta a ponta (`connections.service.ts:117`, `acceptRequest` aceita os 2) | `/personal/solicitacoes` é `allowedRoles={["PERSONAL"]}` e **não existe** `app/nutricionista/solicitacoes` | Aluno manda mensagem → ele recebe a notificação, **clicar nela não navega pra lugar nenhum** (`notification-bell.tsx:31-36` mapeia `connection_request`/`new_message` só pra PERSONAL) e não há tela onde aceitar. Solicitação pendente eternamente |
| Limite de alunos no dashboard | — | lê do store persistido (**Fr8**) | Upgrade não reflete até deslogar |

O gap do papel já está registrado no MASTER_SPEC (Fase 93), mas as consequências agora incluem
**bloqueio de acesso sem via de saída** e **uma brecha de autorização**.

## X2 · Fluxo de falha de pagamento: é onde o código mais se afasta da intenção documentada
Severidade **ALTA** no agregado · **[BILL] [AUTZ]**

Intenção (STATUS.md Fase 103 + `billing.service.ts:230-236`): aviso proativo no
`payment_failed`, downgrade "de verdade" via `subscription.updated(past_due)`, com o Personal
podendo *"agir antes que o downgrade aconteça"*. O que o código faz, percorrido ponta a ponta:

1. o aviso **não chega em produção** — o evento não está configurado no endpoint (**B8**);
2. o downgrade acontece na **primeira** falha, não após as retentativas — **não existe janela
   nenhuma** pra "agir antes";
3. o downgrade é **irreversível** pelo canal que a doc supõe que o reverteria (**B1**);
4. ele também apaga a presença no diretório **permanentemente** (**B6**);
5. a UI não tem estado de dunning nenhum: o Personal vê só "Plano gratuito" sem explicação e é
   empurrado pra um novo Checkout, que gera **cobrança dupla** (**B10**);
6. se ele tentar resolver assinando um degrau menor, continua bloqueado (**B5**).

Na prática, hoje: **um cartão recusado por 24h custa ao cliente o plano, o diretório, e
possivelmente uma segunda assinatura.**

## X3 · Precedência entre admin, Stripe e expiração não está definida em lugar nenhum
Severidade **MÉDIA** · **[BILL] [AUTZ]**

A pergunta "quem ganha?" não tem resposta no código: `setPersonalPlano` escreve por cima de
qualquer estado (inclusive assinatura viva) e `applyPaidPlan`/`applyFreePlan` escrevem por cima
de qualquer concessão. É **last-writer-wins puro**, sem checagem cruzada.
`src/billing/AGENTS.md:33` autoriza a exceção do admin e afirma que ela "não toca
`stripeSubscriptionId`" — o que é verdade e é **exatamente a causa** da inconsistência: o plano
muda, o vínculo com o Stripe não, e nada reconcilia. Consequência confirmada mais grave: **B3**.

Ponto correto: a concessão manual não fabrica `stripeSubscriptionId`, então `hasSubscription`
fica `false` e o Portal não abre indevidamente — **só que o frontend ignora esse campo** e
mostra o botão do Portal de todo jeito, levando a um 400 "Nenhuma assinatura ativa para
gerenciar" sem explicação (ver X6).

Correção documental necessária: o Grupo Z do MASTER_SPEC afirma que "voltar pra FREE/limite 3,
não desfaz vínculos, desliga `availableForNewStudents`" é o comportamento documentado — isso
vale pro **webhook**, não pros caminhos de admin e de expiração (**B7**), e a doc não faz a distinção.

## X4 · Admin lê thread de suporte completa (dado de saúde) sem nenhum `AdminAccessLog`
Severidade **MÉDIA** · **[SENS] [AUTZ]**

`src/admin/AGENTS.md` exige: *"If you add a new admin-facing endpoint that surfaces PII/health
data (not just aggregate metrics), write a `createAccessLog` entry the same way
`anamnesis.service.ts#getForAdmin` does"*. A anamnese cumpre
(`anamnesis.service.ts:49-56`, com o cuidado de não logar no 404). Mas `supportService.getThread`
**libera ADMIN por role** (`support.service.ts:62-68`) e retorna a thread com **todo o histórico
de mensagens** — sem nenhum log.

Cenário: admin faz `GET /api/support/threads/<id>` de uma dúvida entre aluno e Personal
(conteúdo tipicamente de saúde: lesão, medicação, dor) → 200 com todas as mensagens, e
`/nimbus/logs-acesso` continua vazio. A tela de SLA (`admin.service.ts:212-223`) também expõe o
`subject` de toda thread aberta da plataforma sem log. A promessa "todo acesso de admin a dado
de saúde é auditado" **só vale pra anamnese**.

## X5 · Diretório público devolve o e-mail completo, sem paginação e sem exigir papel ALUNO
Severidade **MÉDIA** · **[SENS]**

`connections.repository.ts:7-17` (`PUBLIC_PROFILE_SELECT` inclui `email`), `:135-140`,
`routes/connections.routes.ts:20` (qualquer papel autenticado). O `AGENTS.md` declara a forma
como intencional e o frontend mascara na exibição (`professional-card.tsx:35` mostra só
`email.split("@")[0]`) — mas **o payload da API traz o e-mail completo**.

Cenário: um Personal concorrente autenticado chama `GET /api/professionals/search?city=&state=`
(sem filtro, sem paginação) e recebe numa resposta o e-mail real de **todos** os profissionais
Base/Plus opt-in da plataforma — lista de prospecção pronta. No sentido inverso,
`GET /api/connection-requests` entrega ao profissional o e-mail completo do aluno com a
solicitação apenas **PENDENTE** (`connections.service.ts:206-214`, exibido cru em
`personal/solicitacoes/page.tsx:83`), permitindo contornar por fora o "vínculo nasce só com
aprovação manual" que é a premissa da Fase 21. Telefone não existe no schema — sem vazamento de
telefone; nenhum outro campo sensível sai nesses endpoints.

## X6 · Estados de billing que a UI não cobre
Severidade **MÉDIA** · **[BILL]**

- **`?status=success` não invalida o cache.** `["billing-status"]` tem `staleTime: Infinity`. Hoje
  funciona por acidente (o retorno do Stripe é um document load); qualquer navegação
  client-side de volta, ou o dashboard em outra aba, mostra o plano antigo até o F5.
- **"Pagamento concluído" mentindo em pagamento assíncrono.** Boleto/Pix: `?status=success` é
  renderizado enquanto `planoAssinatura` ainda é `FREE` (o estado intencional). A tela diz
  "pagamento concluído", "Plano gratuito" e oferece os dois botões de assinar **na mesma
  viewport**. Não existe estado "aguardando confirmação".
- **Não há upgrade BASE→PLUS no app** (`upgrade/page.tsx:216`: qualquer degrau pago esconde os
  cards). O Portal do Stripe é o **único** caminho — que é exatamente o que depende de
  `tierForPriceId` (**B4**) e o menos testado.
- **`hasSubscription` é retornado e nunca lido** (`lib/api/billing.ts:8`) → quem tem plano
  concedido pelo admin vê o card "Gerenciar/cancelar assinatura" e leva um 400 sem explicação.
- **`limiteAlunos` é ignorado na tela de planos** (`:176-179` deriva o texto do enum) → limite
  customizado é exibido errado.
- **`planoAssinaturaExpiresAt` no passado** é renderizado como "expira em \<data passada\>",
  sem comparação com `Date.now()` e sem "seu plano expirou".
- **`cancel_at_period_end` não é exposto** por `getStatus` → quem cancela "ao fim do período"
  continua vendo "assinatura ativa" sem qualificação até o dia em que tudo muda de uma vez.
- **O banner de over-limit não aponta pra solução paga** (`personal-over-limit-banner.tsx:48-53`
  tem CTA único pra `/personal/alunos`), e a tela de upgrade não menciona over-limit apesar de
  já ter os 3 campos na query que executa. Combinado com **B5**, quem tenta resolver pagando
  não recebe orientação nenhuma.
- **`PERSONAL_OVER_LIMIT` e `PREMIUM_REQUIRED` não têm tratamento nenhum no frontend** (grep no
  repo inteiro: `PREMIUM_REQUIRED` só aparece num comentário).

## X7 · Desvincular aluno não retira do Personal o acesso ao treino nem ao histórico de séries
Severidade **MÉDIA** · **[SENS]**

`workouts.service.ts:245-274` (`workout.personalId !== userId`),
`workout-programs.service.ts:517-531` — a posse pra leitura é sempre o `personalId` gravado na
linha; **nenhum desses caminhos reconsulta `ClientRelation`**. A Fase 103 decidiu preservar o
histórico do aluno ao desvincular, mas nada foi documentado sobre revogar o acesso do profissional.

Cenário: Personal A desvincula o aluno X. Os registros continuam com `personalId = A`. A
qualquer momento depois — meses depois, sem relação vigente — A ainda abre
`GET /api/workouts/<sessionId>` e lê o treino **e todos os `SetLog`** (cargas/repetições) de X,
inclusive os **posteriores** à desvinculação, se X continuar usando o programa. A UI de A não
lista mais o aluno, mas os IDs seguem válidos (e ficam em cache/URL/histórico do navegador).
**Vale decidir explicitamente: é intencional ou é vazamento?**

## X8 · Aluno desvinculado continua acessando o programa, governado pelo plano do ex-Personal
Severidade **MÉDIA-BAIXA** · **[AUTZ] [BILL]**

Cenário: Personal A, acima do limite, desvincula o aluno X — justamente a ação de
autorregularização. O programa de X sobrevive (decisão de produto) com `personalId = A`.
Consequência não documentada: **o acesso de X àquele treino continua amarrado ao estado de plano
de A**. Se A voltar a ficar acima do limite depois (por outros alunos), X — que não é mais aluno
de A — volta a levar 403 `PERSONAL_PLAN_RESTRICTED` num treino que ainda usa. O inverso também
vale: enquanto A está regularizado, X mantém acesso pleno a um programa de um profissional a
quem não está mais vinculado.

## X9 · Sessão em 2 dispositivos: um mata o outro, e a detecção de reuso mata os dois
Severidade **ALTA** · **[SCHEMA]**

`User.refreshTokenHash` é **um só** por usuário, e a detecção de reuso apaga o campo em vez de
rejeitar só a requisição (comportamento pedido no `AGENTS.md`, "Handle with care"). Nenhum
documento reconhece a consequência pra múltiplos dispositivos, e `MASTER_SPEC.md:59` vende
"rotação de refresh com detecção de reuso" como recurso.

Cenário (determinístico, sem depender de corrida): a aluna loga no celular (H1) e depois no
notebook (H2 sobrescreve H1). 15 min depois volta ao celular: o access token expirou, o app
chama `/refresh` com o token do celular → `bcrypt.compare` falha contra H2 → tratado como roubo
→ `refreshTokenHash = null` → 401 no celular **e** o notebook cai em `!refreshTokenHash` na
renovação seguinte → 401 nos dois. **Uso normal em 2 telas** (celular na academia, notebook em
casa — o cenário padrão de um app de treino) resulta em logout alternado permanente. Mesma
dinâmica entre 2 abas (o single-flight de `lib/api/client.ts:43-52` é por aba).

Correção adequada exige tabela de sessões/refresh tokens.

## X10 · Mudança de role pelo admin trava o usuário fora da área nova
Severidade **MÉDIA** · **[AUTZ]**

`refresh()` devolve só `{accessToken, refreshToken}` — nenhum `user`; não existe endpoint "quem
sou eu"; nada re-sincroniza o store (`setSession` só é chamado em login/register/google/
verify-email/avatar). Cenário: admin promove `ALUNO` → `PERSONAL`. O JWT novo já carrega o papel
novo e o backend autoriza, mas o localStorage segue `ALUNO` → o `AuthGuard` de `/personal/*` a
expulsa indefinidamente; **só entra se deslogar e logar**, sem nenhuma pista de que é
necessário. O inverso mantém a UI antiga acessível com 403 em telas sem tratamento uniforme.
Já registrado como gap em `MASTER_SPEC.md:1121-1122` ("Ajuste #2"), não implementado.

**Não é escalada de privilégio**: o `AuthGuard` é puramente cosmético, e todos os endpoints
admin passam por `assertAdmin` lendo o papel do **JWT** — quem editar o localStorage renderiza o
shell do `/nimbus` mas não obtém nenhum dado.

## X11 · Trocar a senha não derruba sessões — e numa conta só-Google define credencial sem re-autenticar
Severidade **MÉDIA** · **[SENS] [AUTZ]**

`changePassword` (`auth.service.ts:605-641`) grava o hash novo e para aí; `resetPassword`
(`:246-274`) chama `updateRefreshTokenHash(userId, null)`. A assimetria não está documentada.

Cenário A: usuário desconfia que a sessão foi comprometida e usa "Trocar senha" no perfil (o
caminho natural). O `refreshTokenHash` do invasor **continua válido por até 7 dias** — a ação
que ele acredita ser "expulsar o invasor" não expulsa ninguém. Pelo "esqueci minha senha", seria
expulso; pelo botão do perfil, não.

Cenário B: conta criada por Google SSO (`passwordHash = null`). Quem tiver um access token
roubado válido (janela de 15 min) chama `PUT /api/auth/me/password` **sem** `currentPassword`
(aceito de propósito) e passa a ter uma **credencial permanente por senha**, sem nunca ter
provado posse do e-mail nem da conta Google. A decisão de dispensar `currentPassword` está
documentada; a consequência de virar persistência de acesso, não.

## X12 · O freio do `check-email` bloqueia login com credenciais corretas
Severidade **MÉDIA**

`auth.controller.ts:130-144` registra "falha" em toda chamada, e o login consulta o mesmo balde
`IP+email` (`:99-104`). Cenário: no fluxo unificado a pessoa digita o e-mail, cai no passo de
senha, clica "voltar", refaz — cada "Continuar" é um `check-email`. Na **5ª passagem pelo mesmo
e-mail** (ou 1 `check-email` + 4 senhas erradas), a tentativa seguinte com a senha **certa**
recebe 429 por 15 min — no primeiro caso, com **zero senhas erradas**. Quem estiver ajudando um
cliente pelo telefone reproduz isso com facilidade.

## X13 · Cadastro cujo login encadeado falha deixa o usuário sem saída
Severidade **MÉDIA**

`frontend/app/login/page.tsx:215-224`: `registerMutation` faz `register` e, no mesmo mutation,
`login`. Se o register der 201 e o login falhar (429 do X12, rede, 500 do A5), a tela mostra o
erro do login e fica no passo `signup-details`. Cenário: o usuário clica "Criar conta" de novo →
agora o register devolve **409 "E-mail já cadastrado."** → a tela de cadastro afirma que o
e-mail já existe **sem oferecer nenhum caminho**. A conta existe e a senha está correta, mas a
UI parece dizer que o cadastro falhou e ao mesmo tempo que já existe.

## X14 · Re-solicitação após recusa é inalcançável pela UI
Severidade **MÉDIA**

O backend implementa exatamente o que o `AGENTS.md` promete (upsert reabre a mesma linha,
`connections.repository.ts:109-115`), mas `app/profissionais/page.tsx:185-188` renderiza um
`StatusBadge` sempre que existe **qualquer** status — inclusive `RECUSADA` — no lugar do botão
"Enviar mensagem". Cenário: o profissional recusa por estar no limite; um mês depois o aluno vê
o card com o selo "Recusada" e **nenhum botão** — o caminho documentado de re-solicitação só
existe via API. Também não há endpoint de cancelamento pelo aluno (documentado como estado atual).

## X15 · "Recusar" solicitação: ação irreversível sem confirmação
Severidade **MÉDIA** · **[AUTZ]**

`app/personal/solicitacoes/page.tsx:103-109` — o botão "Recusar" fica colado no "Aceitar" e
dispara no **primeiro clique**. Recusar grava `RECUSADA`, notifica o aluno e fecha a thread
(mensagens passam a dar 409); **só o aluno** pode reabrir, e nada na UI do Personal desfaz. Todo
o resto do app usa confirmação inline em duas etapas (`RemoveAlunoButton`, `RevokeInviteButton`,
`DeleteProgramButton`, `DeleteUserButton`, `DeleteAccountCard`). Cenário: Personal com dois
cards no celular erra o toque → o aluno recebe a notificação de recusa, a conversa fecha, e o
lead é perdido sem reversão.

## X16 · `ClientInvite` ficou fora do cascade de exclusão de usuário
Severidade **BAIXA-MÉDIA**

`src/admin/AGENTS.md` avisa: *"If you add a NEW table with a `userId`-style column, you must add
it to this cascade by hand"*. O model `ClientInvite` (`prisma/schema.prisma:284-298`, com
`personalId` e `consumedByAlunoId`) **não está** em `deleteUserCascade`
(`src/lib/user-deletion.ts:38-140`).

Cenário: Personal P cria um convite e o admin apaga a conta de P. A linha do convite sobrevive;
`GET /api/client-invites/preview` ainda responde `valid: true` (com `professionalName` caindo no
fallback "seu profissional"); quem clicar se cadastra, `tryConsume` marca consumido **antes** do
`createRelation` (**F2**), o `createRelation` falha em "Profissional não encontrado" e o convite
fica queimado sem vínculo.

## X17 · Responder dúvida continua permitido depois do vínculo terminar
Severidade **BAIXA-MÉDIA** · **[AUTZ]**

`addMessage` (`support.service.ts:71-108`) valida participação mas **não revalida
`ClientRelation`**, diferente de `createThread`. Cenário: Personal desvincula o aluno e continua
trocando mensagens na thread antiga, e o aluno segue recebendo notificação `support_reply` de
quem não é mais profissional dele. O `AGENTS.md` descreve o gate de vínculo só na criação —
ambiguidade de intenção mais que violação; vale decisão de produto.

## X18 · Aluno pode fechar o resumo do treino e a sessão "renascer"
Severidade **MÉDIA** — consequência de uso do **Fr1**. Do ponto de vista da intenção da Fase 89
(cronômetro com início explícito + guard-rail de inatividade), concluir o treino é o fim da
sessão — mas o estado em memória sobrevive, então o app volta a perguntar "Ainda está
treinando?" pra um treino já concluído, e pode concluí-lo de novo sozinho.

## X19 · `emailVerifiedAt` não gate nada, e a intenção está documentada em 3 versões diferentes
Severidade **BAIXA**

`emailVerifiedAt` só é lido em `auth.service.ts:168,188` e `admin.service.ts:672` — o middleware
não olha. Uma conta com e-mail não confirmado tem acesso funcional completo (criar treinos,
pedir vínculo, iniciar o trial Premium). `src/auth/AGENTS.md` trata como esperado (só banner),
`MASTER_SPEC.md:45` ainda declara "Verificação de e-mail: **pendente**", e o comentário de
`alunoTrialUsedAt` justifica o abuso por múltiplas contas com "mesma limitação já registrada
sobre não haver verificação de e-mail hoje". **Não é bug de código** — é intenção documentada em
3 versões, o que torna arriscado alguém "corrigir" numa direção sem ver as outras duas.

## X20 · "Esqueci minha senha" já é o fluxo de "adicionar senha" que a doc diz não existir
Severidade **BAIXA**

O comentário de `loginOrRegisterWithGoogle` (`:399-400`) diz que a conta Google só entra por
Google "a menos que defina uma senha depois por um fluxo futuro de 'adicionar senha'". Cenário:
conta só-Google pede reset → recebe o link → define senha → passa a logar pelos dois.
Comportamento defensável (prova posse do e-mail), mas é uma **suposição documentada que já não
vale** — relevante porque a Fase 77 usa "conta Google não tem senha" como premissa em `login`,
`deleteMyAccount` e `changePassword`.

## X21 · Desvios de documentação (não são bugs, mas enganam quem for mexer)
Severidade **BAIXA**

- `src/notifications/AGENTS.md:82` diz que a contagem faz poll de **30s**; o código faz **6h**
  (`notification-bell.tsx:73`, mudança deliberada do item 109 do MASTER_SPEC). É justamente a
  doc que um agente leria antes de mexer no custo de banco.
- `src/admin/AGENTS.md` afirma que o 403 é *"Verified by `admin.test.ts` (`it.each` over **every**
  `/api/admin/*` path)"*. O `it.each` real cobre **5 caminhos GET**
  (`admin.test.ts:106-112`); as **17 rotas de escrita não estão**. Verifiquei o `assertAdmin` em
  cada handler individualmente — **não há vulnerabilidade** —, mas a doc superestima a rede de
  proteção contra regressão, e o erro clássico (esquecer o `assertAdmin` num handler novo) não
  seria pego por teste.
- `src/admin/AGENTS.md` diz que o único log de escrita é `ROLE_CHANGE`; hoje são 4
  (`ROLE_CHANGE`, `USER_DELETE`, `PREMIUM_TOGGLE`, `EMAIL_VERIFIED_BY_ADMIN`). As escritas de
  catálogo (criar/editar/apagar exercício, template, banner, tag) **não geram registro** —
  coerente com o texto, mas vale saber que "apagou o exercício X" é irrastreável.
- `BILLING_SETUP.md:9-10,156-158` registra que **o cancelamento nunca foi testado em produção,
  nem em modo teste** ("Faltou só testar o cancelamento em si"). A cobertura é só automatizada.

---

# Apêndice — verificado e CORRETO (pra não re-auditar)

Registrado porque custou tempo confirmar e evita retrabalho numa próxima varredura.

**Webhook do Stripe**: a verificação de assinatura usa os bytes crus de verdade
(`src/app.ts` addContentTypeParser → `request.rawBody`; `billing.controller.ts:32-44`) e **falha
fechado** em todos os caminhos (sem secret → 500 antes de tocar o corpo; sem header → 400; sem
rawBody → 400; `constructEvent` lançando → 400 sem executar lógica). O proxy do frontend
(`app/api/[...path]/route.ts:74,81`) repassa `arrayBuffer()` e preserva `stripe-signature` — a
assinatura sobrevive ao hop. O guard de reordenação `stripeSubscriptionId !== sub.id` existe em
`updated` e `deleted`. `checkout.session.completed` com `payment_status: "unpaid"` não concede
plano. **Nenhum lugar confia em claim de plano dentro do JWT** — todo gate relê o banco.

**Admin**: todas as 22 rotas de `/api/admin/*` têm `preHandler: [authenticate]` **e**
`assertAdmin` no handler (conferido linha a linha). `updateUserRole` valida contra o enum,
bloqueia auto-edição e a remoção do último ADMIN. Nenhum hash/token vaza: `findUsersPage` usa
`select` explícito e as 3 rotas que devolvem `User` passam por `toSafeUser`. Nenhum dado de
cartão existe no schema (Stripe hospedado). `revertExpiredPersonalPlan` também usa `select`
explícito por esse motivo.

**Notificações**: sem furos. As 4 rotas derivam o usuário de `request.user.sub`, **nunca** do
corpo/params; `markRead` compara `notification.userId === userId` (404 em mismatch);
`markAllRead` usa `updateMany` filtrado por `userId`. Não existe caminho pra ler ou marcar
notificação de terceiro, e `notify()` só é chamado internamente.

**Suporte**: aluno não lê thread de outro aluno, e a autorização do profissional é pelo
`personalId` **daquela thread** (não "qualquer profissional vinculado ao aluno"). Criar thread
exige `ClientRelation`.

**Conexões**: `@@unique([personalId, alunoId])` impede vínculo duplicado por dupla aceitação (o
efeito é o estado preso do **C1**, não duplicidade). Posse respeitada em aceitar/recusar/
mensagens. Elegibilidade no diretório cumprida como documentado (role + `availableForNewStudents`
+ `planoAssinatura != FREE`, PLUS antes de BASE) — com as ressalvas de **B7** e do
`createRequest` que não checa plano.

**Regra da Fase 62** ("só se aplica um TEMPLATE"): consistente ponta a ponta — `apply()` rejeita
`!source.isTemplate` (403), `saveInstanceAsTemplate` valida posse + origin + isTemplate,
`applyCatalogTemplate` também exige `isTemplate`, e a UI espelha (só templates mostram "Aplicar",
só instâncias mostram "Salvar como template"). **Nenhuma brecha.**

**Gate da Fase 103**: escopo confirmado correto — bloqueio em `createWorkout`, `addExercise`,
`apply`, `applyCatalogTemplate`, `addSession`; leitura do Personal e do admin nunca bloqueada;
acesso do aluno gated por `program.personalId` (não pelo usuário autenticado), com
`personalId === null` sempre liberado (coerente com `origin: SELF`).

**Aluno Premium**: coerente com "guardrails apenas" — não existe checkout
(`stripeAlunoSubscriptionId` não é escrito por nada), trial é ALUNO-only, uma vez por conta, com
`alunoTrialUsedAt` gravado na **mesma escrita** do acesso (sem janela de corrida), e
`computeEntitlement` rederiva sempre de `expiresAt > now`. A separação "Aluno Premium ≠ plano do
profissional" está respeitada em todo o código lido; o gate de templates Premium do Personal é
um conceito distinto (`planoAssinatura !== "PLUS"`, código `PREMIUM_TEMPLATE_REQUIRED`).

**i18n**: `pt.json`, `en.json` e `es.json` têm **exatamente as mesmas 1039 chaves** (verificado
por script). Todos os `t(...)` de `app/`, `components/`, `lib/`, `i18n/` conferidos contra
`pt.json`, incluindo as 14 chaves dinâmicas (`` t(`roles.${roleKey}.cardTitle`) `` etc.) — todos
os valores possíveis existem. **Nenhum achado.**

**Frontend, outros**: divisão por zero protegida em `voltage-bar.tsx:35-36` e
`nimbus/dashboard/page.tsx:28`; recharts sempre em `ResponsiveContainer width="100%"`; as duas
únicas `<table>` estão OK (`politica-de-privacidade` tem `overflow-x-auto`); todos os botões
só-ícone encontrados têm `aria-label`; todos os `new Date(...)` exibidos estão atrás de guard;
acessos indexados (`exercises[0]?.id`, `messages[0]?.text`, `sessions[length-1]?.letter`) estão
guardados; `nimbus/usuarios/page.tsx:430-484` já usa `overflow-x-auto` + `min-w-0` + `truncate`.
Ações destrutivas com confirmação em duas etapas: `DeleteProgramButton`,
`ExerciseDeleteButton`, `RemoveAlunoButton`, `RevokeInviteButton`, `DeleteAccountCard`. O menu
hambúrguer (`app-header.tsx:190`) ainda usa `absolute right-0 w-56` mas, medido no header real,
**cabe** de 320px pra cima. **Nenhuma invalidação de prefixo largo demais** foi encontrada.

**Cookies**: `secure` depende de `NODE_ENV === "production"`, confirmado em `Dockerfile:34` e
`infra/cloud_run.tf:49,186` — sem achado. `Set-Cookie` repassado corretamente pelo proxy
(`getSetCookie()`).

---

# Pendências de verificação

Itens que os auditores explicitamente **não** fecharam:

1. **Existe `SetLog` referenciando `WorkoutExercise` de templates SELF/`PERSONAL_CATALOG`?**
   Determina se `deleteSelfTemplate` pode de fato falhar por FK (o bug de erro silencioso,
   **C6**, existe independentemente). Faltou ler o caminho de "aplicar template" pra saber se
   copia as linhas ou reaproveita.
2. **O backend rejeitaria o `null` de altura/peso** vindo do `NaN` da anamnese (**Fr20**)?
3. **O Stripe emite `subscription.updated` a cada avanço de período?** Determina se o cenário B
   de **B7** (admin revoga plano de assinante ativo) se autocorrige com o tempo ou não.
4. **O Nutricionista tem alguma tela de perfil que permita ligar `availableForNewStudents`?**
   Só foi confirmado que `PUT /api/professionals/me` aceita o papel no backend.
5. **Nada foi reproduzido em runtime.** Os itens **A1**, **A5** e **X9** se beneficiariam de
   confirmação empírica (logs de 500 em `/refresh` e `/login`; teste real com 2 dispositivos).
   `gcloud` está disponível nesta máquina via `wsl -d Ubuntu -- bash -lic "gcloud ..."` (ver
   `AGENTS.md`), então os logs de produção são acessíveis se você quiser fechar esses três.

---

# Apêndice — resolução (Fase 107, 2026-07-31)

Depois desta auditoria, o fundador autorizou corrigir na sequência de prioridade acima, com uma
ressalva: **NUTRICIONISTA é papel descontinuado** (sem UI, sem previsão de uso futuro) — achados
que só existem por causa dele foram avaliados achado-a-achado em vez de construir feature nova
pra um papel morto. Trabalho feito em 5 lotes/commits na branch
`fix/fase107-auditoria-billing-authz-frontend` (billing → auth → fitness → connections/admin/
support → frontend), cada um com testes novos, `tsc --noEmit` limpo nos dois lados e suíte
completa verde antes do commit seguinte. Resumo narrativo no STATUS.md, Fase 107. Abaixo, o
mapeamento achado-a-achado.

## Corrigidos

**Seção 1 — Alta**: B1, B2, B3, F1, A2 (código; ver ressalva abaixo), A3, X1, C1, Fr1, Fr2, Fr3.
**Seção 1 — Média**: B5, B7/C2, B9, B10, B12 (dentro do achado B-cluster, ver `billing.service.ts`),
F3, F4, F9, F10, F11, A1, A5, A6, A7, A9 (ordem trocada; o vazamento de mensagem do Resend em
`resendVerificationEmailHandler`, mesmo achado, não foi tocado — ver pendências), A11 (parte do
mesmo commit de A6), C3, C5, Fr4, Fr5, Fr6, Fr7, Fr9, Fr10, Fr11, Fr12, Fr15, Fr16, X4, X7, X8.
**Seção 1 — Baixa**: C9, C10, C11, Fr17 (=F14), Fr18, Fr19, Fr20, A10 (google-sign-in-button retry).
**Seção 2**: X1 (fluxo "prescrever treino" — o único que era brecha de autorização; os outros 4
fluxos do papel Nutricionista continuam sem UI, ver "Não corrigido" abaixo), X7, X8.

## Corrigido parcialmente (na Fase 107 — fechado na Fase 108, ver abaixo)

- ~~**Fr13/C8** — só os itens de `/profissionais`... `meu-treino-pessoal/page.tsx`/`criar/page.tsx`
  (`replaceMutation` sem `onError`).~~ **Fechado na Fase 108** (ver apêndice abaixo).
- **Fr14** — `template-preview-dialog.tsx` (usado em `/personal/programas`) e
  `meu-treino-pessoal/page.tsx` ganharam `isApplying`/mensagem de erro visível na Fase 107;
  `replace-self-template-dialog.tsx` (troca de treino pessoal ativo) ganhou o mesmo tratamento
  na Fase 108.
- ~~**A9** — só a ordem... O vazamento de mensagem crua do Resend em
  `resendVerificationEmailHandler` não foi tratado.~~ **Fechado na Fase 108.**

---

# Apêndice — resolução (Fase 108, 2026-07-31, mesmo dia)

Segunda rodada, pedida logo em seguida ("inicie a próxima rodada de correções"), fechando os
itens que a Fase 107 tinha deixado como "parcial" ou "não corrigido" por não exigirem schema
novo, decisão de produto, nem tocar no papel Nutricionista. Branch
`fix/fase108-auditoria-queries-silenciosas`, 1 commit, testes novos não adicionados (mudanças de
UI/mensagem de erro, cobertas pela suíte existente — nenhuma lógica de negócio nova), `tsc
--noEmit` limpo nos dois lados, 37/37 suítes backend (559 testes) e 8/8 frontend (52 testes)
verdes antes do commit.

**Corrigidos nesta rodada**: **C6** (`/nimbus/treinos-pessoais` — `detailQuery`/`addSessionMutation`/
`deleteMutation` agora mostram erro visível em vez de painel vazio com botões ainda ativos);
**C7** (`notification-bell.tsx` — `listQuery.isError` e erro de `markRead`/`markAllRead`
visíveis, antes dropdown ficava em branco); **Fr13 restante** (`dashboard/page.tsx`:
`myPersonalsQuery`/`weeklySummaryQuery`; `personal/alunos/page.tsx`: `programsQuery`/
`invitesQuery`; `personal/dashboard/page.tsx`: `threadsQuery`, tratamento mais leve por ser
Baixa severidade; `duvidas/page.tsx`: `personalsQuery`); **Fr13/Fr14** (`replaceMutation` em
`meu-treino-pessoal/page.tsx` e `criar/page.tsx` — `ReplaceSelfTemplateDialog` ganhou prop
`errorMessage`, mesmo padrão já usado em `template-preview-dialog.tsx`); **A9 restante**
(`sendVerificationEmail` agora checa o retorno booleano de `sendMail` — falha silenciosa por
falta de `RESEND_API_KEY` deixa de responder "reenviado" com sucesso falso —, e
`resendVerificationEmailHandler` só expõe `error.message` ao cliente quando o erro já tem
`statusCode` setado pelo domínio, evitando vazar texto cru do provedor Resend).

**Ainda não corrigido desta mesma família** (baixo valor pra continuar agora): `nimbus/
treinos-pessoais/page.tsx` — editores de nome/tradução de sessão/template já tinham erro visível
antes desta rodada (não fazem parte do C6); a listagem de mensagens de `conversation-thread.tsx`
e os 4 itens de `/profissionais` já tinham sido fechados na Fase 107, não nesta.

## Deliberadamente NÃO corrigido — Nutricionista descontinuado

Avaliado explicitamente com o fundador: não compensa construir UI nova pra um papel sem uso
previsto. **F6** (sem tela de desvincular aluno) e os 4 fluxos restantes de **X1** (upgrade,
solicitações, dashboard lendo o store) continuam exatamente como descritos na auditoria — só o
fluxo de prescrição de treino (que era uma brecha de autorização, não só UI faltando) foi
fechado.

## Deliberadamente NÃO corrigido — outros

- **C4** (corrida de limite de alunos em aceite duplo-clique) — precisa de constraint de banco
  ou transação serializável com retry; risco real é uma janela estreita, esforço/risco da
  correção robusta desproporcional. Mesmo padrão de decisão já usado na Fase 101 pra um caso
  parecido.
- **B4, B6, B11, B13** — baixo risco/raro (B4 depende de troca de Price nunca feita ainda;
  B6/B11 são estado inconsistente sem vazamento de recurso pago; B13 é corrida de milissegundos
  sem impacto prático observável). **B8 foi corrigido** (só faltou listar aqui antes): checklist
  e configuração documentada de `BILLING_SETUP.md` atualizados pra incluir `invoice.payment_failed`
  nos eventos do webhook (teste e live) — o handler já existia desde a Fase 103, só a doc/checklist
  de ativação tinham ficado pra trás.
- **F2/A4** (convite consumido antes de criar vínculo) — mesma família do fix aplicado em
  **F2/A4 do fitness** (`clientInvitesRepository.unconsume`), então este item específico FOI
  corrigido; mantido aqui só pra registrar que o retorno `{reason}` nos 3 callers de auth
  continua sendo ignorado (a UI não mostra o motivo específico da falha de consumo).
- **F7, F8, X2, X3, X5, X6, X9-X21** — nenhum é uma correção de poucas linhas: X9 exige tabela de
  sessões/refresh tokens nova (schema), X2/X3/X6 são lacunas de produto (estado de billing sem
  tela dedicada), X5 é uma decisão de design já documentada como intencional (só o e-mail cru no
  payload, mascarado na UI), X15/X13/X14/X20 são UX que precisam de validação de produto antes de
  mexer. Ficam para uma fase futura dedicada a UX de billing/sessão, fora do escopo "corrigir bug"
  desta auditoria.
- **F5/X18** — resolvidos como efeito colateral do fix de **Fr1/Fr4** (mesma raiz de código); não
  houve trabalho dedicado a eles além disso.

## Ressalva em aberto — A2 (checagem de duplicata em produção)

A normalização de e-mail (código) foi implementada e testada — é retrocompatível e correta
independente do resultado da checagem. Mas o pré-requisito acordado com o fundador antes de
normalizar (rodar uma query **somente-leitura** em produção pra checar se já existem contas com
o mesmo e-mail em caixas diferentes) **não foi concluído**: o classificador de segurança do
Claude Code bloqueou a re-tentativa de acesso ao banco depois de uma primeira consulta com nome
de tabela errado. **Se existirem duplicatas de fato**, a normalização faz `findByEmail` passar a
casar as duas linhas pelo mesmo e-mail normalizado — pode mudar qual conta um login encontra
primeiro. Rodar a checagem (manualmente, ou com permissão explícita pro agente tentar de novo)
antes de considerar A2 100% fechado.

---

# Apêndice — checagem de consistência pós-correções (Fase 109, 2026-07-31, mesmo dia)

Depois das Fases 107/108 (todo o lote de correções da auditoria), pedido explícito de uma
checagem rápida e rasa (não uma nova auditoria) só atrás de **inconsistências causadas por
combinar as correções entre si** — uma correção mudando uma premissa que outra correção, feita
num commit diferente, ainda assumia verdadeira. 4 agentes em paralelo, um por área (billing/
plan-expiry, auth, fitness/connections/admin/support, frontend), cada um comparando
`git diff` do intervalo inteiro contra o estado atual. 7 achados reais, verificados manualmente
antes deste relatório. Todos corrigidos na sequência, branch `fix/fase109-consistencia-pos-correcoes`.

**Corrigidos:**

1. **`/personal/upgrade` sem saída pra quem está em `past_due`** — combinação B1+B10: o downgrade
   não-terminal (B1) passou a manter `stripeSubscriptionId` mesmo caindo pra `planoAssinatura:
   "FREE"`, mas a tela só decidia "assinar" vs. "gerenciar pelo Portal" pelo `tier` (`isPago`) —
   nunca lia `hasSubscription` (já existia na API desde a Fase 93, nunca consumido). Resultado:
   via os botões de assinar, clicava, e o guard novo do B10 rejeitava com "gerencie pelo Portal",
   sem nenhum botão de Portal visível. Corrigido: o gate virou `hasSubscription` (mesma condição
   que o backend usa pra bloquear checkout), com título/descrição própria pro caso "FREE mas com
   assinatura pendente de atenção" (`assinaturaPendenteTitulo`/`assinaturaPendenteDescricao`/
   `gerenciarAssinaturaPendenteDescricao`, novas chaves em pt/en/es).
2. **F12 (`firstMissingKey`) só tinha sido aplicado em 1 das 3 telas com o mesmo bug** — as duas
   telas de sessão (`meu-treino-pessoal/[id]/sessoes/[sessionId]` e `personal/programas/[id]/
   sessoes/[sessionId]`) continuavam usando só `nextKeyInSequence`, escondendo o botão "Próximo"
   inteiro quando a sessão aberta é a última na ordem do esquema, mesmo com dias/letras livres
   mais cedo na sequência (ex: WEEKDAY com só SEGUNDA+DOMINGO, abrindo DOMINGO). Corrigido com um
   fallback: usa a posição seguinte quando existe; só cai no `firstMissingKey` (primeira lacuna
   real) quando não há próximo posicional — preserva 100% o comportamento comum (navegar pra
   sessão já criada) e só fecha o caso de borda.
3. **`TemplatePreviewDialog` em `/meu-treino-pessoal` não recebeu o padrão Fr14/Fr16** — o
   componente ganhou `isApplying`/`errorMessage` nas Fases 107, mas esta tela continuava fechando
   o diálogo no clique, antes de saber se a mutation deu certo (`previewTemplate.apply();
   setPreviewTemplate(null);` os dois síncronos). Corrigido: o diálogo só fecha em sucesso real
   (dentro de `onApplySuccess`) ou quando um 409 abre o diálogo de troca (fechado explicitamente
   ali, pra evitar 2 overlays `fixed inset-0` abertos ao mesmo tempo — mesmo cuidado já usado
   nesta tela pra outro fluxo); qualquer outro erro mantém o diálogo aberto com a mensagem visível.
4. **`personal/programas/[id]/sessoes/[sessionId]` ainda liberava NUTRICIONISTA na UI** —
   `AuthGuard allowedRoles={["PERSONAL","NUTRICIONISTA"]}`, enquanto as telas irmãs já tinham sido
   restritas a `["PERSONAL"]` quando o X1 fechou a brecha de autorização. Não era brecha de
   segurança (backend já rejeitava com 403), só experiência confusa. Corrigido pra `["PERSONAL"]`.
5. **Código morto**: `adminRepository.updateUserRole` (a versão antiga, 2 escritas
   independentes) não tinha mais nenhum chamador desde que C5 trocou pra
   `updateUserRoleWithAuditLog` — removido.
6. **Comentário desatualizado em A5**: citava "falha ao checar lembrete de pagamento" como o
   cenário motivador do guard "só 401 conta como tentativa falha" — mas o A1 (mesma leva) já
   blindou essa checagem específica com try/catch, então esse cenário não pode mais acontecer.
   Comentário corrigido pra explicar que o guard continua útil como defesa geral, e que o
   exemplo original foi fechado separadamente.
7. **`client-invites.controller.ts#handleError`** não incluía `code` no corpo do erro, diferente
   dos outros controllers de fitness tocados pelo F3. Inofensivo até aqui (nenhum erro deste
   domínio seta `.code`), mas inconsistente — corrigido pro mesmo formato.

`tsc --noEmit` limpo nos dois lados, 37/37 suítes backend (559 testes), 8/8 frontend (52 testes)
verdes antes do commit. Sem testes novos (nenhuma lógica de negócio nova — ajustes de gate de UI,
remoção de código morto e correção de comentário).
