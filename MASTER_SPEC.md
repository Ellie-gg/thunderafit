# ThunderaFit — Master Specification V2

> **Este documento substitui integralmente o "Master Specification & Roadmap V1"** (que
> vivia fora do repositório e acumulou contradições — ex: "Nutrição não existe no MVP"
> após as Fases 11/17 a implementarem, seções duplicadas da Fase 20). A partir de agora
> o Master Spec **vive no repo** (`MASTER_SPEC.md`, raiz) e é atualizado junto com o
> código. O histórico fase-a-fase com evidências continua no `STATUS.md`; este documento
> descreve **o estado vigente e a direção**, não o diário de execução.
>
> Gerado na **Fase 23 (Análise Estratégica, 2026-07-17)** por Claude Opus 4.8 — inclui as
> decisões do pivô híbrido B2B2C + B2C validadas com o fundador.

---

## 0. Como trabalhamos (vigente desde 2026-07-18)

- **Fases pequenas.** Uma responsabilidade por fase — nunca "faça o pivô B2C inteiro" de uma vez. Cada fase é pequena o suficiente pra revisar e testar isoladamente.
- **Modelo + esforço sugeridos por fase.** Antes de começar uma fase nova, o executor (Claude) sugere o nível de esforço (baixo/médio/alto) e o modelo mais adequado:
  - **Haiku 4.5** — mudanças mecânicas, baixo risco, sem decisão de arquitetura (rename, copy, remoção de código morto).
  - **Sonnet 5** — padrão para a maioria das fases (features, bugfixes, telas novas).
  - **Opus 4.8** — decisões de arquitetura com raio de alcance amplo, ou código sensível a segurança/dinheiro/autorização (ex: guards de authz, billing).
- **Arquitetura pensando em reusabilidade.** Módulos e funções que não são fitness-specific (upload/compressão de imagem, geração de link de convite, rate limiter, etc.) devem ser escritos de forma portável — nomeados e organizados como se fossem servir outro projeto sem reescrita, não acoplados ao domínio por conveniência.
- **`STATUS.md` é um log macro** (1-3 linhas por fase, sem evidência bruta) — a evidência real (testes rodados, comandos, saída) fica na conversa de execução daquela fase, não arquivada aqui.
- **`MASTER_SPEC.md` é a fonte de verdade viva** do estado técnico e das decisões — atualizado junto com o código, nunca deixado com seções placeholder por muito tempo.

---

## 1. Visão de Produto (V2 — Pivô Híbrido)

O ThunderaFit deixa de ser exclusivamente B2B2C (Personal Trainer prescreve para alunos
convidados) e passa a operar em **modelo híbrido**:

| Modo | Usuário | Proposta de valor |
|---|---|---|
| **B2B2C (existente)** | Personal Trainer | Gerencia alunos, prescreve programas de treino (templates A–E), acompanha execução/carga. Freemium: 3 alunos grátis → plano pago R$ 9,90/mês (50 alunos). |
| **B2C — Aluno Solo (novo)** | Qualquer pessoa | Auto-cadastro; cria e gerencia as próprias rotinas, registra cargas livremente; futuramente adquire programas prontos (marketplace de conteúdo). |
| **Coexistência** | Aluno com Personal | Mantém as prescrições oficiais do Personal **e** rotinas próprias paralelas, sem que uma polua a outra. Se um solo contratar um Personal depois (via Descoberta, Fase 21), o histórico antigo convive com as novas prescrições. |

**Fora do escopo (decisões vigentes):**
- **Nutrição/Nutricionista:** código **dormente** (backend/schema/telas `/nutricionista/**`
  intactos e funcionais; UI de entrada removida desde a Fase 18). Não deletar — decisão
  de 2026-07-17: custo zero de manutenção, reversível se o modelo de negócio voltar.
- **Split de pagamento aluno→profissional:** continua explicitamente fora (complexidade
  regulatória/KYC).
- **Verificação de e-mail / recuperação de senha:** pendente; o mecanismo de auth já
  suporta adicionar sem retrabalho estrutural.

---

## 2. Arquitetura Técnica Vigente

### 2.1 Stack (implementada, em produção)

| Camada | Escolha |
|---|---|
| Backend | Node.js + TypeScript + **Fastify** (`trustProxy`, rate limit de login em memória) |
| Banco | **PostgreSQL** — produção no **Neon** (pooled/PgBouncer), local via docker-compose |
| ORM | **Prisma** (schema único `prisma/schema.prisma` seccionado por domínio; 14 migrations aplicadas) |
| Auth | JWT access (15min) + refresh (7d) em **cookies httpOnly** (`Secure`, `SameSite=Lax`); rotação de refresh com detecção de reuso; cookie tem prioridade sobre header `Authorization` (o proxy de produção injeta ID token do Google nesse header) |
| Frontend | **Next.js App Router** (`output: standalone`; `export` gated por `CAPACITOR_EXPORT`) + Tailwind + shadcn/ui + Zustand (perfil não-sensível em `localStorage`) + TanStack Query |
| Design system | **"Voltagem"**: storm + dourado/ciano/violeta/azul-admin, Unbounded/Manrope/IBM Plex Mono, `VoltageBar` como assinatura; acento por papel |
| Mobile (spike) | **Capacitor 8** scaffold no repo (`frontend/android/`): `server.url` → produção (same-origin), `CookieManager.flush()` no lifecycle. Viável com ajuste; teste de cold start pendente (`frontend/CAPACITOR_SPIKE.md`) |
| Billing | **Stripe Checkout hospedado** (código completo e testado com cripto real; **inerte em produção** até env `STRIPE_*` — `src/billing/BILLING_SETUP.md`). Webhook com verificação de assinatura sobre raw body; entra pela URL pública do frontend (backend é IAM-restricted) |
| Infra | **GCP via Terraform** (`infra/`): Cloud Run ×2 (backend IAM-restricted + frontend público com proxy server-side autenticado), Artifact Registry, Cloud Build (CD no push em `main`, path filters), Secret Manager, alerta de orçamento. Neon fora do Terraform de propósito |
| Testes | 175 backend (Jest/Supertest) + 22 frontend (Jest/RTL) + 20 E2E (Playwright, backend real) — contagem da Fase 26; a Fase 27 não rodou suíte (ver Seção 7/STATUS.md) |

### 2.2 Padrão: Monolito Modular "Domain-First"

```
/src
  /auth          registro, login, JWT/refresh, rate limit  [não tocar sem gate]
  /fitness       exercícios (~232, incl. categoria "treino em casa"), programas
                 (templates A–E, cópia-ao-aplicar), treinos, séries/SetLog,
                 relations (vínculo + limite Freemium)
  /connections   descoberta de profissionais (perfil público opt-in, busca por
                 localização, ConnectionRequest com aprovação manual)
  /billing       Stripe Checkout/portal/status/webhook (assinado)
  /progress      agregações de carga/frequência sobre SetLog
  /anamnesis     questionário de saúde (aluno escreve; profissional vinculado lê)
  /support       dúvidas aluno↔profissional (threads com status)
  /notifications in-app (sino); push real fora de escopo
  /admin         painel /nimbus: métricas, usuários (+ edição de role), logins, SLA,
                 CRUD do catálogo de exercícios, AdminAccessLog, AdminAuditLog
  /nutrition     DORMENTE (funcional, sem UI de entrada)
```

Cada domínio: `routes/ → controllers/ → services/ → repository (Prisma)`.
Autorização: posse comparada ao `sub` do JWT no service; ids de cliente só são
confiados sob `role === ADMIN` (visão ampliada, leitura). Roles: `PERSONAL`, `ALUNO`,
`NUTRICIONISTA` (dormente), `ADMIN` (sem auto-cadastro; bootstrap via `seed-admin`).

### 2.3 Modelo de dados vigente (essencial)

- `users`: role, planoAssinatura (`FREE`/`PAGO`), limiteAlunos (3/50), lastLoginAt,
  stripeCustomerId/@unique + stripeSubscriptionId, availableForNewStudents/location/bio.
- `ClientRelation` (personalId, alunoId, professionalType) — vínculo + limite por profissional.
- `ConnectionRequest` (aluno→profissional, PENDENTE/ACEITA/RECUSADA; aceite cria a relation).
- `WorkoutProgram` (personalId, isTemplate, alunoId?) → `Workout` (programId, personalId,
  alunoId?, letter A–E, lastCompletedAt) → `WorkoutExercise` → `SetLog`.
  Aplicar template = **cópia**, nunca referência. `suggestedNext` = menor letra nunca
  concluída; senão a de conclusão mais antiga (sem ordem forçada).
- `Exercise` (~232, `muscleGroup`/`equipment` texto livre — não enum, listas de admin/
  gerador derivam do banco; difficultyLevel, mediaUrl/mediaType, CRUD via
  `/nimbus/exercicios` desde a Fase 33; categoria "treino em casa" via
  `equipment: "Peso Corporal"/"Itens Domésticos"` desde a Fase 50) · `Anamnesis` ·
  `SupportThread/Message` · `Notification` · `LoginLog` ·
  `AdminAccessLog` (acesso a anamnese) · `AdminAuditLog` (ações administrativas
  sensíveis, ex: mudança de role — Fase 33) · nutrição (dormente).

---

## 3. Decisão Arquitetural do Pivô: treinos do Personal vs treinos do Aluno Solo

> Resultado da análise adversarial da Fase 23 (workflow multi-agente sobre o código real).
> **Status: DECIDIDO, NÃO IMPLEMENTADO** — ver Fase 34 no roadmap (Seção 8). O workflow
> completou a fase de Draft e só 1 de 3 críticas adversariais — é uma recomendação bem
> fundamentada sobre o schema real, mas não foi stress-testada por completo antes de
> implementar.

- **Recomendação: schema UNIFICADO** (não tabelas separadas para treino do Personal vs.
  treino do Aluno Solo). `WorkoutProgram.personalId` já é nullable desde a Fase 16 —
  a mudança é aditiva: um novo enum `origin` (`PERSONAL | SELF | MARKETPLACE`) na
  `WorkoutProgram`, sem duplicar o domínio `/src/fitness`.
