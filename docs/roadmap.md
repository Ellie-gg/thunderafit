# Roadmap

## Notas do fundador (mantidas como estavam)

- No dashboard do aluno, em vez de copiar convite pro Personal, deve encaminhar pro
  WhatsApp — ver implementação nativa.
- Nos exercícios onde tiver vídeo, deixar um link pequeno pro vídeo no YouTube.
- Rate limit.

Comandos úteis de consulta rápida ao catálogo:

```bash
psql "$DATABASE_URL" -c 'SELECT name FROM "Exercise" ORDER BY name;'
psql "$DATABASE_URL" -c "SELECT name FROM \"ExerciseTranslation\" WHERE locale = 'EN' ORDER BY name;"
psql "$DATABASE_URL" -c "SELECT name FROM \"ExerciseTranslation\" WHERE locale = 'ES' ORDER BY name;"
```

---

# Levantamento de funcionalidades ausentes (2026-08-07)

Levantamento pedido junto com a Fase 120. **Método**: comparei o que o schema e as rotas
realmente oferecem hoje (26 models, ~113 rotas em 11 domínios) contra o que as próprias
features existentes implicam. Cada item abaixo cita a evidência no código — não é lista
genérica de app de fitness.

**Fora do escopo deste levantamento**, por serem decisões já tomadas e não lacunas
técnicas: o **checkout pago do Aluno Premium** (deliberadamente diferido — ver
`src/billing/AGENTS.md`, e há instrução explícita de não construir antes de você abrir
essa fase) e **integração com wearable/FC** (você travou o escopo sem wearable na
Fase 112). Correções de **bug** já levantadas vivem em `PROXIMAS-FASES-AUDITORIA.md`;
aqui é só funcionalidade nova.

---

## Nível 1 — Lacunas de simetria (baratas, e a ausência é sentida como bug)

São casos em que a operação existe para um lado e não para o outro. A Fase 120 nasceu
exatamente assim ("consigo adicionar sessão, não consigo excluir"), então este grupo tem
a maior chance de virar reclamação.

1. **Trocar a letra / o dia da semana de uma sessão.** Hoje `letter` é fixado na criação
   e só o `name` é editável (`PATCH /api/workouts/:id/name`, Fase 111). Não há como mover
   um treino de "B" para "C", nem de Segunda para Quarta — a única saída é excluir e
   recriar, perdendo os exercícios prescritos. É o vizinho mais próximo do que você acabou
   de pedir, e provavelmente a próxima reclamação.
2. **Reordenar / duplicar uma sessão.** `moveExercise` existe para exercícios dentro da
   sessão, mas não há equivalente para sessões, nem "duplicar sessão" (montar um B
   parecido com o A obriga a refazer tudo à mão). `saveInstanceAsTemplate` cobre o
   programa inteiro, não a sessão.
3. **Duplicar um programa.** Só existe "salvar instância como template". Um Personal que
   quer dois programas parecidos para alunos diferentes não tem atalho.
4. **UI de admin para traduções de exercício.** `ExerciseTranslation` só é populada por
   **script de seed rodado à mão** — `frontend/app/nimbus/exercicios/page.tsx` não tem
   nenhum campo de tradução. Toda curadoria nova exige um dev. Como o catálogo agora está
   100% traduzido (Fase 119), o custo aparece no próximo exercício que você cadastrar
   pela tela.

## Nível 2 — Dados que o app quase tem (destravam telas que já existem)

5. **Histórico de peso e medidas corporais.** `Anamnesis.alunoId` é `@unique`: é **um
   snapshot só**, sobrescrito. O app acompanha a progressão de *carga* com riqueza
   (`/evolucao`, `SetLog`, PRs) mas não a progressão *corporal* — que é justamente o que
   o aluno olha no espelho. Uma tabela de medições com data alimentaria o `/evolucao` já
   construído, reaproveitando os mesmos componentes de gráfico.
6. **Meta semanal.** `progressService.getWeeklySummary` já devolve `setsThisWeek` e
   `streakDays`, mas não existe nenhum campo de *meta* para comparar. O plano da Fase 112
   já identificou isso ("barra de progresso vs. meta — precisa de 1 campo"): é um campo
   novo e uma barra, com o cálculo já pronto.
7. **PRs persistidos.** Recordes são calculados na hora, dentro do resumo pós-treino
   (`workout-summary.service.ts#buildPersonalRecords`). Não há tabela de PR, então não
   existe "meus recordes" nem histórico de quando cada um caiu — a informação é exibida e
   descartada.
