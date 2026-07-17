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
| Testes | 162 backend (Jest/Supertest) + 22 frontend (Jest/RTL) + 16 E2E (Playwright, backend real) |

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
> **[Seção preenchida ao final da análise — ver artifact do relatório para a versão longa.]**

- **Recomendação:** _(preenchida na conclusão da Fase 23)_
- **Salvaguardas obrigatórias:** _(idem)_
- **Esboço de migration:** _(idem)_

---

## 4. Monetização Híbrida (matriz da Fase 23)

- **B2B (Personal):** mantém o implementado — Freemium 3 alunos; pago R$ 9,90/mês ou
  R$ 95,04/ano (20% off), 50 alunos. Stripe Checkout (ativação pendente de chaves).
- **B2C (Aluno Solo):** _(matriz recomendada preenchida na conclusão da Fase 23, com base
  no benchmarking Gym WP/Hevy/Strong/Fitbod — ver artifact)_
- **Regra de lojas (anti-steering):** assinatura vendida na **web**; o app mobile apenas
  consulta o status sincronizado — nunca linka checkout externo de dentro do app.
  _(Detalhe atualizado com a pesquisa 2024–26 na conclusão da Fase 23.)_

---

## 5. Roadmap Proposto (pós-Fase 23)

_(Sequência preenchida na conclusão da Fase 23; rascunho: F24 fundação `origin` +
fluxo Aluno Solo mínimo → F25 retenção B2C (PRs/volume) → F26 marketplace de
programas → F27 billing B2C → F28 app Android.)_

---

## 6. Governança: STATUS.md (regras vigentes, preservadas)

1. Ler o arquivo inteiro antes de editar; entradas identificam o **modelo real** executor.
2. `## Progresso Geral das Fases` existe **uma única vez** — reescrita completa, nunca append duplicado.
3. **Evidência bruta obrigatória**: nenhuma entrada é aceita sem a saída real dos
   comandos/testes; relato sem evidência = não validado.
4. Desde a Fase 15 o STATUS é mantido em formato resumido por fase (decisão do fundador);
   a evidência bruta é exigida na conversa de execução, não mais arquivada integralmente no arquivo.

## 7. Pendências operacionais conhecidas (2026-07-17)

1. **Rotacionar a senha do Neon** (exposta em chat na Fase 16) e manter o Secret Manager
   como única fonte da credencial.
2. **Ativar billing**: criar produtos/prices no Stripe (teste), setar env `STRIPE_*`
   (Secret Manager + Cloud Run), validar via `BILLING_SETUP.md`.
3. **Spike Android**: rodar o teste de cold start em máquina com Android Studio.
4. Melhorias documentadas não aplicadas: idempotência por `event.id` no webhook,
   rate limit no webhook público, `AdminAccessLog` para progress.