- **Salvaguardas obrigatórias (a implementar junto, não depois):**
  1. Toda listagem usada pelo Personal deve filtrar `origin: 'PERSONAL'` explicitamente
     (nunca "todos os programas do aluno") — recomendado um único helper de repository
     (ex: `findPersonalPrescriptions()`) que já embute esse filtro, em vez de cada
     endpoint escrever a where clause à mão.
  2. Guards que hoje comparam `workout.personalId !== userId` para negar acesso
     precisam tratar `personalId === null` como "não é do Personal, é do próprio aluno
     dono" — sem isso, o aluno solo cai num caminho de código pensado só pro B2B2C.
- **Esboço de migration:** aditiva — novo enum + coluna `origin` em `WorkoutProgram`
  com default `PERSONAL` (backfill automático dos registros existentes).

---

## 4. Monetização Híbrida (matriz da Fase 23)

- **B2B (Personal):** mantém o implementado — Freemium 3 alunos; pago R$ 9,90/mês ou
  R$ 95,04/ano (20% off), 50 alunos. Stripe Checkout (ativação pendente de chaves).
- **B2C (Aluno Solo):** **pendência de pesquisa real** — o workflow de deep-research da
  Fase 23 (38 agentes em paralelo) não produziu nenhum resultado aproveitável (`started`
  sem `result`). O benchmarking usado até aqui (Gym WP como referência principal) veio
  de busca direta em conversa, não de pesquisa formal. Sem matriz de preço fechada —
  ver Fase 38 no roadmap. **Atualização Fase 56:** o fundador definiu o preço inicial do
  "Aluno Premium" diretamente (sem pesquisa formal) — R$ 9,90/mês, teste grátis de 7
  dias (uma vez por conta), 30% off no compromisso trimestral. Desbloqueia hoje o
  carrossel PREMIUM de "Meu Treino Pessoal"; criar/editar o próprio treino é um degrau
  futuro do mesmo plano, ainda não implementado. Só os *guardrails* (entitlement +
  gate de aplicação) existem por enquanto — o checkout/Stripe real desta assinatura é
  deliberadamente adiado pra quando o pagamento entrar em produção (ver `src/billing/
  AGENTS.md`, seção "Aluno Premium").
- **Regra de lojas (anti-steering):** assinatura vendida na **web**; o app mobile apenas
  consulta o status sincronizado — nunca linka checkout externo de dentro do app. Regra
  já vigente (não muda com o pivô); pesquisa 2024-26 completa sobre o estado atual das
  regras das lojas segue pendente (mesma causa acima).

---

## 5. Roadmap Proposto

Ver **Seção 8 (Roadmap Priorizado)** — lista viva, atualizada a cada fase concluída/nova.

---

## 6. Governança: STATUS.md (regras vigentes)

1. Ler o arquivo inteiro antes de editar; entradas identificam o **modelo real** executor
   quando relevante.
2. `## Progresso Geral das Fases` existe **uma única vez** — reescrita completa, nunca append duplicado.
3. **Formato macro (desde 2026-07-18, Fase 0):** 1-3 linhas por fase, sem evidência bruta
   arquivada no arquivo. Testes/comandos ainda precisam ser rodados de verdade (a menos
   que o fundador explicitamente dispense, como na Fase 27) — a evidência fica registrada
   na conversa de execução, não no arquivo.

## 7. Pendências operacionais conhecidas (2026-07-17)

1. **Rotacionar a senha do Neon** (exposta em chat na Fase 16) e manter o Secret Manager
   como única fonte da credencial.
2. **Ativar billing**: criar os 4 produtos/prices (Base/Plus × mensal/anual) no Stripe
   (teste), setar env `STRIPE_*` (Secret Manager + Cloud Run), validar via
   `BILLING_SETUP.md` (atualizado pra 3 degraus em 2026-07-24).
3. **Spike Android**: rodar o teste de cold start em máquina com Android Studio.
4. Melhorias documentadas não aplicadas: idempotência por `event.id` no webhook,
   rate limit no webhook público, `AdminAccessLog` para progress.

---

## 8. Roadmap Priorizado (2026-07-18)

Cada item já vem com esforço e modelo sugeridos (ver regra na Seção 0). Uma fase de
cada vez — o fundador escolhe a próxima.

### Grupo A — polish imediato

1. **Fase 28 — Polish do formulário de exercício. ✅ CONCLUÍDA (2026-07-18).** Popup
   centralizado/maior; bug real do botão preso em "posição 1" corrigido (a tela de
   sessão invalidava a query errada); reordenar exercícios prescritos via
   `POST /api/workouts/:id/exercises/:exerciseId/move`. **Modelo usado: Sonnet 5.**
2. **Fase 29 — Tela "Treinos" consolidada. ✅ CONCLUÍDA (2026-07-18), redefinida em execução
   como "Hub de Administração do Aluno".** Nova tela `/personal/alunos/[alunoId]` reúne
   programas aplicados, evolução (carga/frequência, reaproveitando os componentes de
   `/evolucao`) e link pra anamnese. Pré-requisito corrigido: `/api/progress/*` ganhou
   um ramo PERSONAL/NUTRICIONISTA com checagem de `ClientRelation` (antes rejeitava com
   403 incondicional); `GET /api/workout-programs` ganhou filtro `?alunoId=`. A lista
   plana de "Treinos prescritos" no dashboard **não foi removida** nesta fase (fora do
   escopo do plano executado — corrigido na Fase 31 abaixo). **Modelo usado: Sonnet 5.**
3. **Fase 30 — Foto de perfil (aluno e Personal). ✅ CONCLUÍDA (2026-07-18).** Avatar
   circular no `AppHeader`; redimensionamento/crop quadrado no cliente (canvas, 256px,
   WebP/JPEG ~0.82) antes do upload. **Decisão de arquitetura tomada em execução: banco,
   não bucket** — o fundador pediu explicitamente pra manter simples no banco se o
   tamanho não fosse grande; com compressão no cliente o resultado fica na casa de poucos
   KB, então `User.avatarUrl String?` (data URI) é suficiente, sem custo de storage
   externo nem complexidade de upload multipart. Backend valida formato+tamanho de novo
   (nunca confia só no cliente). **Modelo usado: Sonnet 5.**
4. **Fase 31 — Consolidação: Dashboard Agrupado + Exclusão de Programas/Templates +
   Correção do Avatar. ✅ CONCLUÍDA (2026-07-18).** Três bugs reais relatados com
   screenshots do celular, corrigidos: (a) "Treinos prescritos" no dashboard do Personal
   passou a agrupar por `WorkoutProgram` (nome do programa como cabeçalho, sessões
   A-E/dias da semana aninhadas dentro), reaproveitando `listWorkoutPrograms()` já usado
   no hub do aluno; (b) `DELETE /api/workout-programs/:id` novo — apaga template OU
   instância aplicada (mesma checagem de posse de `apply`/`addSession`: 404 se não existe,
   403 se não é do Personal autenticado), cascata manual em transação
   (`setLog → workoutExercise → workout → workoutProgram`, já que nenhuma FK do schema
   tem `onDelete: Cascade`); componente `DeleteProgramButton` reutilizável (confirmação
   inline "Sim, excluir"/"Cancelar", sem modal) usado em `/personal/programas`
   (templates e aplicados), no hub do aluno e no novo card agrupado do dashboard; (c)
   causa raiz do avatar "não funcionava": o link "Perfil" do `AppHeader` só aparecia a
   partir do breakpoint `sm`, invisível no mobile — o próprio ícone circular virou um
   botão que abre um popover com `AvatarUpload`, alcançável em qualquer largura de tela.
   **Modelo usado: Sonnet 5.**

### Grupo A.2 — catálogo de exercícios: mídia + administração (priorizado antes do pivô B2C)

5. **Fase 32 — Infraestrutura de Mídia de Exercícios (bucket + player enquadrado). ✅ CONCLUÍDA (2026-07-18).**
   `Exercise.mediaUrl` hoje só resolve link do YouTube (embed via `frontend/lib/
   youtube.ts`), sem suporte a vídeo/GIF nativo. Diferente do avatar (Fase 30, banco
   OK pra blob pequeno e por-usuário), mídia de exercício é o perfil oposto — catálogo
   fixo (~150 registros), blob maior (até ~1MB), imutável, servido repetidamente pra
   TODOS os usuários — então vai pra **bucket GCS** (reaproveita o projeto GCP já
   provisionado via Terraform), não pro Postgres/Neon. Novo campo `Exercise.mediaType`
   (`YOUTUBE | VIDEO | GIF`); upload nativo com validação de formato/tamanho no backend
   (mesmo padrão de revalidação da Fase 30, nunca confia só no cliente). Frontend ganha
   um player enquadrado (não fullscreen) — `<video autoplay loop muted playsinline>`
   num container de aspect-ratio fixo — para vídeo/GIF nativo; YouTube continua com o
   fluxo de embed atual. **Conversão de vídeo→GIF avaliada e descartada**: GIF não tem
   compressão inter-quadro nem paleta >256 cores, infla um clipe H.264 de ~900KB pra
   5-12MB; upload nativo (MP4/WebM) com autoplay+loop replica a UX de GIF sem o custo.
   **Esforço: médio · Modelo: Sonnet 5.**
