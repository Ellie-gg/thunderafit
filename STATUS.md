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

**Fase 28 — Polish do Formulário de Exercício.** Bug real corrigido: o botão "posição N" ficava travado em 1 na tela de sessão (invalidava a query errada, Fase 26); popup de confirmação maior e centralizado; reordenar exercícios prescritos com setas ↑/↓ (`POST /api/workouts/:id/exercises/:exerciseId/move`, sem migration). *Modelo: Sonnet 5. Backend verde (5 testes novos; único módulo com falha é `src/admin`, timeout de ambiente pré-existente e não relacionado), 22 Jest/RTL, 21/21 Playwright (novo `exercicio-polish-flow.spec.ts`).*

**Fase 28.1 — Hotfix pós-relato.** Investigação do "trava ao mover a mesma seta" não reproduziu corrupção de dados nem freeze (testado via API concorrente e E2E com cliques rápidos repetidos) — mesmo assim, endurecido: `moveExercise` agora lê+troca dentro de uma única transação (fechava uma janela de corrida teórica) e erros deixaram de ser silenciosos no botão. Investigação do "programa novo não aparece" confirmou que os dados estão corretos em toda API testada — o gap real era `/personal/programas` não mostrar qual aluno cada instância aplicada pertence; corrigido (mostra o e-mail do aluno em cada card). *Modelo: Sonnet 5.*

**Fase 29 — Hub de Administração do Aluno.** Nova tela `/personal/alunos/[alunoId]` reunindo programas aplicados, evolução (carga/frequência) e link pra anamnese — antes o Personal criava um programa e não tinha pra onde voltar. Pré-requisito corrigido: `/api/progress/*` rejeitava PERSONAL com 403; ganhou um ramo com checagem de `ClientRelation` (mesmo padrão do domínio anamnesis), fechando o IDOR que existiria se fosse liberado sem checar vínculo. `GET /api/workout-programs` ganhou filtro opcional `?alunoId=`, sempre ANDado com o `personalId` do JWT. Dashboard do Personal: link "Anamnese" virou "Gerenciar →" pro hub. *Modelo: Sonnet 5. 184/184 backend (7 testes novos), 22 Jest/RTL, 23/23 Playwright (novo `hub-aluno-flow.spec.ts`, incluindo o bloqueio a aluno não vinculado).*

**Fase 30 — Foto de Perfil (aluno e Personal).** Avatar circular pequeno no `AppHeader`, com upload em `/perfil` (novo, aluno) e `/personal/perfil`. Decisão de armazenamento: **banco, não bucket** — o redimensionamento/crop quadrado acontece inteiramente no cliente (canvas, 256px, WebP/JPEG ~0.82 qualidade) antes do upload, resultando em poucos KB; guardado como data URI num `WorkoutExercise`-like `User.avatarUrl String?` (migration aditiva). Backend valida de novo (formato + cap de 140KB), nunca confia só no cliente. Novo endpoint `PUT /api/auth/me/avatar` (qualquer role autenticada; `null` remove). Componentes `AvatarUpload`/`UserAvatar` desacoplados de qualquer domínio (Seção 0: reusabilidade). *Modelo: Sonnet 5. 190/190 backend (6 testes novos), 22 Jest/RTL, 25/25 Playwright (novo `avatar-perfil-flow.spec.ts`, upload real via `setInputFiles`, persistência após reload, remover).*

**Fase 31 — Consolidação: Dashboard Agrupado + Exclusão de Programas/Templates + Correção do Avatar.** Três bugs reais relatados via screenshots do celular. Dashboard do Personal: "Treinos prescritos" deixou de ser uma lista plana de sessões soltas e passou a agrupar por `WorkoutProgram` (nome do programa como cabeçalho, sessões aninhadas dentro). Novo `DELETE /api/workout-programs/:id` (template ou instância aplicada; 404/403 iguais a `apply`; cascata manual em transação, sem `onDelete: Cascade` no schema); componente `DeleteProgramButton` com confirmação inline, usado em `/personal/programas`, no hub do aluno e no dashboard. Avatar: causa raiz era o link "Perfil" do `AppHeader` ficar invisível abaixo do breakpoint `sm` (sem caminho nenhum até `/perfil` no celular); o próprio ícone circular virou botão com popover de upload, em qualquer largura de tela. *Modelo: Sonnet 5. 195/195 backend (5 testes novos de delete), 22 Jest/RTL, 29/29 Playwright (2 specs novos: `dashboard-consolidado-delete-flow.spec.ts` + teste extra em `avatar-perfil-flow.spec.ts` via popover do header).*

**Fase 32 — Infraestrutura de Mídia de Exercícios (bucket GCS + player enquadrado).** `Exercise.mediaUrl` antes só resolvia link do YouTube. Novo campo `Exercise.mediaType` (`YOUTUBE | VIDEO | GIF`, default `YOUTUBE` — compatibilidade retroativa com o catálogo existente). Diferente do avatar (Fase 30, banco OK pra blob pequeno por-usuário), mídia de exercício é catálogo fixo servido repetidamente a todos os usuários — vai pro **bucket GCS** (`infra/storage.tf`, objeto público read-only, só o service account do backend escreve), não pro Postgres. Backend: `PUT /api/admin/exercises/:id/media` (`assertAdmin`, `bodyLimit` de 8MB só nesta rota), valida existência → formato (regex por tipo) → tamanho → decodifica base64 → sobe pro bucket → persiste a URL; nunca confia no `mediaType` que o cliente declara sem checar o formato de verdade do arquivo. Frontend: `ExerciseExecutionCard` ganha branches por `mediaType` — VIDEO renderiza `<video autoplay loop muted playsinline>` (replica UX de GIF sem o custo de arquivo, decisão registrada no MASTER_SPEC: GIF de verdade infla um clipe H.264 de ~900KB pra 5-12MB), GIF renderiza `<img>` direto; YOUTUBE mantém o fluxo de embed já existente. *Modelo: Sonnet 5. 204/204 backend (9 testes novos de mídia), 25/25 Jest/RTL frontend (3 testes novos de mediaType). Infra: `infra/storage.tf` aplicado via Terraform, API `storage.googleapis.com` habilitada, `GCS_BUCKET_NAME` injetado no Cloud Run do backend.*

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
- [x] Fase 28: Polish do Formulário de Exercício (bug de posição travada, popup, reordenar)
- [x] Fase 29: Hub de Administração do Aluno (programas + evolução + anamnese)
- [x] Fase 30: Foto de Perfil (aluno e Personal, armazenada no banco)
- [x] Fase 31: Consolidação (Dashboard Agrupado + Exclusão de Programas/Templates + Correção do Avatar)
- [x] Fase 32: Infraestrutura de Mídia de Exercícios (bucket GCS + player enquadrado)
