# Status do Projeto: ThunderaFit (SaaS Fitness)

> Log macro por fase — 1-3 linhas cada, sem evidência bruta (a evidência real fica
> registrada na conversa de execução de cada fase). Ver `MASTER_SPEC.md` para o
> estado técnico vigente, decisões de arquitetura e roadmap priorizado.

## Resumo por fase

**Fase 1 — Fundação Core, Auth e Estrutura Modular.** Backend Fastify+Prisma+Postgres, JWT access+refresh, estrutura modular domain-first.

**Fase 2 — Vínculo Personal↔Aluno e Limite Freemium.** `ClientRelation`, limite de 3 alunos grátis por Personal. *Modelo: gpt-oss:20b (Ollama Cloud).*

**Fase 3 — Catálogo de Exercícios e Prescrição de Treinos.** Seed de 29 exercícios; `Exercise`/`Workout`/`WorkoutExercise`.

**Fase 4 — Execução do Treino e Registro de Carga.** `SetLog`; `GET /api/workouts`.

**Fase 5 — Frontend Web Mobile-First.** Next.js App Router; design system "Voltagem"; telas core; E2E inicial (Puppeteer).

**Fase 5.5 — Hardening Pré-Produção.** Tokens em cookies httpOnly; CORS; `dev.sh`/`dev.ps1`.

**Fase 6 — Painel do Personal Trainer (UI).** Dashboard, vínculo de aluno por e-mail, criação de treino pela UI.

**Fase 7 — Suíte de Testes Automatizados de Frontend.** Jest+RTL e Playwright substituindo scripts ad-hoc.

**Fase 8 — Evolução (Histórico de Carga e Frequência).** Domínio `/progress`; gráficos Recharts.

**Fase 9 — Consolidação.** Mobile-first confirmado; stub de billing; fix de telas travadas em "Carregando".

**Fase 10 — Anamnese + Dúvidas + Notificações.** 3 domínios novos; bug de `Content-Type` em request sem corpo corrigido (afetava desde a Fase 5.5).

**Fase 11 — Módulo de Nutrição & Multi-Profissional.** Role `NUTRICIONISTA`; `DietPlan`/`DietMeal`/`DietFood`; dashboard do aluno unificado.

**Fase 12 — Polish Visual & Usabilidade.** Seleção de perfil na home; acento de cor por papel; convite copiável ao vincular aluno inexistente.

**Fase 13 — Deploy em Produção (GCP + Terraform + Neon).** Containers + proxy autenticado; infra via Terraform. Bug crítico corrigido: prioridade do cookie de sessão sobre o header `Authorization` do proxy.

**Fase 14 — Painel Administrativo.** Role `ADMIN`; rate limit de login em memória (IP+e-mail); domínio `/admin` (rota oculta `/nimbus`); `AdminAccessLog` para leituras de anamnese.

**Fase 15 — Catálogo de Exercícios Expandido.** 29→149 exercícios; `difficultyLevel`; filtro por grupo muscular.

**Fase 16 — Programas de Treino (Templates + Sessões + Progresso).** `WorkoutProgram` com sessões A-E; aplicar = cópia (nunca referência); `suggestedNext`.

**Fase 17 — Consolidação de Pendências.** 6 frentes: dashboard alinhado ao `suggestedNext`, mídia na prescrição, player responsivo, auditoria de segurança (2 gaps de role corrigidos), `DietPlan.isActive`, anamnese/dúvidas para o Nutricionista.

**Fase 18 — UX de Autenticação + Remoção do Nutricionista da UI.** Diferenciação visual login/cadastro; bug real de sessão corrigido (`sessionStorage`→`localStorage`); Nutricionista removido da seleção pública (backend intacto).

**Fase 19 — Spike Capacitor + Auth por Cookie.** Viabilidade do app Android confirmada com ajuste (`CookieManager.flush()` no lifecycle).

**Fase 20 — Billing Real (Stripe Checkout).** Integração completa + webhook assinado + hardening adversarial; deployado porém inerte (sem chaves `STRIPE_*`).

**Fase 21 — Descoberta de Profissionais + Reavaliação de UI.** Domínio `/connections`; busca por localização; aprovação manual do vínculo.

**Fase 22 — Reconciliação de Branches.** Fases 19/20/21 integradas em `dev`+`main`; deploy em produção.

**Fase 24 — Fluxo de Auth Unificado.** `/login` vira fluxo de 4 etapas via `check-email`; `/register` removido; rate limiter corrigido (chave IP+e-mail, não IP puro).

**Fase 25 — Correção do Fluxo Programa→Sessões.** Tela obsoleta `/personal/treinos/novo` removida; dashboard aponta pro fluxo de Programas (já correto desde a Fase 16); mitigação leve no player de vídeo.

**Fase 26 — Esquema de Sessões (Letras/Dias) + Tela Dedicada por Sessão.** `sessionScheme` (LETTER/WEEKDAY); bug de ordenação alfabética corrigido (`suggestedNext` dependia de `localeCompare`); tela própria por sessão substitui o acordeão inline.

**Fase 27 — Feedback de Exercício Adicionado + Observações por Prescrição.** Toast de confirmação; campo `notes` (500 caracteres) por exercício prescrito. *Sem suíte de testes rodada nesta fase (pendência aberta).*

## Progresso Geral das Fases
- [x] Fase 1: Fundação Core, Auth e Estrutura Modular
- [x] Fase 2: Vínculo Personal↔Aluno e Limite Freemium
- [x] Fase 3: Catálogo de Exercícios (AI Seeder) e Prescrição de Treinos
- [x] Fase 4: Execução do Treino e Registro de Carga
- [x] Fase 5: Frontend Web Mobile-First
- [x] Fase 5.5: Hardening Pré-Produção (cookie httpOnly, config de ambiente, script de dev)
- [x] Fase 6: Painel do Personal Trainer (UI)
- [x] Fase 7: Suíte de Testes Automatizados de Frontend
- [x] Fase 8: Evolução (Histórico de Carga e Frequência)
- [x] Fase 9: Consolidação (Polish + Stub de Billing + Preparação Mobile)
- [x] Fase 10: Anamnese + Dúvidas + Notificações
- [x] Fase 11: Módulo de Nutrição & Multi-Profissional
- [x] Fase 12: Polish Visual & Usabilidade
- [x] Fase 13: Deploy em Produção (GCP + Terraform + Neon)
- [x] Fase 14: Painel Administrativo
- [x] Fase 15: Catálogo de Exercícios Expandido
- [x] Fase 16: Programas de Treino (Templates + Múltiplas Sessões + Progresso)
- [x] Fase 17: Consolidação de Pendências (UI + Segurança + Extensão de Domínio)
- [x] Fase 18: UX de Autenticação + Remoção Temporária do Nutricionista da UI
- [x] Fase 19: Spike Capacitor + Auth por Cookie (integrado; teste manual Android pendente)
- [x] Fase 20: Billing Real (Stripe Checkout) (integrado/deployado; env STRIPE_* pendente para ativar)
- [x] Fase 21: Descoberta de Profissionais + Reavaliação de UI
- [x] Fase 22: Reconciliação de Branches (tudo em dev + produção)
- [x] Fase 24: Fluxo de Auth Unificado (Parte 1: backend + Parte 2: frontend)
- [x] Fase 25: Correção do Fluxo Programa→Sessões + Ajustes de Mídia
- [x] Fase 26: Esquema de Sessões (Letras/Dias) + Tela Dedicada por Sessão
- [x] Fase 27: Feedback de Exercício Adicionado + Observações por Prescrição (sem suíte de testes — pendente pra próxima fase)