6. **Fase 33 — Admin: CRUD do Catálogo de Exercícios + Edição de Role de Usuário. ✅ CONCLUÍDA (2026-07-19).**
   `/src/admin` hoje é 100% leitura (dashboards); ganha camada de escrita em
   `/api/admin/exercises` (mesmo gate `assertAdmin`, rota separada da pública
   `/api/exercises` que continua somente-leitura) e `/nimbus/usuarios` ganha edição de
   role. **Sem tela de login nova** — `/nimbus` + `role === ADMIN` já é a base certa:
   `ADMIN` não tem auto-cadastro (`register` só aceita PERSONAL/ALUNO/NUTRICIONISTA) e
   só existe via `prisma/seed-admin.ts` rodado manualmente pelo fundador. Amarras contra
   o próprio fundador quebrar o catálogo: (a) categoria (`muscleGroup`, hoje string
   livre) vira dropdown das categorias já existentes no banco — criar categoria nova é
   uma ação separada e explícita, não digitação livre; (b) nome duplicado exato já
   barrado por `@unique` no schema — nomes **parecidos** (variação de espaço/acento/
   caixa) são normalizados e checados por similaridade, com aviso + confirmação
   explícita (não bloqueio duro, já que variações podem ser exercícios legítimos
   diferentes); (c) mídia validada (formato/tamanho, link do YouTube) antes de salvar.
   Edição de role de usuário: ação sensível, precisa de confirmação explícita e log
   (reaproveitar o padrão de auditoria já usado pra acesso a anamnese, `AdminAccessLog`,
   estendido pra cobrir mudança de role). **Esforço: médio-alto (escrita administrativa
   + guardrails) · Modelo: Sonnet 5, com atenção redobrada nos guards de auditoria.**


### Grupo B — fundação do pivô B2C

7. ✅ **Fase 34 — `WorkoutProgram.origin` + guards.** CONCLUÍDA (2026-07-23, registrada
   como "Fase 34" no STATUS.md — número livre lá, sem colisão). Migration aditiva do enum
   `origin` (`PERSONAL | SELF`, sem `MARKETPLACE` ainda), `personalId` (e `Workout.personalId`,
   achado só na auditoria — não estava documentado aqui) nullable, guards tratando
   `personalId === null`/`origin !== "PERSONAL"` como "não é do Personal, é do próprio
   dono", filtro explícito `origin: "PERSONAL"` nas listagens do Personal.
8. ✅ **Fase 34.5 — Meu Treino Pessoal (templates curados, free).** CONCLUÍDA (2026-07-23,
   também "Fase 34.5" no STATUS.md). Nova tela `/nimbus/treinos-pessoais` (admin cura
   templates `origin: SELF` usando exercícios `isFeatured`) + `/meu-treino-pessoal` (aluno
   escolhe e aplica, cópia igual Fase 16) — sem catálogo completo nem montagem livre.
   "Crie seu treino do zero" é placeholder visual sem lógica. CTA de upsell pós-treino SELF
   ficou só "Convide um Personal" (não "assinar PRO" — não existe plano pago pro aluno).
9. ✅ **Fase 36 — Dashboard do aluno com 2 blocos.** CONCLUÍDA (2026-07-24). **Registrada
   como "Fase 42" no STATUS.md** — o número "36" já estava em uso lá pra uma fase anterior
   não relacionada (PR em Tempo Real); o STATUS.md é a fonte cronológica autoritativa, essa
   seção é só o plano. "Prescrito pelo seu Personal" + "Meus treinos" (incluindo Fase 34.5)
   como blocos separados no dashboard, cada um com sua própria "próxima sessão"; card de
   convite copiável (mesmo padrão da Fase 12, invertido) quando o aluno não tem Personal
   vinculado (usa `GET /api/support/my-personals` já existente, não um endpoint novo).
10. ⏸️ **Fase 37 — Convite aluno→Personal.** ADIADA a pedido do fundador (2026-07-23): o
    `ConnectionRequest` aluno-inicia-vínculo **já existe desde a Fase 21** (achado na
    auditoria — a premissa original desta fase estava desatualizada). O pedido real era
    compartilhar o link de instalação do app com um Personal, o que só faz sentido após
    publicação nas lojas — **jogada pro roadmap futuro, junto da publicação Android/iOS**,
    fora de qualquer fase de código por ora.

Dois itens adicionais concluídos na mesma leva (2026-07-24), não planejados originalmente
nesta seção — registrados como **Fase 43** e **Fase 44** no STATUS.md:
- ✅ **Lembrete de pagamento.** Personal define uma data (+ recorrência mensal opcional)
  por vínculo (`ClientRelation.paymentReminderDueDate/Recurring`); checagem simples no
  login do aluno (sem cron/scheduler — este projeto não tem essa infra) dispara UMA
  notificação in-app via o domínio `notifications` já existente. Sem processamento de
  pagamento real.
- ✅ **Billing de 3 degraus (Free/Base/Plus).** `PlanoAssinatura` evolui de 2 estados
  (`FREE/PAGO`) pra 3 (`FREE/BASE/PLUS`): Free 3 alunos (como hoje), Base 20 alunos +
  acesso ao diretório de descoberta, Plus alunos ilimitados + destaque/prioridade no
  diretório. Webhook do Stripe passa a detectar o degrau comprado (`metadata.tier` no
  checkout; `price.id` atual da subscription pra trocas via Portal do Cliente). Bug
  corrigido: downgrade pra Free agora desliga `availableForNewStudents` (antes ficava
  ligado pra sempre). Valores em R$ são placeholder.
- ✅ **Montagem Inteligente (gera o PROGRAMA inteiro) + CTA de destaque no dashboard do
  Personal + card de programa simplificado.** Registrada como **Fase 45** no STATUS.md.
  Substitui a Fase 39 (cancelada acima). Correção de escopo no mesmo dia: a 1ª versão só
  gerava uma sessão avulsa — "gerar treino rápido" significa montar TODAS as sessões do
  esquema escolhido. `POST /api/workouts/generate` continua determinístico e por-sessão
  (grupos musculares, 1º = principal 3 exercícios, demais = secundários 2 cada +
  objetivo → séries/reps/descanso fixos; `level` só reordena preferência, não filtra
  rígido), mas o frontend agora o chama num wizard: setup (nome do programa + esquema
  Letras/Dias + objetivo, fixo pra todas as sessões) → por sessão, na sequência do
  esquema, gera/revisa/edita (ou pula, 0 exercícios) → "Próximo treino →" ou "Salvar
  programa de treinamento" (persiste tudo montado até ali, mesmo parando antes da
  última sessão). Dashboard do Personal ganhou o botão "⚡ Gerar Treino Rápido" como CTA
  PRINCIPAL; fluxo 100% manual continua via link menor. Card de "Treinos prescritos"
  simplificado — parou de expandir todas as sessões inline (poluía a tela com vários
  alunos); mostra só nome + contagem de sessões, abre a tela do programa pra editar cada
  dia/letra individualmente. Nada persiste até o "Salvar" final — reusa os mesmos 3
  endpoints que já existiam em sequência (programa → sessão por sessão montada →
  exercício por exercício), sem endpoint novo de gravação em lote.

### Grupo C — pesquisa (sem código)

11. **Fase 38 — Pesquisa de monetização B2C.** Busca direta, não workflow multi-agente
    (o de deep-research da Fase 23 não compensou). Inclui avaliar anúncios como fonte
    secundária de receita (banner ancorado discreto em telas de navegação — nunca na
    tela de execução do treino) e provedores disponíveis pra Android/Capacitor.
12. ❌ **Fase 39 — Sugestão de treino via IA.** CANCELADA (2026-07-24, decisão do fundador).
    Substituída por um motor de regras **determinístico, sem IA/LLM externa** ("Montagem
    Inteligente" — ver STATUS.md, "Fase 45"), que resolve a mesma necessidade (montar o
    esboço de uma sessão a partir de grupos musculares + objetivo em segundos) sem exigir
    provedor/prompt/rate-limit nenhum. Não é uma pesquisa concluída que virou implementação
    — é um caminho alternativo que tornou a pesquisa desnecessária por ora. Uma versão
    genuinamente IA-based (sugestões mais adaptativas que regras fixas) permanece um
    upgrade futuro possível, não descartado por princípio, só sem prioridade definida.
13. **Fase 40 — Pesquisa de conteúdo de mídia dos exercícios.** A Fase 32 resolve o
    *mecanismo* (onde/como servir vídeo/GIF/YouTube); esta fase é sobre *conteúdo* —
    ferramenta/IA pra gerar ou curar mídia em massa pros ~120 exercícios que ainda não
    têm vídeo. Sem código até a pesquisa concluir. Tratada fora do Claude Code — trabalho
    manual (image-to-video com imagem de referência travando a pose, não text-to-video).
14. **Fase 41 — Monitoramento geral + backup.** O bucket de mídia de exercícios (Fase 32)
    hoje está dentro do free tier do GCS (`us-central1`, classe `STANDARD`, volume atual
    bem abaixo de 5GB) — mas egress de rede (1GB/mês grátis) e operações de leitura
    (Classe B, 50.000/mês grátis) escalam com o número de usuários assistindo
    vídeo/GIF repetidamente, ao contrário do volume de armazenamento em si. **Nota:
    monitoramento de GCP (Cloud Monitoring + Billing Budget) e do Neon (dashboard nativo)
    é configuração manual de console, sem código — não depende de fase no Claude Code,
    pode ser feito a qualquer momento direto nos respectivos consoles.** Estratégia de
    backup ainda sem escopo detalhado — marcador de pendência.

### Grupo D — Performance (triagem 2026-07-24). ✅ CONCLUÍDA (2026-07-24, registrada como
### "Fase 47" no STATUS.md).

Triagem de performance (não auditoria exaustiva) sobre backend (Fastify+Prisma+Postgres)
e frontend (Next.js+TanStack Query), domínio de nutrição excluído por ser dormente. Todos
os itens de alto impacto foram implementados, junto com a maioria dos de médio/baixo —
2 agentes em paralelo (backend mecânico + frontend mecânico) sobre arquivos sem
sobreposição, migration de índices feita manualmente à parte por exigir mais cuidado.
Deviações registradas por item abaixo (nem tudo saiu exatamente como o plano original
previa — a implementação corrigiu suposições que não se sustentaram na revisão do código real).

**Alto impacto — todos ✅ implementados:**

15. ✅ **N+1 corrigidos em `relations.service.listRelations` e em
    `workout-summary.service.buildPersonalRecords`.** Loop de `findUnique`/query por
    exercício virou 1 query batelada (`findMany({ id/exerciseId: { in } })`) com
    agrupamento em memória — mesmo formato de saída, sem migration.
