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
Backend e frontend containerizados (Docker; migrations rodam na subida do container). Proxy server-side autenticado (`google-auth-library`) substitui o rewrite simples, pois o backend no Cloud Run ficou com invocação restrita por IAM (não é público — dado de saúde/anamnese não pode ficar atrás de URL aberta). Toda a infra provisionada via Terraform (`infra/`): Cloud Run, Artifact Registry (com política de limpeza), Cloud Build (deploy automático no push em `main`, sem pipeline YAML), Secret Manager, alerta de orçamento. Neon (Postgres) fica fora do Terraform de propósito — um `terraform destroy` nunca alcança o banco de produção. Validado em produção real: registro/login funcionando ponta a ponta pelo domínio real (`https://thunderafit-frontend-vy6oiie6rq-uc.a.run.app`), cookies duplos confirmados, backend confirmado inacessível anonimamente (403), 7 migrations aplicadas no Neon. Bug crítico real encontrado e corrigido ao popular o banco de produção pela primeira vez: `authenticate()` priorizava o header `Authorization` sobre o cookie de sessão — em produção esse header sempre carrega o ID token do Google (exigido pelo proxy do frontend para chamar o backend restrito por IAM), então toda rota protegida retornava 401 mesmo com cookie válido. Corrigido invertendo a prioridade (cookie primeiro).

**Fase 14 — Painel Administrativo**
`Role` ganhou `ADMIN` — mesmo login/JWT/cookie de sempre, sem auto-cadastro (bloqueado no allow-list de `POST /api/auth/register`); bootstrap via `prisma/seed-admin.ts` (lê `ADMIN_EMAIL`/`ADMIN_PASSWORD` do ambiente, idempotente, não roda no `db:seed` automático). Rate limiting de login implementado em memória (bloqueio de 15min após 5 tentativas falhas consecutivas por IP+e-mail, resetado no sucesso) em vez de `@fastify/rate-limit` — o requisito era especificamente "falhas consecutivas com reset", que uma janela deslizante genérica não modela. `trustProxy: true` habilitado no Fastify para o rate limiter enxergar o IP real do cliente através do proxy do frontend. Guards de autorização existentes (relations, workouts, setlogs, progress, anamnesis, support, diet-plans) estendidos para aceitar `ADMIN` como visão ampliada — sempre via query params explícitos (`?personalId=`/`?alunoId=`/`?nutricionistaId=`) apontando para OUTRO usuário, nunca lendo dados como se fossem do próprio admin; endpoints de mutação (criar treino, vincular aluno, postar resposta de dúvida, criar plano de dieta) ficaram de fora de propósito — não é papel do admin agir como um profissional. Domínio novo `/src/admin`: `GET /api/admin/overview` (contagem de usuários por role, novos usuários/dia nos últimos 30 dias via SQL cru, profissionais no limite Freemium 3/3), `GET /api/admin/users` (paginado, com `lastLoginAt` e status de "aluno órfão" — sem nenhum `ClientRelation`), `GET /api/admin/logins` (histórico de `LoginLog`, append-only, só logins bem-sucedidos — tentativas falhas alimentam só o rate limiter, nunca persistem), `GET /api/admin/support-sla` (threads de Dúvidas em `ABERTO` ordenadas da mais antiga). Acesso de ADMIN à anamnese (dado de saúde) não exige vínculo, mas é auditado em `AdminAccessLog` a cada leitura efetiva, consultável em `GET /api/admin/access-logs`. Frontend: rota oculta `/nimbus` (nome sem relação com "admin" — defesa em profundidade explicitamente documentada como camada extra, não a proteção principal, que é o guard de role + rate limiting do Bloco 1); acento de cor próprio `--role-admin` (azul frio, fora do registro dourado/ciano/violeta já usado, sem reaproveitar as cores de status). 109 testes backend passando (25 novos desta fase, incluindo o rate limiter disparado de verdade em sequência até bloquear, e o bootstrap do admin rodado de verdade duas vezes — criação e idempotência) + 22 testes frontend passando + `tsc --noEmit` limpo nos dois lados + os 9 E2E Playwright passando, incluindo o novo `frontend/e2e/admin-flow.spec.ts` (login como admin criado via o script de bootstrap real, navegação por overview/usuários/logins/anamnese/logs-acesso com dados reais, e confirmação de que o acesso à anamnese apareceu na tela de Logs de acesso).

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
