
personal pode aplicar Somente um treino por aluno , se ele ja aplicou um treino pro aluno o sistema devera mostrar uma tela esse aluno ja possue treino aplicado.
note um aluno pode ter mais de um personal, isso não é o usual mas pode ser que acontece, valide esse caso de uso 

depois que finalizar a sessão quando ele iniciar de novo a quantidade de reps e carga precisa estar zerada pra nova sessão. deixe em fonte bem pequena acima do texto o valor da ultima sessao pro aluno ter referência de quanto fez da última vez, mas precisa ser de uma forma que não polua muito a tela.

 quero  que vc guarde historico dessss valores para gerarmos graficos, me de sugestões de melhor forma de lidar com esses dados

na nova tela de finalização do treino e compartilhar no Instagram: na parte de cima hoje esta mostrando o treino, por exemplo treino a, substitua pelo primeiro nome do 'Aluno mandou bem no treino'

a duração do treino esta sem valor, vc deve inserir um contador que registra a hora que ele abriu o treino e a hora que clicou em finalizar e colocar o valor em tempo Horas:Min:Segundos.
nessa mesma tela tem dias seguidos. também precisamos de um contador que conte se o usuario treinou em dias seguidos, ache uma logica aplicavel nessa situação e me questione se tiver duvida.

a tela inicial do aluno tem a sugestão do treino do dia, reveja a logica de indicação de qual treino ele deve fazer, se o treino for semanal deve corresponder com o dia atual, se for treino A B C é o da sequência que não foi feito em looping, confira a lógica.
também confira na lógica o que acontece se eu registrar o mesmo treino duas vezes no mesmo dia, deve ser possível mas não conta como um novo dia em sequência, analise o que podemos fazer nos dois casos ( aluno faz o mesmo treino 2 x no mesmo dia e aluno faz 2 treinos distintos no mesmo dia) analise como fica historico, graficos.

ao inves de volume da semana na tela inicial do aluno coloque Quantidade de series executadas na semana

ao abrir o botao de notificação quando tem uma notificação nova a tela da notificação não parece responsiva, tente centralizar melhor a notificação ou reduzir o tamanho de caracteres da notificação.

rate limit

gerador de treinos com IA ( ver se tem alguma api gratis ou montar um rag, o escopo é limitado, tudo por combo box 




Implemente a funcionalidade "Montagem Inteligente" (Gerador Automático de Treinos) no domínio `/fitness`, permitindo que o Personal Trainer monte o esboço de uma sessão em segundos sem precisar buscar exercício por exercício manualmente.

**1. Mecânica da Feature (Motor de Regras Determinarístico - Sem LLM Externa):**
- **Backend (`POST /api/workouts/generate`):**
  - Recebe: `muscleGroups` (array de strings), `goal` ('hipertrofia' | 'forca' | 'resistencia') e `level` ('iniciante' | 'intermediario' | 'avancado').
  - Consulta os exercícios do catálogo (`exercises` no Postgres) filtrando pelos grupos selecionados.
  - Seleciona uma combinação coerente de exercícios (ex: 2-3 para grupo principal, 2 para secundário).
  - Aplica métricas padrão baseadas no `goal`:
    - *Hipertrofia:* 3-4 séries | 8-12 reps | 60s descanso
    - *Força:* 4-5 séries | 4-6 reps | 120s descanso
    - *Resistência:* 3 séries | 15-20 reps | 45s descanso
  - Retorna o JSON estruturado com os exercícios selecionados, séries, reps e descansos pré-configurados.

- **Frontend (UI do Personal):**
  - Na tela de prescrição, adicione o botão de destaque **"⚡ Gerar Treino Rápido"**.
  - Abre um modal simples com 3 campos:
    1. Nome/Sessão (ex: "Sessão A - Peito e Tríceps")
    2. Grupos Musculares (Multi-select de tags)
    3. Objetivo/Foco (Select)
  - Ao clicar em "Gerar", consome o endpoint e pré-preenche os cards de exercícios diretamente no formulário da página, permitindo que o Personal revise, edite, reordene ou altere qualquer valor antes de salvar e enviar ao aluno.

---
**NÃO FAZER NESTA TAREFA:**
1. NÃO utilize nem conecte APIs de LLMs externas (OpenAI, Gemini, etc). A lógica deve ser 100% algorítmica no backend TypeScript.
2. NÃO crie ou altere rotas fora do domínio `/fitness`.
3. NÃO altere o formato final de persistência da tabela de `workouts` — a rota gera apenas o *draft/rascunho* para a UI preencher o formulário existente.

---
**PROTOCOLO DE EVIDÊNCIA & GOVERNANÇA:**
- Teste o endpoint gerando uma sugestão de treino e confirme que os IDs pertencem ao catálogo existente.
- Coloque a saída BRUTA do teste e do terminal na atualização do `STATUS.md` garantindo os 4 campos estritos (O que foi feito, Arquivos Criados/Modificados, Evidência/Status dos Testes, Pendências conhecidas).