16. ✅ **`staleTime` global de 30s no `QueryClient`** (`frontend/app/providers.tsx`, antes
    `0` implícito) **+ override de 5min no catálogo de exercícios**
    (`add-exercise-form.tsx`/`generate-workout-modal.tsx`).
17. ✅ **Waterfall no hub do aluno corrigido** — as 3 queries que esperavam `!!aluno`
    resolver agora disparam junto com `relationsQuery`, gateadas só pelo `alunoId` do
    `useParams` (a posse já era validada no backend via `ClientRelation`, independente de
    quando o client dispara a chamada). **Opção (a) escolhida na implementação**: o
    over-fetch da lista inteira de alunos pra achar 1 via `.find()` foi mantido de
    propósito — endpoint dedicado "buscar 1 vínculo" (opção b) ficou fora de escopo por
    ser mudança de contrato de API, não uma otimização de query.
18. ✅ **Histórico de `SetLog` limitado a 100 séries mais recentes** por exercício
    prescrito (`workout-programs.repository.findProgramWithSessions`,
    `workouts.repository.findByIdWithExercises` — `orderBy desc + take 100`, revertido
    pra `asc` antes de devolver, já que o frontend depende dessa ordem). Teto generoso o
    bastante (cobre muitos meses de histórico) pra não mudar nenhum comportamento visível
    de `splitSetLogsBySessionBoundary` — confirmado pelos testes existentes de
    `setlogs.test.ts`/`workout-programs.test.ts` (contagens bem abaixo de 100).

**Médio impacto:**

19. ✅ **`select` explícito em `exercises.repository.findAll`** — manteve `description`
    (usada de verdade e coberta por teste de contrato HTTP em
    `exercise-translation.test.ts`), cortou só `createdAt`/`updatedAt` (nunca lidos).
    **Checagem de nome parecido do admin**: ganhou repositório dedicado
    `adminRepository.listAllExerciseNames()` (`select: {id, name}`), já que a função
    antiga era compartilhada com a listagem completa da tabela do admin.
20. ✅ **`checkAndFireDueReminders` batelado** (mesmo padrão de `listRelations`) e
    **tradução por sessão em `workout-programs.service.getProgram` batelada** — todas as
    sessões flatMap'adas numa única chamada a `translateNested`, redistribuídas de volta
    por sessão preservando ordem.
21. ✅ **Índices adicionados** (migration puramente aditiva, só `CREATE INDEX`):
    `Workout(alunoId, createdAt)`, `Workout(personalId, createdAt)`, `Workout(programId)`,
    `WorkoutProgram(personalId, createdAt)`, `WorkoutProgram(alunoId, createdAt)`,
    `SetLog(workoutExerciseId, loggedAt)`, `ConnectionRequest(alunoId, createdAt)`,
    `ConnectionRequest(professionalId, createdAt)`, `Notification(userId, createdAt)`,
    `Notification(userId, read)`, `SupportThread(alunoId, updatedAt)`,
    `SupportThread(personalId, updatedAt)`, `ClientRelation(alunoId)`,
    `users(role, availableForNewStudents)` (esta última também cobre o item 25/
    `searchProfessionals`, adicionada junto por já estar na mesma migration).
22. ✅ **`React.memo` na lista de `/nimbus/exercicios`** (linha extraída em componente
    próprio, `useCallback` nos handlers pra não invalidar a memoização) **+ dedup de
    `listRelations()`** confirmada — todas as 6+ páginas já usam a mesma `queryKey:
    ["relations"]`, então o `staleTime` do item 16 já as faz compartilhar cache sem
    nenhuma mudança de código adicional.
23. ⏭️ **`personal/programas/[id]/page.tsx`: SEM MUDANÇA (verificado, não se aplicava).**
    O card de "aplicar a aluno" é renderizado incondicionalmente sempre que o programa
    carrega — não existe uma condição de visibilidade real pra gatear `enabled`, então
    forçar um gate aqui não traria ganho nenhum (só atrasaria uma busca que já é
    necessária de imediato).
24. ✅ **`sessoes/[sessionId]/page.tsx`: reprocessamento evitado com `useMemo`** — a
    derivação de "a sessão atual" (find + sort sobre o programa inteiro) parou de rodar
    em todo re-render. Endpoint dedicado "buscar 1 sessão" (que eliminaria o over-fetch
    de verdade) continua fora de escopo — mudança de contrato de API.

**Baixo impacto:**

25. ✅ **`admin.repository.updateUserRole`** ganhou `findUserRoleById` dedicado
    (`select: {id, role}`) em vez de carregar o `User` inteiro. **`useMemo` adicionado**
    em `dashboard/page.tsx` (filtros de origem + busca de plano ativo),
    `sessoes/[sessionId]/page.tsx` (item 24), `treinos/[id]/page.tsx` (sort de
    exercícios) e `profissionais/page.tsx` (`Map` de status). `connections.repository.
    searchProfessionals` ganhou índice de apoio junto do item 21. **`progress.service`
    (janelas sobrepostas de `getWeeklySummary`/`getFrequency`): sem mudança** —
    confirmado que as duas rotas não são chamadas juntas na mesma request hoje, então não
    há duplicação de trabalho real a corrigir ainda (fica registrado como risco latente,
    não bug).

### Grupo E — Performance, rodada 2 (triagem 2026-07-24, mais profunda que o Grupo D). Parcialmente ✅ CONCLUÍDA (2026-07-24, registrada como "Fase 49" no STATUS.md) — os 2 itens de maior impacto/velocidade implementados + tarefas agregáveis; o restante fica documentado abaixo, separado por tarefa, para uma fase futura.

Segunda triagem (4 agentes de pesquisa em paralelo, sem código — cache/HTTP,
escala de query, waterfalls de frontend, bundle/carregamento inicial), mais
funda que o Grupo D: não repetiu N+1/índices/payload óbvios já corrigidos, foi
atrás do que só aparece com VOLUME (tabelas sem índice que só doem depois de
milhares de linhas) e de padrões repetidos entre domínios (fetch-tudo-e-reduz-
em-JS onde o Postgres deveria agregar).

**✅ Implementado nesta fase** (as 2 tarefas de maior impacto/velocidade +
tarefas agregáveis com elas — 3 agentes em paralelo sobre arquivos sem
sobreposição, migration feita manualmente à parte):

26. ✅ **Migration aditiva de índices** (só `CREATE INDEX`, mesma classe seguro
    do Grupo D) em 5 tabelas append-only/muito-joinadas que ficaram de fora da
    1ª triagem: `WorkoutExercise(workoutId)` + `WorkoutExercise(exerciseId)`
    (zero índice antes, apesar de joinada em toda leitura de treino/programa
    e no gate de delete do admin), `LoginLog(createdAt)`,
    `AdminAccessLog(createdAt)`, `AdminAuditLog(createdAt)` (as 3 sempre lidas
    como `ORDER BY createdAt DESC LIMIT N` sem índice de apoio — Postgres
    ordenava a tabela inteira), `SupportMessage(threadId)` (o include de
    mensagens em `findThreadById` era scan completo), `users(createdAt)`
    (apoia `newUsersLast30Days` e a paginação do admin), `SupportThread(status,
    createdAt)` (SLA do admin filtrava sem índice).
27. ✅ **Detecção de PR movida pra agregação SQL** (`workout-summary.repository.ts`)
    — `detectPersonalRecord` (chamado a CADA série logada, o caminho de
    escrita mais quente do app) trazia TODO o histórico do aluno pro exercício
    só pra tirar um `Math.max` em JS; virou `aggregate`/`MAX` no Postgres (só o
    número atravessa a rede). `buildPersonalRecords` (batelado, ao concluir
    sessão) tinha o mesmo formato pra múltiplos exercícios — virou `$queryRaw`
    com `GROUP BY` via join `SetLog→WorkoutExercise→Workout` (Prisma `groupBy`
    não agrupa por campo de relação), `Prisma.join` no `IN (...)` pra não
    concatenar string.
28. ✅ **`getLoadHistory` (domínio progress) movido pra agregação SQL** — mesmo
    formato (fetch-tudo-e-reduz-em-JS) pro gráfico de evolução de carga;
    virou `$queryRaw` com `date_trunc('day', ...)` + `MAX` + `GROUP BY`
    (mesmo padrão já usado em `admin.repository.ts#newUsersLast30Days`).
    Verificado explicitamente que `SetLog.loggedAt` é `timestamp` SEM timezone
    (não `timestamptz`) — `date_trunc` trunca os componentes armazenados
    direto, sem aplicar offset, então não há divergência com o `toISOString().
    slice(0,10)` que já era usado; o código continua formatando o dia em JS
    (não confia em string formatada pelo SQL) por segurança.
29. ✅ **`GET /api/setlogs` (histórico avulso) ganhou o mesmo cap de 100** que
    `workouts.repository.ts`/`workout-programs.repository.ts` já aplicavam no
    MESMO relacionamento `setLogs` — inconsistência entre domínios onde o
    caminho irmão tinha ficado sem cap.
30. ✅ **Cache em memória do catálogo de exercícios** (`exercises.repository.ts`)
    — catálogo (~171, near-estático, só muda via CRUD do admin) parava de
    fazer `findMany` a cada request; TTL de 5min (espelha o `staleTime` já
    usado no frontend pro mesmo catálogo) + invalidação explícita chamada
    pelo admin após cada create/update/delete/media. Consulta por grupo
    muscular filtra o array cacheado em memória em vez de nova query — isso
    também resolveu de graça o problema da Montagem Inteligente (1 query por
    grupo selecionado, ver item 33 abaixo). Traduções EN/ES
    (`exercise-translations.repository.ts`) ganharam o mesmo cache por
    locale, beneficiando também os endpoints de treino/programa que traduzem
    exercícios aninhados, não só a listagem do catálogo. `GET /api/exercises`
    ganhou `ETag`/`If-None-Match` (304 sem corpo) + `Cache-Control: private,
    max-age=60` (privado — a rota fica atrás de `authenticate`).
    **Achado real durante a implementação**: um teste existente
    (`exercise-translation.test.ts`) escrevia uma tradução direto via Prisma
    (contornando o admin) e esperava vê-la refletida na mesma execução —
    corrigido chamando `invalidateCache()` explicitamente após a escrita
    direta do teste, já que o caminho de teste não passa pelo admin (única
    fonte real de invalidação em produção).
    *Modelo: Sonnet 5 (índices, migration manual) + 3 agentes em paralelo
    (Sonnet 5) pros itens 27-30. 309/309 backend, `tsc --noEmit` limpo.*

