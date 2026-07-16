# Status do Projeto: ThunderaFit (SaaS Fitness)

> Histórico resumido por fase. Evidência bruta detalhada (testes, curls, screenshots) não é mais mantida aqui — cada fase foi validada com testes automatizados reais no momento da entrega; os números de teste abaixo refletem o que passou naquele momento.

## Resumo por fase

**Fase 1 — Fundação Core, Auth e Estrutura Modular**
Backend Fastify + Prisma + PostgreSQL, autenticação JWT (access + refresh token), estrutura modular por domínio (repository/service/controller/routes).

**Fase 2 — Vínculo Personal↔Aluno e Limite Freemium** *(gpt-oss:20b via Ollama Cloud)*
`ClientRelation`, `POST/GET /api/relations`, limite de 3 alunos grátis por Personal. 13 testes.

**Fase 3 — Catálogo de Exercícios e Prescrição de Treinos**
Seed curado de 29 exercícios; `Exercise`/`Workout`/`WorkoutExercise`; endpoints de catálogo e prescrição. 18 testes.

**Fase 4 — Execução do Treino e Registro de Carga**
`SetLog`, registro/consulta de séries com autorização por dono do treino. `GET /api/workouts` (listagem por usuário autenticado) adicionado como pré-requisito da Fase 5. 27 testes.

**Fase 5 — Frontend Web Mobile-First**
Next.js App Router; design system "Voltagem" (paleta storm/dourado/ciano, tipografia Unbounded/Manrope/IBM Plex Mono, componente `VoltageBar`). Telas de login/registro/dashboard/treinos/execução. Validado via E2E real (Puppeteer) ponta a ponta.

**Fase 5.5 — Hardening Pré-Produção**
Tokens migrados para cookies httpOnly; CORS via `ALLOWED_ORIGIN`; `dev.sh`/`dev.ps1` (sobem o ambiente inteiro com 1 comando, geram usuário de teste). 31 testes.

**Fase 6 — Painel do Personal Trainer (UI)**
Redirecionamento por role, dashboard do Personal, vínculo de aluno por e-mail (`GET /api/users/lookup`), criação de treino pela UI. 34 testes.

**Fase 7 — Suíte de Testes Automatizados de Frontend**
Jest+RTL (componentes) e Playwright (E2E) substituindo scripts ad-hoc. 22 testes unitários + E2E crítico.

**Fase 8 — Evolução (Histórico de Carga e Frequência)**
Domínio `/src/progress` — agregação sobre `SetLog` existente. Gráficos com Recharts. 41 testes.

**Fase 9 — Consolidação**
Confirmação do padrão mobile-first em 100% do frontend; stub de billing (`POST /api/billing/webhook`); correção de telas presas em "Carregando..." sem tratamento de erro; pré-check de porta/Docker em `dev.sh`/`dev.ps1`. 44 testes.

**Fase 10 — Anamnese + Dúvidas + Notificações**
Três domínios ativados: Anamnese (1:1 aluno-saúde), Dúvidas (chat aluno↔Personal), Notificações in-app. Bug real corrigido: `Content-Type` em requisição sem corpo quebrava logout/marcar-notificação desde a Fase 5.5. 68 testes + E2E do fluxo de Dúvidas.

**Fase 11 — Módulo de Nutrição & Multi-Profissional**
`Role` ganhou `NUTRICIONISTA`; limite Freemium confirmado por profissional (auditoria). Catálogo de alimentos, `DietPlan`/`DietMeal`/`DietFood` com macros agregados. Painel do Nutricionista espelhando o do Personal; dashboard do aluno unificado (treino + dieta). 84 testes + E2E multi-profissional.

**Fase 12 — Polish Visual & Usabilidade**
Tela inicial com seleção de perfil (Personal/Aluno/Nutricionista); acento de cor por papel; erro acionável ao vincular aluno inexistente (convite copiável); teaser de Evolução no dashboard. 8 E2E passando.

**Fase 13 — Deploy em Produção (GCP + Terraform + Neon)**
Backend e frontend containerizados (Docker; migrations rodam na subida do container). Proxy server-side autenticado (`google-auth-library`) substitui o rewrite simples, pois o backend no Cloud Run ficou com invocação restrita por IAM (não é público — dado de saúde/anamnese não pode ficar atrás de URL aberta). Toda a infra provisionada via Terraform (`infra/`): Cloud Run, Artifact Registry (com política de limpeza), Cloud Build (deploy automático no push em `main`, sem pipeline YAML), Secret Manager, alerta de orçamento. Neon (Postgres) fica fora do Terraform de propósito — um `terraform destroy` nunca alcança o banco de produção. Validado em produção real: registro/login funcionando ponta a ponta pelo domínio real (`https://thunderafit-frontend-vy6oiie6rq-uc.a.run.app`), cookies duplos confirmados, backend confirmado inacessível anonimamente (403), 7 migrations aplicadas no Neon.

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