8. **Fotos de progresso.** Nenhum model. A infraestrutura de upload já existe e está
   provada (`src/lib/storage.ts`, GCS, usada por avatar e banner de template), então o
   custo é menor do que parece — mas exige decisão de privacidade/retenção antes.

## Nível 3 — Execução do treino (onde o aluno passa o tempo)

9. **RPE e observação por série.** `SetLog` tem só `setNumber`, `repsDone`, `weightKg`,
   `loggedAt`. O RPE da Fase 112 é **por sessão inteira**. Não há como marcar "essa série
   falhei na 8ª" nem deixar nota ("ombro incomodou") — e é exatamente esse tipo de
   observação que o Personal precisa ler depois.
10. **Substituição de exercício pelo aluno.** Nada. "A academia não tem essa máquina" hoje
    não tem saída: o aluno pula ou registra errado. Precisa de conceito de exercício
    alternativo/equivalente no catálogo (que já tem `muscleGroup` e `equipment`, os dois
    campos que uma sugestão automática usaria).
11. **Descanso real cronometrado.** `restSeconds` é *prescrito*; nada registra o descanso
    efetivamente tomado. O cronômetro de sessão já existe
    (`frontend/lib/workout-session-timer.ts`), então a peça está meio caminho.

## Nível 4 — Operação, confiança e conformidade

12. **Rate limit — parcial, não ausente** (correção ao seu item da lista, e a uma
    afirmação errada que eu mesmo escrevi na primeira versão deste levantamento).
    **Já existe** um limitador em `src/auth/services/login-rate-limiter.ts` (Fase 14): 5
    tentativas falhas consecutivas → bloqueio de 15 min, chaveado por IP + e-mail, e é
    reaproveitado por `check-email` e pelo consumo de convite. O que **falta**: (a) é
    **em memória**, então zera a cada restart do Cloud Run e não é compartilhado entre
    instâncias — com `maxScale=20`, o atacante ganha até 20× o teto; (b) cobre só os
    caminhos de autenticação — "Fale Conosco" (`POST /api/contact`, que dispara e-mail
    via Resend) e as rotas de escrita em geral não têm teto nenhum. O upgrade natural é
    um limitador com estado compartilhado; hoje isso significaria introduzir Redis, então
    vale medir se o abuso é real antes de pagar esse custo.
13. **Notificação real (push).** Entrega é **100% polling**, e a Fase 102 subiu o intervalo
    de 30s para **6h** para cortar custo de compute no Neon. Ou seja: hoje uma mensagem do
    Personal pode levar horas para aparecer. Push (FCM) resolveria latência **e** custo ao
    mesmo tempo — o app já é Capacitor, então o caminho existe.
14. **Exportação dos dados do usuário (portabilidade LGPD).** Existe exclusão de conta com
    cascade auditado (`src/lib/user-deletion.ts`), mas **nenhuma rota de exportação**.
    Exclusão sem portabilidade é meia conformidade.
15. **Sem nenhuma infraestrutura de agendamento.** Não existe cron/scheduler no projeto
    (decisão consciente: tudo é derivado na leitura). Isso já custa: expiração de plano,
    lembrete de pagamento e reversão de cortesia dependem de alguém *abrir uma tela* para
    serem materializados. Se a base crescer, isso vira fonte de bug silencioso — e é
    pré-requisito para retenção de `LoginLog` (B11) e para relatórios enviados por e-mail.
16. **Domínio `nutrition` dormente.** 6 rotas e 4 models (`Food`, `DietPlan`, `DietMeal`,
    `DietFood`) existem e estão fora de uso. Vale uma decisão explícita: ativar (o
    NUTRICIONISTA já é um role real, com vínculo funcionando) ou remover, porque hoje é
    superfície de código sem cobertura de produto.

---

## Sugestão de ordem

Se a intenção for entregar valor percebido rápido, **1 → 6 → 9 → 5**: trocar letra/dia é o
vizinho do que você acabou de pedir; meta semanal é quase de graça e dá sensação de
progresso; RPE/nota por série é o que mais enriquece a conversa Personal↔aluno; histórico
corporal é o que o aluno mais associa a "está funcionando".

Se a prioridade for reduzir risco antes de crescer, **12 → 13 → 14 → 15**: rate limit e
push são os dois que ficam mais caros de adicionar depois, e exportação é conformidade.