**📋 Documentado, NÃO implementado nesta fase** (separado por tarefa, pra
decisão/priorização futura):

31. **Frontend: `completeWorkout` invalida o prefixo `["workout-program"]`
    inteiro** (`frontend/app/treinos/[id]/page.tsx`) em vez de só
    `["workout-program", programId]` — refetch em cascata de todo cache de
    programa no app a cada conclusão de treino. `programId` já está disponível
    no workout carregado. Config pura, baixo risco.
32. **Frontend: dados quase-estáticos ainda no `staleTime` global de 30s**
    (`["billing-status"]`, `["relations"]`, `["my-profile"]`, listas de
    programas, `["self-templates"]`) — todos só mudam via ação que já
    invalida a própria chave; `staleTime` de minutos (ou `Infinity` pra
    profile/billing) cortaria a maioria dos refetches de navegação sem risco
    de dado desatualizado.
33. ~~Montagem Inteligente com 1 query de catálogo por grupo muscular~~ —
    **resolvido de graça pelo item 30** (o loop já reusa o cache em memória);
    só ganhou um comentário no código, sem mudança funcional.
34. **Frontend: `html-to-image` e `recharts` embarcados eager** nas rotas mais
    usadas (execução de treino e evolução/hub do aluno) — ambos só precisam
    carregar após interação/dado resolvido; `next/dynamic({ ssr: false })`
    resolveria os dois. `html-to-image` em particular bate direto no webview
    do Capacitor na tela que o aluno mais abre.
35. **Backend: sem response schemas do Fastify** em nenhuma rota — payloads
    grandes (catálogo, `getProgram`/`getWorkout` com até 100 setLogs por
    exercício) pagam serialização JSON genérica em vez do `fast-json-
    stringify` compilado. Cross-cutting, sem mudança de comportamento.
36. **Backend: listas de programa/treino sem paginação** (`workout-programs.
    repository.ts#listByPersonal/listByAluno`, `workouts.repository.ts#
    findAllByAluno/findAllByPersonal`) — cresce sem teto pra um Personal
    veterano. **[CONTRATO-API]** — mesma classe dos endpoints já adiados no
    Grupo D (mudança de contrato HTTP, não só otimização de query).
37. **Backend+Frontend: waterfall do dashboard do aluno** (3 queries de
    detalhe — programa do Personal, self, dieta — esperam a lista resolver
    pra ler `[0].id`) é dependência real de dado, só removível com um
    endpoint novo tipo `GET /api/dashboard` devolvendo os programas ativos já
    com exercícios aninhados numa resposta só. **[CONTRATO-API]** — mesma
    classe adiada no Grupo D; frontend puro só consegue mascarar com
    `placeholderData` da lista (ver item 39), não eliminar o hop.
38. **Frontend: bundle de mensagens i18n (~700 chaves, ~38KB) inteiro
    enviado ao cliente em toda rota** via `NextIntlClientProvider` sem prop
    `messages` — o carregamento por-locale já está correto (só o locale
    ativo, não os 3), falta escopar por namespace/rota.
39. **Frontend: navegação lista→detalhe não semeia o cache do detalhe a
    partir da lista** (`["workout-programs",...]` → `["workout-program",
    id]`) — `placeholderData` da lista eliminaria o flash de loading pra dado
    já em memória (o fetch de verdade ainda dispara, a lista não tem os
    `exercises` aninhados).
40. **Backend: `addSession` carrega o mesmo `WorkoutProgram` 2× no mesmo
    request** (`workout-programs.service.ts`) — `findProgramById` seguido de
    `findProgramWithSessions`, sendo que o 2º já tem tudo que o 1º usa.
    **[AUTHZ]** — mexe no código que faz a checagem de posse; preservar a
    ordem existência-antes-de-posse (404 antes de 403) na implementação.
41. **Backend: `admin.getOverview` faz `groupBy` na `ClientRelation` inteira +
    fetch de todos os profissionais** pra contar quem bateu o limite freemium
    em memória — cresce com o tamanho total da plataforma, não por-tenant.
    **[AUTHZ/BILLING]** — qualquer reescrita precisa preservar a semântica
    exata do `limiteAlunos` por profissional.
42. **Backend: `getFrequency`/`getWeeklySummary` (domínio progress) ainda
    buscam a janela inteira de `SetLog` pra contar/agregar em memória** — o
    trim de `select` (item 28) já cortou colunas desnecessárias, mas a
    contagem de dias-com-atividade (streak) e o bucket mensal continuam
    percorrendo linha por linha em JS. Decisão consciente de escopo: mover
    isso pra SQL exigiria reescrever a lógica de sequência/streak (stateful,
    não é um `GROUP BY` simples) — risco maior que o retorno nesta rodada
    rápida; janela de 90 dias hoje, não cresce sem teto.
43. **Baixo impacto, registrado sem ação**: Map do rate-limiter de login
    cresce sem eviction (mitigado por instância única + restart no deploy);
    checagem de nome parecido do admin roda Levenshtein O(N) por escrita
    (só ~171 nomes, admin-only); avatar em base64 infla o payload de `/me` +
    `localStorage`; sino de notificação faz poll de 30s em toda página
    autenticada (pausa corretamente em aba oculta); app inteiro é `"use
    client"` (nenhum layout aninhado além do root, estrutural — refatoração
    grande, não uma config rápida); 3 famílias de fonte no layout raiz; sem
    bundle analyzer configurado pra medir os ganhos dos itens 34/38 no CI.

### Grupo F — Catálogo: categoria "treino em casa" + subdivisão de Pernas. ✅ CONCLUÍDA (2026-07-24, registrada como "Fase 50" no STATUS.md).

44. ✅ **Categoria "treino em casa"** — 42 exercícios novos curados via pesquisa real no
    YouTube (4 agentes em paralelo, todo `mediaUrl` verificado por fetch real da página
    antes de entrar no catálogo — nada gerado/adivinhado), cobrindo peso corporal e itens
    domésticos (mochila, toalha, cadeira, parede, degrau). Sem campo/tabela novo — usa o
    `equipment` (texto livre) já existente, com um valor novo (`"Itens Domésticos"`) ao
    lado do já existente `"Peso Corporal"`.
45. ✅ **"Pernas" subdividido em 5 grupos** — `Quadríceps`, `Glúteos`, `Posterior da Coxa`,
    `Panturrilhas`, `Adutores e Abdutores`. Reclassificação dos 31 exercícios existentes
    (curadoria manual pela ênfase muscular real) + rodada extra de curadoria (YouTube,
    verificada) especificamente pros 2 grupos que ficariam finos demais depois da divisão
    (`Glúteos`/`Adutores e Abdutores`, só 2 exercícios cada antes). `muscleGroup` é string
    livre (não enum) — seletores do admin e do gerador de treino já derivam a lista do
    banco, então a subdivisão não exigiu nenhuma mudança de código/schema, só dado.
    `data/exercises_seed.json` (usado por `db:seed`) atualizado junto, pra um ambiente novo
    já nascer com o catálogo completo.
    *Modelo: Sonnet 5, com 4 agentes de pesquisa em paralelo pra curadoria. 309/309 backend
    (2 testes ajustados — contagem de catálogo derivada do JSON, e um `muscleGroup` de teste
    trocado de "Pernas" pra "Quadríceps"), `tsc --noEmit` limpo. Catálogo: 171 → 213
    exercícios.*

### Grupo G — Catálogo: 3 grupos musculares novos (Antebraço, Trapézio, Flexores do Quadril). ✅ CONCLUÍDA (2026-07-24, registrada como "Fase 51" no STATUS.md).

46. ✅ **Antebraço, Trapézio, Flexores do Quadril** — mesmo padrão do Grupo F: reclassificação
    de exercícios já cadastrados que se encaixavam melhor no grupo novo (`Rosca Punho`/`Rosca
    Inversa com Barra` de Bíceps → Antebraço; `Encolhimento` com Barra/Halteres/Cabo de
    Costas/Ombro → Trapézio; `Elevação em Y no Banco Inclinado` de Ombro → Trapézio, cuja
    própria descrição já citava "trapézio inferior") + curadoria nova via YouTube (2 agentes
    em paralelo, `mediaUrl` verificado por oEmbed/fetch real antes de entrar no catálogo).
    `Flexores do Quadril` nasceu do zero (0 exercícios antes). Achado ao vetar os agentes: um
    propôs recriar o mesmo exercício já existente (`Elevação em Y`) com um nome novo em vez
    de reconhecer a reclassificação necessária — descartado o duplicado, reclassificado o
    original. `muscleGroup` continua string livre (não enum), então de novo zero mudança de
    código/schema. `data/exercises_seed.json` e `seed-featured-exercises.ts` atualizados junto.
    *Modelo: Sonnet 5, 2 agentes de pesquisa em paralelo pra curadoria. 309/309 backend,
    `tsc --noEmit` limpo. Catálogo: 213 → 232 exercícios.*

### Grupo H — "Meu Treino Pessoal": categorias em carrossel (Treino em Casa / Treinos Premium) + banner. ✅ CONCLUÍDA (2026-07-24, registrada como "Fase 52" no STATUS.md).

