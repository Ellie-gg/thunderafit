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
  ver Fase 38 no roadmap.
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