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
  /fitness       exercícios (149), programas (templates A–E, cópia-ao-aplicar),
                 treinos, séries/SetLog, relations (vínculo + limite Freemium)
  /connections   descoberta de profissionais (perfil público opt-in, busca por
                 localização, ConnectionRequest com aprovação manual)
  /billing       Stripe Checkout/portal/status/webhook (assinado)
  /progress      agregações de carga/frequência sobre SetLog
  /anamnesis     questionário de saúde (aluno escreve; profissional vinculado lê)
  /support       dúvidas aluno↔profissional (threads com status)
  /notifications in-app (sino); push real fora de escopo
  /admin         painel /nimbus: métricas, usuários, logins, SLA, AdminAccessLog
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
- `Exercise` (149, difficultyLevel, mediaUrl) · `Anamnesis` · `SupportThread/Message` ·
  `Notification` · `LoginLog` · `AdminAccessLog` · nutrição (dormente).

---

## 3. Decisão Arquitetural do Pivô: treinos do Personal vs treinos do Aluno Solo

> Resultado da análise adversarial da Fase 23 (workflow multi-agente sobre o código real).
> **Status: DECIDIDO, NÃO IMPLEMENTADO** — ver Fase 32 no roadmap (Seção 8). O workflow
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
  ver Fase 36 no roadmap.
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
2. **Ativar billing**: criar produtos/prices no Stripe (teste), setar env `STRIPE_*`
   (Secret Manager + Cloud Run), validar via `BILLING_SETUP.md`.
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

### Grupo B — fundação do pivô B2C

5. **Fase 32 — `WorkoutProgram.origin` + guards.** Migration aditiva do enum (ver Seção
   3), guards tratando `personalId === null`, filtro explícito nas listagens do Personal.
   **Esforço: alto (superfície de autorização) · Modelo: Opus 4.8.**
6. **Fase 33 — Fluxo de criação de treino para Aluno Solo.** UI/endpoint equivalente ao
   do Personal, `origin: SELF`. **Esforço: médio · Modelo: Sonnet 5.**
7. **Fase 34 — Dashboard do aluno com 2 blocos.** "Prescrito pelo seu Personal" + "Meus
   treinos"; card de convite copiável quando não há Personal vinculado. **Esforço: médio
   · Modelo: Sonnet 5.**
8. **Fase 35 — Convite aluno→Personal.** Inverte quem inicia o `ConnectionRequest`
   (Fase 21). **Esforço: médio · Modelo: Sonnet 5.**

### Grupo C — pesquisa (sem código)

9. **Fase 36 — Pesquisa de monetização B2C.** Busca direta, não workflow multi-agente
   (o de deep-research da Fase 23 não compensou).
10. **Fase 37 — Sugestão de treino via IA.** Fase própria só de design (provedor, formato
    de prompt, rate limit) antes de qualquer código.
11. **Fase 38 — Pesquisa de mídia dos exercícios.** Ferramenta/IA pra gerar mídia em massa
    pros ~120 exercícios sem vídeo curado. Sem código até a pesquisa concluir.

### Backlog operacional herdado
Ver Seção 7 acima (Neon, billing, Android, webhook).

### Adiado de propósito (decisão de produto, não bloqueio)
Login Google · camadas anti-abuso de conta · web pública vs. só app nas lojas.