47. ✅ **`WorkoutProgram.category` (`GERAL`|`HOME`|`PREMIUM`) + `bannerImageUrl`** —
    campos novos (migration aditiva), só usados em templates `origin: SELF`.
    `/meu-treino-pessoal` agrupa por categoria: a lista plana `GERAL` de sempre
    (inalterada) + dois carrosséis novos, swipeable (CSS scroll-snap nativo,
    sem lib) — **"Treino em Casa"** (funcional: aplica de verdade) e
    **"Treinos Premium"** (todo slide com 🔒 decorativo — não existe conceito
    de aluno pagante ainda, então o clique só mostra "em breve", sem chamar a
    API; decisão confirmada com o fundador, não um esquecimento). Banner
    (16:9, 1200×675) sobe pelo admin em `/nimbus/treinos-pessoais` (mesmo
    bucket GCS de mídia de exercício, pasta separada) — sem banner, o slide
    cai num card estático só com o nome, dentro do mesmo carrossel.
48. ✅ **"1 treino pessoal ativo por vez" com substituição** — invariante que
    não existia antes (diferente do fluxo do Personal, que já tinha o
    equivalente por-Personal desde a Fase 41): aplicar um 2º template SELF
    sem confirmar devolve 409 (`code: SELF_PROGRAM_EXISTS` + nome/id do
    programa atual); o frontend abre um diálogo de confirmação e, se
    aceito, reenvia com `replace: true` — o backend apaga o programa
    anterior (cascata) e aplica o novo na mesma chamada, sem 2ª ida-e-volta.
    **Achado de bug real, corrigido a caminho**: antes desta fase, um aluno
    podia aplicar o MESMO template (ou vários diferentes) repetidamente sem
    nenhum aviso — nenhuma trava existia. A regra "1 por vez" é NOVA, não uma
    correção de uma trava quebrada.
    *Modelo: Sonnet 5 (schema + backend, feito manualmente pela sensibilidade
    da invariante) + 2 agentes em paralelo (frontend admin + frontend aluno,
    arquivos compartilhados — tipos/API client — atualizados antes, pelo
    orquestrador, pra evitar os 2 agentes colidirem no mesmo arquivo). 319/319
    backend (18 testes novos), 48/48 Jest/RTL, `tsc --noEmit` limpo nos dois.*

### Grupo I — Conteúdo de "Meu Treino Pessoal" (3 programas Casa + correções de banner + categoria "Treinos Prontos" + 3 programas Academia). ✅ CONCLUÍDA (2026-07-24, registrada como Fases 53/53.1/54 no STATUS.md).

49. ✅ **3 programas curados "Treino em Casa"** + correção de tradução real
    (37 exercícios reclassificados nas Fases 50/51 mantinham `muscleGroup`
    traduzido EN/ES desatualizado — corrigido; catálogo inteiro, não só os
    3 programas). Pendência sinalizada, não resolvida: `WorkoutProgram.name`/
    `Workout.name` não têm nenhum mecanismo de tradução hoje.
50. ✅ **3 correções no upload de banner**, achadas pelo fundador usando a
    feature: recorte indevido (virou "contain" + fundo desfocado, nunca
    corta a imagem), faixa visível por desvio mínimo de proporção (tolerância
    de ~3% adicionada), e nome do template duplicado por cima do banner
    (removido — o banner já tem o nome embutido na própria imagem).
51. ✅ **Categoria "Treinos Prontos"** (`SelfTemplateCategory.PRONTOS`, migration
    aditiva) substitui o antigo card estático "Crie seu treino do zero"
    (inerte desde a Fase 34.5) — mesmo carrossel/banner de "Treino em Casa",
    mas gratuito e sem cadeado. A tela de admin não precisou de nada novo
    (já era genérica por categoria desde a Fase 52). 3 programas de academia
    cadastrados (Glúteos & Coxas Definitivo, Corpo Esculpido & Tônus, Shape V:
    Hipertrofia — 10 sessões, 61 linhas de exercício).
    *Modelo: Sonnet 5. 319/319 backend, 48/48 Jest/RTL, `tsc --noEmit` limpo.
    Seed idêntico em dev e produção (verificado antes/depois nos dois).*

### Grupo J — i18n de nome de programa/sessão + redesign do overlay de banner + banner no dashboard. ✅ CONCLUÍDA (2026-07-25, registrada como Fase 55 no STATUS.md).


52. ✅ **Tradução de `WorkoutProgram.name`/`Workout.name`** (pendência aberta no
    item 49 acima) — novos modelos `WorkoutProgramTranslation`/`WorkoutTranslation`
    (migration aditiva), mesmo contrato de fallback pro PT de
    `ExerciseTranslation` (Fase 46), mas **sem cache em memória**: dataset
    pequeno (só templates SELF curados) editado via HTTP real, então
    consultar direto do banco evita complexidade de invalidação de cache
    para ganho de performance desprezível. `listSelfTemplates`/`getProgram`
    traduzem nome do programa e de cada sessão no locale ativo. Seed
    `prisma/seed-traducoes-programas-treino-pessoal.ts` populou EN/ES dos 6
    templates existentes (3 Casa + 3 Prontos) e suas 19 sessões — sem
    endpoint de admin dedicado pra editar tradução (mesmo padrão já usado
    pra `Exercise`: seed de script, não tela).
53. ✅ **Reversão parcial do item 50 acima**: o fundador reportou que a
    remoção do overlay de texto (Fase 53.1) foi um erro seu — o problema
    real era texto DUPLICADO (banner com nome já embutido pela IA geradora
    + overlay do app por cima), não a existência do overlay em si. A partir
    de agora, banners são gerados **só como imagem crua** (sem nome
    embutido) — o overlay do app volta a ser a única fonte do nome, e
    passou a ser **padronizado** em todo template com banner (não
    configurável por template): alinhado à esquerda, fonte grande/bold
    (`font-display font-black uppercase`), gradiente restrito ao lado
    esquerdo da imagem (não a imagem inteira). Aplicado em
    `self-template-carousel.tsx` (carrossel de `/meu-treino-pessoal`).
54. ✅ **Banner substitui o card de sugestão no dashboard do aluno**
    (bloco "Meus treinos") — `applySelfTemplateToAluno` passou a copiar
    `bannerImageUrl` do template pra instância aplicada (faltava; toda
    instância aplicada tinha banner nulo mesmo vindo de um template
    bannerizado). Quando o programa aplicado tem banner, o dashboard mostra
    só o banner (mesmo overlay padronizado do item 53), abrindo direto
    `/programas/:id` — o aluno escolhe o dia por lá. Sem banner, mantém o
    card de sugestão de sessão (`NextSessionCard`) como já era.
    *Modelo: Sonnet 5. 319/319 backend, 48/48 Jest/RTL, `tsc --noEmit`
    limpo (backend e frontend).*
55. ✅ **Fase 55.1** — a fonte do overlay de texto (item 53) ficou grande
    demais na prática; reduzida (`text-xl` → `text-sm`) e alinhamento à
    esquerda reforçado (`text-left` explícito), tanto no carrossel quanto
    no banner do dashboard.
56. ✅ **Fase 55.2** — a tela de admin não tinha NENHUMA forma de editar o
    nome de um template/sessão já criado (só existia via seed script, ver
    item 52) — o fundador reportou não achar onde editar. Adicionado
    `PUT /api/admin/self-templates/:id` e
    `.../:id/sessions/:sessionId` (nome PT + tradução EN/ES opcional, upsert
    só quando enviada e não-vazia após trim — nunca apaga uma tradução já
    salva por omissão) e o formulário correspondente em
    `/nimbus/treinos-pessoais`, reaproveitando `programTranslationsRepository`
    do domínio fitness. *Modelo: Sonnet 5. 325/325 backend (+6 casos novos),
    48/48 Jest/RTL, `tsc --noEmit` limpo.*

### Grupo K — Aluno Premium: guardrails (entitlement + teste grátis + gate real). ✅ CONCLUÍDA (2026-07-25, registrada como Fase 56 no STATUS.md).

57. ✅ **Modelo de entitlement novo, separado do billing profissional** —
    `AlunoPremiumStatus` (`NONE|TRIAL|ACTIVE|CANCELED`) + `alunoPremiumExpiresAt`
    + `alunoTrialUsedAt` + `stripeAlunoSubscriptionId` em `User` (migration
    aditiva). Deliberadamente não reaproveita `planoAssinatura`/`limiteAlunos`
    (conceitos de capacidade profissional, não de consumo do aluno).
    `aluno-premium.service.ts` deriva o acesso SEMPRE comparando
    `alunoPremiumExpiresAt` contra `now()` (nunca confia só no status
    armazenado — não há cron que reescreva pra `NONE` ao expirar).
58. ✅ **Teste grátis de 7 dias, uma vez por conta pra sempre** —
    `POST /api/billing/aluno/trial` (`ALUNO` only) rejeita quem já usou
    (`alunoTrialUsedAt` setado e nunca limpo, nem no cancelamento — a
    "segurança da regra" pedida pelo fundador) e quem já tem acesso vigente
    (não dá pra "reiniciar" o teste em andamento pra esticar o prazo).
    Sem cartão: nenhum fluxo de checkout foi tocado por este teste.
59. ✅ **Gate real no backend** — até agora o cadeado do carrossel PREMIUM
    era 100% decorativo (`locked` hardcoded `true` no frontend); qualquer
    aluno já podia aplicar um template PREMIUM chamando a API direto. Corrigido
    em `workoutProgramsService.applySelfTemplate`: categoria `PREMIUM` exige
    `alunoPremiumService.getEntitlement(...).hasAccess`, senão `402` com
    `code: "PREMIUM_REQUIRED"`. Checado só no momento de aplicar (mesma
    convenção do `limiteAlunos` — não revoga retroativamente o que já foi
    aplicado se o acesso expirar depois).
60. ✅ **Preço documentado, não wireado**: R$ 9,90/mês
    (`ALUNO_PREMIUM_MONTHLY_PRICE_CENTS`) + 30% off no compromisso trimestral
    (`ALUNO_PREMIUM_QUARTERLY_DISCOUNT_PCT`) em `src/billing/stripe.ts` — só
    constantes, sem nenhum `STRIPE_PRICE_ID_ALUNO_PREMIUM_*` real nem endpoint
    de checkout ainda (explicitamente adiado pelo fundador: "vamos refinar
    isso quando colocarmos o pagamento em produção").
61. ✅ **Frontend**: `/meu-treino-pessoal` troca o cadeado hardcoded pelo
    acesso real (`GET /api/billing/aluno/premium-status`); clicar num template
    PREMIUM sem acesso mostra um CTA pra iniciar o teste grátis (ou, se já
    usado, uma mensagem de "assinatura em breve") em vez do antigo aviso
    genérico de "em breve" sempre-presente.
    *Escopo explicitamente fora desta fase: criar/editar o próprio treino
    (a segunda metade do pedido do fundador) — só os guardrails de
    assinatura foram construídos agora, a feature em si fica pra depois.
    Modelo: Sonnet 5. 332/332 backend (+7 casos novos), 48/48 Jest/RTL,
    `tsc --noEmit` limpo (backend e frontend).*

### Grupo L — 10 programas "Treinos Premium" + correção de texto solto. ✅ CONCLUÍDA (2026-07-25, registrada como Fase 57 no STATUS.md).

62. ✅ **10 templates PREMIUM cadastrados** (5 femininos: Bumbum na Nuca
    Extreme, Silhueta Ampulheta, Pernas Magníficas, Corpo Esculpido Pro,
    Definição de Conjunto; 5 masculinos: Hipertrofia Extrema Pro, Shape
    Inabalável, V-Taper Master, Monster Mass, Força & Volume Titã — 40
    sessões, todos os ~90 exercícios distintos batendo 1:1 com o catálogo
    existente, nenhum precisou ser criado). `prisma/seed-programas-premium.ts`,
    idempotente por nome — rodado local e depois produção.
63. ✅ **Técnicas de intensidade documentadas em `notes`** de cada
    `WorkoutExercise` relevante (Drop-set, Drop-set duplo/triplo, Rest-Pause,
    Bi-set, Pico de Contração, Cluster Set) — texto explicativo de como
    executar, visível pro aluno na tela de execução do treino (mesmo campo
    `notes` já existente, sem schema novo).
64. ✅ **Tradução EN/ES completa** dos 10 programas + 40 sessões
    (`prisma/seed-traducoes-programas-premium.ts`, mesmo padrão da Fase 55).
65. ✅ **Correção de texto solto**: a seção "GERAL" (listagem plana
    pré-Fase-52, sem título próprio e sem nenhum template curado real hoje)
    mostrava "Nenhum treino pessoal disponível ainda." sem nenhum contexto
    acima — agora some por completo quando vazia. O segundo lugar em que a
    frase aparecia era a seção PREMIUM, que ficava vazia até este item 62
    populá-la — resolvido pelo conteúdo, não por uma segunda mudança de UI.
    Cadeado do banner PREMIUM (item 59, Fase 56) e o CTA de teste grátis já
    existiam e passam a valer pra estes 10 templates sem nenhum código novo;
    banners de imagem em si ficam pro fundador subir depois via
    `/nimbus/treinos-pessoais`, mesmo fluxo manual já usado em HOME/PRONTOS.
    *Modelo: Sonnet 5. 332/332 backend, 48/48 Jest/RTL, `tsc --noEmit` limpo.*

### Grupo M — Admin: concessão/revogação manual de Premium por usuário. ✅ CONCLUÍDA (2026-07-25, registrada como Fase 58 no STATUS.md).

66. ✅ **`PUT /api/admin/users/:id/premium`** (`{ active: boolean }`) — "Premium"
    significa uma coisa diferente por role, resolvida no mesmo endpoint:
    ALUNO vira `alunoPremiumStatus: ACTIVE` com `alunoPremiumExpiresAt` ~100
    anos no futuro (mesmo contrato de `computeEntitlement` da Fase 56, que
    sempre compara contra `now()` — nunca `null`); PERSONAL/NUTRICIONISTA
    vira `planoAssinatura: PLUS` (não existe um degrau "Premium" separado
    pro profissional, reaproveita o topo da escada já existente); ADMIN alvo
    não tem esse conceito (400). Revogar não mexe em `alunoTrialUsedAt`
    (quem já gastou o teste grátis não reganha elegibilidade só porque
    perdeu um Premium concedido manualmente) nem em `stripeSubscriptionId`
    (concessão manual nunca finge uma assinatura Stripe real).
    **Exceção documentada** à regra "só o webhook escreve plano" (ver
    `src/billing/AGENTS.md`) — uso pretendido é cortesia/suporte, não
    substituto de cobrança real. Toda chamada grava `AdminAuditLog`
    (`action: "PREMIUM_TOGGLE"`). UI em `/nimbus/usuarios`: botão inline
    "Conceder"/"Revogar Premium" por linha de usuário (mesmo padrão de
    confirmação do `RoleEditor` de edição de role já existente), ausente
    pra linhas ADMIN.
    *Modelo: Sonnet 5. 339/339 backend (+7 casos novos), 48/48 Jest/RTL,
    `tsc --noEmit` limpo (backend e frontend).*

### Grupo N — Descrição de programa ("Foco") + preview antes de aplicar. ✅ CONCLUÍDA (2026-07-25, registrada como Fase 59 no STATUS.md).

67. ✅ **`WorkoutProgram.description`** (nullable, migration aditiva) — a
    frase "Foco" que existia no conteúdo dos 10 templates Premium (Fase 57)
    virou um campo de verdade, mostrado em `/programas/:id` logo abaixo do
    nome, em texto pequeno, acima da contagem de sessões. Traduzido via
    `WorkoutProgramTranslation.description` (nova coluna na mesma tabela da
    Fase 55), com fallback por CAMPO — não por linha — pro texto em PT
    quando a tradução existe mas a descrição dela ainda não foi preenchida.
    Backfill (`prisma/seed-descricoes-programas-premium.ts`) populou os 10
    templates Premium com o texto "Foco" original + tradução EN/ES; qualquer
    outro programa (HOME/PRONTOS mais antigos) fica com `description: null`
    e simplesmente não renderiza nada — sem caso especial.
68. ✅ **Editável em `/nimbus/treinos-pessoais`** — o mesmo formulário de
    nome/tradução (Fase 55.2) ganhou 3 campos a mais (PT/EN/ES) só no nível
    de programa (sessão não tem "Foco"); string vazia em PT limpa a
    descrição (`null`), EN/ES seguem o mesmo contrato de "vazio = não
    mandou" do nome — e a chamada busca a tradução JÁ salva antes de
    escrever, pra nunca sobrescrever um nome traduzido com o nome em PT só
    porque essa chamada só mandou a descrição.
69. ✅ **Preview antes de aplicar** — clicar num slide de "Treino em Casa"/
    "Treinos Prontos"/"Treinos Premium" antes disparava a aplicação (ou já
    perguntava se queria trocar o treino ativo) direto, sem chance de olhar
    antes. Agora abre um preview (nome, descrição, lista de sessões — dado
    que já vem em `listSelfTemplates`, nenhuma chamada nova) com um botão
    "Aplicar este treino"; confirmar ali dispara o MESMO fluxo de sempre
    (inclusive o diálogo de troca em caso de 409) — menor risco possível
    porque nada do fluxo de aplicação em si mudou, só foi adiado por uma
    tela. `TemplatePreviewDialog` (novo componente, mesmo padrão de overlay
    zero-dependência do `ReplaceSelfTemplateDialog`).
    *Modelo: Sonnet 5. 341/341 backend (+2 casos novos), 48/48 Jest/RTL,
    `tsc --noEmit` limpo (backend e frontend).*

### Grupo O — Premium primeiro na vitrine + 3 programas de emagrecimento/EPOC. ✅ CONCLUÍDA (2026-07-25, registrada como Fase 60 no STATUS.md).

70. ✅ **"Treinos Premium" vira o primeiro carrossel** em `/meu-treino-pessoal`
    (antes vinha por último, depois de Prontos/Casa) — maior vitrine de
    conversão da tela na frente, puro reorder de JSX, sem mudança de lógica.
71. ✅ **3 novos templates PREMIUM** (Queima Fatal 360 — ABC; Metabolic Shred
    Pro — ABCD; Corpo Trincado Extreme — ABCDE; 12 sessões no total),
    focados em emagrecimento/EPOC — todos os exercícios batendo 1:1 com o
    catálogo existente (incluindo os já cadastrados de condicionamento
    metabólico: Burpees, Mountain Climbers, Polichinelo, Pular Corda,
    Corrida Intervalada, Remo Ergométrico), nenhum precisou ser criado.
    Técnicas novas documentadas em `notes` (Bi-set de Contraste, Bi-set
    Antagonista, Bi-set de Exaustão, Bi-set/Rest-Pause Metabólico, Tri-set
    Metabólico, Circuito de Alta Densidade), além das já usadas nos 10
    templates anteriores (Drop-set, Pico de Contração). Tradução EN/ES
    completa (3 programas + 12 sessões).
    *Modelo: Sonnet 5. Seeds idempotentes, rodados local e em produção.*

### Grupo P — Card de próxima sessão do dashboard: destaque no dia + link do programa. ✅ CONCLUÍDA (2026-07-26, registrada como Fase 61 no STATUS.md)
72. `NextSessionCard` (dashboard do aluno): o nome do programa (antes só um rótulo
    estático) virou link pra `/programas/:id`, mesmo padrão visual de link com seta
    já usado em outros pontos da tela (`text-accent-secondary`, `hover:underline`,
    seta `→` ao final). Isso resolve o pedido de poder trocar de sessão manualmente
    quando não quiser seguir a sugestão automática.
73. A letra do treino ganhou destaque bem maior (`text-4xl`/`text-5xl`), e o nome
    da sessão do dia passou a ser um elemento separado, em fonte menor e tom de
    branco levemente mais escuro (`text-foreground/85`) — antes o cabeçalho
    duplicava a letra (uma vez no rótulo do programa via `letra — nome`, sem
    diferenciação visual entre letra e nome da sessão). Layout responsivo
    (empilhado no mobile, lado a lado a partir de `sm:`).
74. Rótulo do bloco "Meus treinos" renomeado para "Meus Treinos Pessoais" (PT/EN/ES).
    *Modelo: Sonnet 5. Sem migration — puro ajuste de frontend/i18n.*

### Grupo Q — Personal: "Gerenciar alunos" + Templates (Meus/Básico/Premium) + regra "instância não vira template de outro aluno sem salvar antes". ✅ CONCLUÍDA (2026-07-26, registrada como Fase 62 no STATUS.md)
75. Dashboard do Personal reestruturado: o card "Alunos vinculados" perde a
    listagem inline (email a email) e ganha um link "Gerenciar alunos →" pra
    uma tela nova (`/personal/alunos`), que lista todos os alunos com um selo
    "Sem treino aplicado" quando aplicável — preserva a visibilidade que a
    lista antiga do dashboard dava, sem poluir a tela principal. O card
    "Treinos prescritos" vira "Templates de treino": para de listar
    instâncias soltas (cada uma só se vê dentro do hub do próprio aluno
    agora) e vira um atalho pra biblioteca de templates.
76. **Lacuna de segurança fechada**: `workoutProgramsService.apply()`
    permitia aplicar QUALQUER programa `origin: PERSONAL` do Personal a um
    aluno — inclusive uma instância já aplicada a OUTRO aluno, sem nenhuma
    checagem de que fosse um template reaplicável. Agora `apply()` rejeita
    (403) uma origem que não seja `isTemplate: true`. A única forma de
    reaproveitar o treino de um aluno pra outro é o novo botão "Salvar como
    template" na tela do programa (`POST /api/workout-programs/:id/save-as-template`),
    que copia a instância pra um template novo e independente
    (`isTemplate: true, alunoId: null`) — mesma semântica de cópia (nunca
    referência) já usada em `applyToAluno`.
77. `/personal/programas` vira "Templates de treino" com 3 seções: **Meus
    Templates** (fluxo de sempre, inalterado) → **Templates Básico** (novo
    catálogo gratuito, `origin: PERSONAL_CATALOG`, curado pelo admin na MESMA
    tela `/nimbus/treinos-pessoais` que já cura os templates SELF do aluno,
    via um seletor "Para quem" na criação) → **Templates Premium** (reaproveita,
    sem duplicar, os 13 templates `origin: SELF, category: PREMIUM` já
    vendidos ao aluno como "Aluno Premium" — Fase 57/60; exige plano Plus do
    Personal, 402 `PREMIUM_TEMPLATE_REQUIRED` sem ele). Clicar num template do
    catálogo reaproveita o `TemplatePreviewDialog` (Fase 59), agora com um
    select de aluno vinculado embutido antes de aplicar — aplica direto, sem
    exigir clonagem prévia pra "Meus Templates" (decisão confirmada com o
    fundador).
78. 2 templates Básico de exemplo cadastrados via
    `prisma/seed-templates-basico-personal.ts` ("Full Body Iniciante" — 3
    sessões, "Upper/Lower Básico" — 2 sessões), idempotente, rodado local e em
    produção.
    *Modelo: Sonnet 5. 1 migration (só `PERSONAL_CATALOG` como novo valor do
    enum `WorkoutProgramOrigin` — nenhuma coluna nova).*

### Grupo R — Filtro rápido por tags (chips) no carrossel Premium. ✅ CONCLUÍDA (2026-07-26, registrada como Fase 63 no STATUS.md)
79. Carrossel "Treinos Premium" de `/meu-treino-pessoal` acumulou muitos
    banners (13 templates) e a rolagem prejudicava a navegação. Adicionadas
    chips de filtro rápido — **Todos / Feminino / Hipertrofia / Definição /
    Express** — acima do carrossel; clicar numa chip filtra client-side
    (`tpl.tags.includes(tag)`), sem chamada nova ao backend.
80. Novo campo `WorkoutProgram.tags` (`WorkoutTag[]`, array nativo do
    Postgres, default `[]`) — um template pode ter 0, 1 ou várias tags
    (confirmado com o fundador: não é 1-pra-1). Editável só em templates
    `origin: SELF` (`PUT /api/admin/self-templates/:id/tags`, 400 se tentado
    num template `PERSONAL_CATALOG`) — a mesma tela de admin
    (`/nimbus/treinos-pessoais`) ganha o seletor de tags tanto na criação
    quanto na edição de um template já existente, confirmado com o fundador
    pra cobrir os dois casos.
    *Modelo: Sonnet 5. 1 migration (novo enum `WorkoutTag` + coluna `tags`).*

### Grupo S — Redireciona pra compra do plano ao clicar num template Premium bloqueado. ✅ CONCLUÍDA (2026-07-27, registrada como Fase 64 no STATUS.md)
81. Em `/personal/programas`, clicar num template do carrossel Premium sem
    plano Plus não abre mais o preview (que deixava ver as sessões e só
    falhava depois, no apply, com 402) — redireciona direto pra
    `/personal/upgrade?from=templates`, mesmo espírito do cadeado do carrossel
    Premium do aluno gratuito (gate no clique, não só um cadeado decorativo).
82. `/personal/upgrade` ganha um aviso específico
    ("Templates Premium são exclusivos do plano Plus...") quando chega via
    `?from=templates`, e o card do plano Plus lista "Acesso aos Templates
    Premium de treino" como benefício — antes a tela não mencionava templates
    em lugar nenhum.
    *Modelo: Sonnet 5. Sem migration — puro frontend.*

### Grupo T — Excluir exercício, preview "ver como o aluno vê", bug de perf do plano Plus, empty-state de primeiro acesso. ✅ CONCLUÍDA (2026-07-27, registrada como Fase 65 no STATUS.md)
83. Personal ganha um botão de excluir (✕, com confirmação inline) em cada
    exercício já prescrito — antes só dava pra adicionar ou reordenar
    (↑/↓), nunca remover. Novo `DELETE /api/workouts/:id/exercises/:exerciseId`
    (mesma checagem de posse de `moveExercise`), disponível na tela de sessão
    do programa e no treino avulso do Personal.
84. Novo botão "Ver como o aluno vê" na tela de sessão do Personal — abre um
    preview somente-leitura (`.../visualizar`), no mesmo layout visual da
    execução do aluno (nome, mídia de demonstração, descrição, prescrição,
    observação), mas deliberadamente sem nada que grave dado do aluno (sem
    checkbox de concluído, sem barra de progresso de séries, sem formulário
    de registrar série) — decisão confirmada com o fundador ("modo leitura,
    só visual").
85. **Bug de perf corrigido**: `VoltageBar` renderizava 1 `<div>` por unidade
    de `total`, sem teto — o plano Plus usa `limiteAlunos = 1_000_000` como
    sentinel de "ilimitado" no backend, então o dashboard do Personal tentava
    montar 1 milhão de elementos e travava. Componente ganhou um teto de 100
    segmentos (proporção preservada); além disso, por pedido do fundador, o
    plano Plus não mostra mais contagem/barra nenhuma — só "Alunos
    ilimitados".
86. Dashboard do aluno ganha um empty-state único de primeiro acesso
    ("Começar agora" — ver treinos disponíveis, sem precisar de Personal —
    OU "Tem seu próprio Personal?" — convite) — substitui 3 mensagens soltas
    e sobrepostas que só apareciam quando o aluno não tinha nada ainda
    (nenhum programa e nenhum Personal vinculado); com Personal vinculado ou
    plano de dieta já ativo, o resto da tela continua como sempre (decisão
    confirmada com o fundador).
    *Modelo: Sonnet 5. Sem migration.*

### Grupo U — Dashboard do Personal redesenhado (mockup do fundador). ✅ CONCLUÍDA (2026-07-27, registrada como Fase 66 no STATUS.md)
87. Dashboard do Personal reduzido a 2 cards de ação clara: "📋 Biblioteca de
    Templates" (⚡ "Explorar Templates" como CTA principal → `/personal/programas`;
    "ou monte um programa do zero →" como link secundário, levando pra mesma
    tela já com o formulário manual aberto via `?criar=1`) e "👥 Meus Alunos"
    (vincular aluno, contagem/limite de alunos — mantidos abaixo do botão
    principal, decisão confirmada com o fundador — "Gerenciar alunos →", e um
    acesso rápido embutido pra "Dúvidas de alunos (N pendentes)", contando
    client-side as threads `ABERTO` a partir da mesma listagem que
    `/personal/duvidas` já usa, sem endpoint novo). Selo de plano ativo
    (⚡ "Plano Plus/Base Ativo") logo abaixo da saudação.
88. "Montagem Inteligente" saiu do dashboard (decisão confirmada com o
    fundador) e passou a morar em `/personal/programas`, ao lado do
    formulário manual — os 2 jeitos de criar um template novo, lado a lado
    numa seção "Criar um novo template" no fim da tela. A tela agora mostra
    primeiro os templates já criados (Meus/Básico/Premium) e só depois a
    opção de criar; o formulário fica escondido atrás de um botão "+ Criar
    template" em vez de sempre aberto no topo, como antes.
    *Modelo: Sonnet 5. Sem migration — puro frontend.*

### Backlog operacional herdado
Ver Seção 7 acima (Neon, billing, Android, webhook).

### Publicação em beta fechado (sem fase — configuração de loja)
Google Play tem **Internal testing** (até 100 emails, sem review) e Apple tem
**TestFlight** (até 100 testers internos sem review, ou até 10.000 externos com review
leve) — permite testar com usuários selecionados antes de qualquer publicação pública,
em paralelo ao resto do roadmap, sem depender de nenhuma fase de código.

### Adiado de propósito (decisão de produto, não bloqueio)
Login Google · camadas anti-abuso de conta · web pública vs. só app nas lojas · programa
de indicação Personal→desconto/bônus (quando a regra de negócio fechar, é migration
aditiva simples sobre o código de convite que já existe — não precisa de fundação hoje).