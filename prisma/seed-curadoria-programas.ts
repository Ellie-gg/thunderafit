import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Fase 124 — curadoria do catálogo de programas prontos.
 *
 * Varredura do catálogo real em produção (60 templates de catálogo: `origin`
 * SELF ou PERSONAL_CATALOG, 984 exercícios prescritos) achou três coisas:
 *
 * 1. OBSERVAÇÃO: 345/984 exercícios tinham nota, mas distribuídas de forma
 *    muito desigual — 11 programas com ZERO, e o topo em 85%.
 *
 * 2. A desigualdade estava INVERTIDA em relação a quem precisa. Os 0% eram
 *    quase todos INICIANTE (Iron Basics, Rapid Start, Toned Beginnings, Femme
 *    Express, Gentle Definition, Curve Start, Curvas Definidas Pro, Cintura
 *    Fina & Bumbum VIP...), enquanto os 78-85% eram AVANCADO (Corpo Trincado
 *    Extreme, Metabolic Shred Pro, Queima Fatal 360). Quem mais precisa de
 *    orientação era exatamente quem não tinha nenhuma.
 *
 *    A CAUSA, e é o que define o desenho deste seed: as notas das curadorias
 *    anteriores são quase todas TÉCNICA AVANÇADA — drop-set, rest-pause,
 *    cluster set, myo-reps, bi-set, pico de contração. Num programa de
 *    iniciante não há técnica dessas pra acoplar, então a nota simplesmente
 *    não existia. A correção NÃO é enfiar drop-set em iniciante (seria
 *    prescrição ruim, não curadoria): é outro TIPO de observação — comando de
 *    execução, tempo/cadência, erro comum a evitar, e critério de progressão.
 *
 *    Por isso as notas abaixo não reusam as constantes de técnica dos seeds
 *    anteriores. São escritas por exercício, no contexto daquele programa.
 *
 * 3. Critério de onde anotar (e onde NÃO): anota-se quando um comando muda a
 *    execução ou evita um erro frequente — compostos, movimentos unilaterais,
 *    isométricos com tempo, e máquinas onde o posicionamento engana. Não se
 *    anota máquina de isolamento com execução óbvia: nota em tudo viraria
 *    ruído e o aluno pararia de ler. É por isso que nenhum programa aqui vai
 *    a 100%.
 *
 * 4. DESCRIÇÃO ("Foco" na UI): 6 programas de catálogo não tinham nenhuma —
 *    os 3 de `category: HOME` e 3 de `PRONTOS`, todos das Fases 54/59, antes
 *    de `WorkoutProgram.description` existir. São justamente os GRATUITOS, os
 *    mais visíveis do catálogo. Preenchidos aqui em PT + EN/ES (a tradução da
 *    descrição é nullable com fallback pro PT, ver schema.prisma).
 *
 * 5. DESPROPORÇÃO de prescrição: dois programas fugiam da convenção que o
 *    resto do catálogo já seguia pra "Corrida Intervalada (Sprints)" — ver
 *    AJUSTES_SPRINT no fim do arquivo.
 *
 * IDEMPOTENTE em todas as frentes: nota só é escrita onde o campo está vazio
 * (nunca sobrescreve curadoria existente), descrição idem, e o ajuste de
 * sprint casa nos valores antigos antes de gravar. Rodar duas vezes não muda
 * nada na segunda.
 */

// Chave: "LETRA|Nome exato do exercício no catálogo" -> observação.
type NotasDaSessao = Record<string, string>;

const NOTAS: Record<string, NotasDaSessao> = {
  // ===================== GRATUITOS (PRONTOS) =====================
  "Glúteos & Coxas Definitivo (ABC - Feminino)": {
    "A|Elevação Pélvica na Máquina":
      "Suba até alinhar tronco e quadril e pare aí — passar do alinhamento joga a carga pra lombar em vez do glúteo. Sustente 1s no topo.",
    "A|Mesa Flexora":
      "Controle a volta em 2-3 segundos. Deixar o peso cair é onde o posterior de coxa perde a maior parte do estímulo.",
    "A|Cadeira Flexora Sentado":
      "Mantenha o quadril encostado no banco: deslizar pra frente encurta a amplitude e transfere o esforço pra lombar.",
    "A|Abdução de Quadril no Cabo em Pé":
      "Tronco firme e quadril neutro. Girar o tronco pra ganhar amplitude troca glúteo médio por lombar.",
    "B|Puxada Frontal na Polia":
      "Puxe levando os cotovelos em direção às costelas, sem jogar o tronco pra trás além de uns 15°.",
    "B|Remada Baixa no Cabo":
      "Junte as escápulas no fim do movimento e evite embalar com a lombar pra vencer o peso.",
    "B|Elevação Lateral com Halteres":
      "Suba só até a linha dos ombros. Passar disso transfere o trabalho pro trapézio e sai do ombro.",
    "B|Prancha Isométrica":
      "Conte o tempo com o quadril alinhado ao tronco. Quando ele cai ou sobe, encerre a série — tempo com forma ruim não conta.",
    "C|Leg Press 45":
      "Não trave o joelho no topo e não deixe a lombar descolar do apoio na descida. Amplitude vem depois do controle.",
    "C|Agachamento Goblet":
      "Halter junto ao peito, cotovelos apontando pra baixo. É o exercício que ensina o padrão do agachamento com o tronco ereto — use pra aprender antes de ir pra barra.",
    "C|Cadeira Extensora":
      "Sustente 1s no topo com o joelho estendido: é onde o quadríceps encurta por completo.",
    "C|Panturrilha Sentado":
      "Amplitude total — desça o talão até sentir o alongamento e suba até o pico. Meia amplitude é o erro mais comum na panturrilha.",
  },

  "Corpo Esculpido & Tônus (ABC - Feminino)": {
    "A|Agachamento na Máquina Smith":
      "Pés levemente à frente do corpo e descida até a coxa ficar paralela ao chão. A barra guiada permite focar na profundidade sem se preocupar com equilíbrio.",
    "A|Leg Press 45":
      "Não trave o joelho no topo e mantenha a lombar apoiada durante toda a descida.",
    "A|Cadeira Flexora Sentado":
      "Quadril encostado no banco do início ao fim; deslizar pra frente encurta a amplitude.",
    "B|Puxada Alta com Triângulo":
      "Pegada neutra permite puxar mais próximo do corpo: leve os cotovelos pra baixo e pra trás, sem jogar o tronco.",
    "B|Supino Máquina":
      "Ajuste o banco pra que as manoplas fiquem na linha do meio do peito antes de escolher a carga.",
    "B|Desenvolvimento com Halteres Sentado":
      "Costas apoiadas e sem arquear a lombar pra empurrar. Se precisar arquear, a carga está alta.",
    "C|Stiff com Halteres":
      "Joelhos levemente flexionados e fixos, quadril indo pra trás. Desça até sentir o posterior alongar — não até o chão.",
    "C|Elevação Pélvica na Máquina":
      "Pare no alinhamento tronco-quadril e sustente 1s. Estender além disso vira trabalho de lombar.",
    "C|Glúteo Cabo Joelho Estendido":
      "Perna estendida e tronco firme; a amplitude útil é curta. Girar o quadril pra levar a perna mais alto tira o glúteo do movimento.",
  },

  "Shape V: Hipertrofia (ABCD - Masculino/Geral)": {
    "A|Supino Reto com Halteres":
      "Desça até o halter na linha do peito, sem estender o ombro além disso. Halteres pedem menos carga que a barra e dão mais amplitude — não compare os pesos.",
    "A|Supino Inclinado na Máquina Smith":
      "Inclinação entre 30° e 45°. Acima disso o exercício vira desenvolvimento de ombro.",
    "A|Tríceps Pulley Barra Reta":
      "Cotovelo colado ao tronco e imóvel: só o antebraço se move. Deixar o cotovelo abrir transforma o exercício em empurrão de peito.",
    "B|Puxada Frontal na Polia":
      "Cotovelos descem em direção às costelas. Nas 4 séries de 10-12, priorize sentir as costas em vez de somar carga.",
    "B|Remada Baixa no Cabo":
      "Tronco estável: junte as escápulas ao puxar e evite balançar pra ganhar impulso.",
    "B|Remada Unilateral com Halter":
      "Coluna neutra e sem rotação do tronco. Puxe o halter em direção ao quadril, não ao ombro.",
    "B|Rosca Direta com Halteres":
      "Cotovelo fixo na altura do tronco — balançar o corpo pra subir o peso é o erro mais comum na rosca.",
    "C|Leg Press 45":
      "Pés na largura dos ombros e lombar apoiada. Não trave o joelho no topo pra manter a tensão no quadríceps.",
    "C|Agachamento na Máquina Smith":
      "Descida controlada até a coxa paralela ao chão. A guia da barra ajuda a treinar profundidade com segurança.",
    "C|Mesa Flexora":
      "4 séries aqui equilibram o volume alto de quadríceps da sessão — controle a volta em 2-3s pra que o posterior receba o estímulo.",
    "D|Desenvolvimento com Halteres":
      "Sem arquear a lombar pra empurrar. Se o tronco precisa ajudar, reduza a carga.",
    "D|Elevação Lateral no Cabo":
      "O cabo mantém tensão constante, inclusive embaixo. Suba até a linha do ombro e desça devagar.",
    "D|Encolhimento com Halteres":
      "Só o ombro sobe — girar não acrescenta nada e sobrecarrega o pescoço. Sustente 1s no topo.",
  },

  "Balanced Push Pull": {
    "A|Supino Reto com Barra":
      "Escápulas retraídas e pés firmes no chão. Desça a barra na linha do meio do peito, controlando a descida em 2s.",
    "A|Desenvolvimento com Barra":
      "Abdômen contraído pra não arquear a lombar. A barra passa próxima ao rosto, não à frente do corpo.",
    "A|Crucifixo Reto com Halteres":
      "Cotovelo levemente flexionado e FIXO. Se ele abre e fecha, virou supino — reduza a carga.",
    "B|Barra Fixa Pronada":
      "Se não fechar as 4x8-10, use elástico ou a máquina assistida em vez de encurtar a amplitude. Amplitude completa vale mais que repetição parcial.",
    "B|Remada Curvada com Barra":
      "Tronco a cerca de 45° e coluna neutra do início ao fim. Puxe em direção ao umbigo; a lombar não deve compensar.",
    "B|Puxada Triângulo Neutra":
      "Pegada neutra tira estresse do ombro e permite puxar mais perto do corpo — leve os cotovelos pra baixo e pra trás.",
    "C|Agachamento Livre":
      "Profundidade e postura antes de carga. Desça até a coxa paralela mantendo o peito aberto e o joelho alinhado ao pé.",
    "C|Leg Press 45":
      "Complementa o agachamento com menos exigência de estabilização — aqui pode buscar carga, mantendo a lombar apoiada.",
    "C|Mesa Flexora":
      "Controle a volta em 2-3s; é a fase que constrói o posterior de coxa.",
  },

  "Foundation Full Body": {
    "A|Leg Press 45":
      "Depois do agachamento livre, aqui a estabilização é menor — pode buscar mais carga, mantendo a lombar apoiada e sem travar o joelho.",
    "A|Supino Reto com Barra":
      "Escápulas retraídas, pés firmes, descida controlada até a linha do meio do peito. Peça ajuda pra observar as primeiras séries.",
    "B|Levantamento Terra Romeno":
      "Quadril pra trás, joelho levemente flexionado e fixo, coluna neutra. Desça até sentir o posterior alongar e não além — não é agachamento.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, tronco quase parado. Preparação pra barra fixa mais adiante.",
    "B|Remada Curvada com Barra":
      "Tronco a cerca de 45° e coluna neutra. Se a lombar arredonda, reduza a carga imediatamente.",
  },

  "Metabolic Starter": {
    "A|Agachamento com Peso Corporal":
      "Circuito curto de descanso: mantenha o ritmo contínuo, mas pare a série se a postura ceder — 15 boas valem mais que 20 desalinhadas.",
    "A|Afundo com Halteres":
      "Passada firme, joelho de trás descendo em direção ao chão e tronco ereto. 12 por perna: complete um lado antes de trocar.",
    "B|Flexão de Braço":
      "Corpo em linha reta do ombro ao tornozelo. Se não fechar 12, apoie os joelhos em vez de encurtar a descida.",
    "B|Remada Invertida na Barra":
      "Quanto mais horizontal o corpo, mais difícil. Ajuste a altura da barra pra fechar as 12 repetições com o peito chegando perto dela.",
    "B|Tríceps Banco com Peso":
      "Cotovelos apontando pra trás e próximos do corpo; descer até 90° é suficiente. Ombro à frente demais é o erro comum aqui.",
  },

  // ===== Templates de catálogo do PERSONAL (origin: PERSONAL_CATALOG) =====
  // São os templates básicos ofertados ao Personal (seed-templates-basico-
  // personal.ts). Estavam em 0% igual aos de aluno, e o efeito é maior aqui:
  // ao aplicar o template num aluno, a observação vai junto na prescrição. O
  // Personal continua livre pra editar cada uma depois.
  "Full Body Iniciante": {
    "A|Agachamento Livre":
      "Exercício mais técnico do programa: grave o padrão com carga leve antes de progredir. Coxa paralela ao chão, peito aberto, joelho seguindo a linha do pé.",
    "A|Supino Reto com Barra":
      "Escápulas retraídas e pés firmes no chão. Descida controlada em 2s até a linha do meio do peito.",
    "A|Remada Curvada com Barra":
      "Tronco a cerca de 45° e coluna neutra do início ao fim. Se a lombar arredonda, reduza a carga na hora.",
    "B|Leg Press 45":
      "Lombar apoiada em toda a descida e sem travar o joelho no topo.",
    "B|Desenvolvimento com Halteres":
      "Abdômen firme, sem arquear a lombar pra empurrar. Se o tronco compensa, a carga está alta.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, sem jogar o tronco pra trás além de uns 15°.",
    "C|Stiff com Barra":
      "Quadril pra trás, joelho levemente flexionado e FIXO, coluna neutra. Desça até sentir o posterior alongar — não é agachamento.",
    "C|Supino Inclinado com Halteres":
      "Inclinação entre 30° e 45°. Acima disso o exercício vira desenvolvimento de ombro.",
    "C|Remada Unilateral com Halter":
      "Coluna neutra e sem rotação do tronco. Puxe o halter em direção ao quadril, não ao ombro.",
  },

  "Upper/Lower Básico": {
    "A|Supino Reto com Barra":
      "4 séries de 8-12 é a faixa mais pesada do programa: escápulas retraídas, pés firmes, e um observador nas séries mais altas.",
    "A|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, tronco quase parado. Puxar com o tronco balançando troca costas por impulso.",
    "A|Desenvolvimento com Halteres":
      "Sem arquear a lombar pra empurrar. Halteres permitem a trajetória natural do ombro.",
    "B|Agachamento Livre":
      "Abre a sessão de inferiores: profundidade e postura antes de carga. Coxa paralela, peito aberto, joelho alinhado ao pé.",
    "B|Levantamento Terra Romeno":
      "Quadril pra trás com o joelho levemente flexionado e fixo, coluna neutra. Desça até sentir o posterior alongar.",
    "B|Mesa Flexora":
      "Controle a volta em 2-3s — é a fase que constrói o posterior de coxa.",
  },

  // ===================== HOME =====================
  "Seca Barriga em Casa": {
    "A|Burpees":
      "O exercício mais exigente da sessão. Se o ritmo cair muito, troque o salto por subir em pé sem impulso — a continuidade vale mais que a altura do salto.",
    "A|Mountain Climbers":
      "Quadril na altura dos ombros durante os 40s. Deixar o quadril subir transforma o exercício em corrida no lugar e tira o abdômen.",
    "B|Abdominal Remador":
      "Suba tronco e pernas ao mesmo tempo e desça controlando. Sem controle na descida o exercício perde metade do valor.",
    "B|Prancha com Toque no Ombro":
      "Quadril imóvel: o objetivo é resistir à rotação, não tocar rápido. Afaste os pés pra facilitar a estabilização.",
    "B|Rotação Russa (Russian Twist)":
      "20 no total significa 10 pra cada lado. Gire pelo tronco, não só pelos braços.",
    "C|Elevação de Joelho em Pé (Marcha Alta)":
      "Joelho na altura do quadril e abdômen contraído. É cardio de baixo impacto — bom pra quem sente desconforto nos saltos.",
    "C|Flexão de Braço Inclinada":
      "Quanto mais alto o apoio das mãos, mais fácil. Comece alto e vá descendo o apoio à medida que as 15 repetições ficarem confortáveis.",
    "C|Mountain Climbers":
      "Mesmos 45s do bloco A, agora com o corpo já fatigado: reduza o ritmo antes de deixar o quadril subir.",
  },

  "Hipertrofia & Força em Casa": {
    "A|Flexão de Braço":
      "Corpo em linha reta, descida até o peito perto do chão. Pra dificultar sem equipamento, eleve os pés em vez de acelerar.",
    "A|Flexão Pike":
      "Quadril alto e cabeça descendo entre as mãos: é o substituto do desenvolvimento em casa. Quanto mais vertical o tronco, mais ombro.",
    "A|Tríceps Mergulho na Cadeira":
      "Cotovelos apontando pra trás e próximos do corpo, descida até uns 90°. Descer além disso estressa o ombro sem ganho.",
    "B|Agachamento com Peso Corporal":
      "Sem carga o estímulo vem de amplitude e cadência: desça em 3s e suba controlando.",
    "B|Subida no Banco (Step Up)":
      "Suba empurrando com a perna de cima, sem impulso da de baixo. Banco na altura do joelho já é suficiente.",
    "B|Stiff Unilateral com Peso Corporal":
      "Quadril pra trás e coluna neutra; a perna livre acompanha atrás como contrapeso. Estabilidade antes de amplitude.",
    "C|Remada Invertida na Mesa":
      "Ajuste a inclinação do corpo pra calibrar a dificuldade — mais horizontal, mais difícil. Peito chegando perto da borda.",
    "C|Remada Unilateral com Mochila":
      "Coluna neutra e sem rotação do tronco. Puxe em direção ao quadril, não ao ombro.",
    "C|Superman no Solo":
      "Movimento curto e sustentado 2s no alto. É trabalho de lombar e postura, não de amplitude máxima.",
  },

  // ===================== PREMIUM INICIANTE =====================
  "Iron Basics": {
    "A|Supino Reto com Halteres":
      "Halteres pedem menos carga que a barra e dão mais amplitude — desça até a linha do peito e não compare os pesos com o supino livre.",
    "A|Desenvolvimento com Halteres":
      "Abdômen firme, sem arquear a lombar pra empurrar. Se o tronco precisa ajudar, a carga está alta.",
    "A|Tríceps Testa com Halteres":
      "Cotovelo apontando pro teto e imóvel. Comece leve: é o exercício da sessão que mais castiga o cotovelo com excesso de carga.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, tronco quase parado. Sentir as costas trabalhar importa mais que a carga nesta fase.",
    "B|Remada Baixa no Cabo":
      "Junte as escápulas no fim do movimento e não use a lombar pra embalar o peso.",
    "C|Agachamento Livre":
      "O exercício mais técnico do programa. Aprenda o padrão com carga leve: coxa paralela ao chão, peito aberto, joelho alinhado ao pé. Carga vem depois.",
    "C|Leg Press 45":
      "Menos exigência de equilíbrio que o agachamento — aqui pode buscar carga, com a lombar apoiada e sem travar o joelho.",
  },

  "Steel Foundations": {
    "A|Agachamento Livre":
      "Só 3x10 de propósito: nesta fase o objetivo é gravar o padrão de movimento, não acumular volume. Coxa paralela, peito aberto, joelho alinhado ao pé.",
    "A|Desenvolvimento com Halteres":
      "Sem arquear a lombar. Halteres permitem a trajetória natural do ombro; deixe os cotovelos ligeiramente à frente do corpo.",
    "B|Levantamento Terra Romeno":
      "Quadril pra trás, joelho levemente flexionado e FIXO, coluna neutra. Desça só até sentir o posterior alongar — não é agachamento.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, sem jogar o tronco pra trás além de uns 15°.",
    "B|Remada Baixa no Cabo":
      "Junte as escápulas ao puxar; a lombar não deve embalar o movimento.",
  },

  "Prime Mass": {
    "A|Supino Reto com Barra":
      "Faixa de 8-10 é mais pesada que a do resto do programa: escápulas retraídas, pés firmes, e um observador nas séries finais.",
    "A|Desenvolvimento com Halteres":
      "Abdômen firme, sem arquear a lombar pra empurrar. Se o tronco compensa, a carga está alta.",
    "B|Remada Curvada com Barra":
      "Tronco a cerca de 45° e coluna neutra. Se a lombar arredonda, reduza a carga na hora — este é o exercício do programa com maior risco de compensação.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, tronco quase parado.",
  },

  "Rapid Start": {
    "A|Supino Reto com Halteres":
      "Desça até o halter na linha do peito. Sessão curta: use a mesma carga nas 3 séries e foque na execução.",
    "A|Leg Press 45":
      "Lombar apoiada e sem travar o joelho no topo. Em programa express, o leg press entrega estímulo de perna com pouco tempo de setup.",
    "A|Desenvolvimento com Halteres":
      "Abdômen firme, sem arquear a lombar. Se o tronco compensa, reduza a carga.",
    "B|Remada Baixa no Cabo":
      "Junte as escápulas no fim do movimento e evite embalar com a lombar.",
    "B|Levantamento Terra Romeno":
      "Quadril pra trás, joelho levemente flexionado e fixo. Desça até sentir o posterior alongar, não até o chão.",
  },

  "Gentle Definition": {
    "A|Agachamento Goblet":
      "Halter junto ao peito, cotovelos pra baixo. É o agachamento mais fácil de aprender e o que melhor ensina a manter o tronco ereto.",
    "A|Afundo com Halteres":
      "Passada firme, joelho de trás descendo em direção ao chão, tronco ereto. Complete as 12 de um lado antes de trocar.",
    "A|Prancha Lateral":
      "Quadril alto e alinhado, apoio no antebraço e na lateral do pé. Encerre quando o quadril começar a cair.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas. Repetições altas: priorize sentir as costas em vez de somar carga.",
    "B|Supino Reto com Halteres":
      "Desça até a linha do peito com cadência controlada. Faixa de 12-15 pede carga moderada.",
    "B|Tríceps Coice com Halter":
      "Tronco estável e cotovelo parado na altura do quadril — só o antebraço se move.",
  },

  "Femme Express": {
    "A|Agachamento Goblet":
      "Halter junto ao peito e cotovelos pra baixo. Sessão curta: mantenha a mesma carga nas 3 séries.",
    "A|Elevação Pélvica no Solo":
      "Pare no alinhamento tronco-quadril e aperte o glúteo 1s no topo. Estender além disso vira trabalho de lombar.",
    "B|Remada Invertida na Barra":
      "Ajuste a altura da barra pra calibrar a dificuldade: mais horizontal, mais difícil. Peito chegando perto da barra.",
    "B|Desenvolvimento com Halteres Sentado":
      "Costas apoiadas e abdômen firme, sem arquear a lombar pra empurrar.",
    "B|Abdominal Oblíquo no Solo":
      "15 por lado, girando pelo tronco e sem puxar a cabeça com a mão.",
  },

  "Toned Beginnings": {
    "A|Remada Invertida na Barra":
      "Ajuste a inclinação do corpo pra fechar as 12 com boa forma — mais horizontal, mais difícil.",
    "A|Desenvolvimento com Halteres Sentado":
      "Costas apoiadas, abdômen firme, sem arquear a lombar pra empurrar o peso.",
    "A|Crucifixo Inverso com Halteres":
      "Movimento curto conduzido pelas escápulas, com o cotovelo levemente flexionado e fixo. Carga alta aqui atrapalha.",
    "B|Agachamento Goblet":
      "Halter junto ao peito, cotovelos pra baixo, descida até a coxa paralela.",
    "B|Prancha com Elevação de Braço":
      "O objetivo é o quadril NÃO se mover quando o braço sobe. Afaste os pés pra facilitar a estabilização.",
  },

  "Curve Start": {
    "A|Agachamento Goblet":
      "Halter junto ao peito e cotovelos apontando pra baixo — é o exercício que ensina o padrão do agachamento com tronco ereto.",
    "A|Exercício Ostra (Clamshell)":
      "Quadril empilhado e tronco imóvel; a amplitude útil é curta. Girar o tronco pra abrir mais tira o glúteo médio do movimento.",
    "B|Remada Invertida na Barra":
      "Ajuste a altura da barra pra fechar as 12 com o peito chegando perto dela.",
    "B|Desenvolvimento com Halteres Sentado":
      "Costas apoiadas e abdômen firme; sem arquear a lombar.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, tronco quase parado.",
  },

  "Glow Tone": {
    "A|Elevação Pélvica no Solo":
      "Suba até alinhar tronco e quadril e aperte o glúteo 1s no topo. Não force além do alinhamento.",
    "A|Exercício Ostra (Clamshell)":
      "Quadril empilhado, tronco imóvel, amplitude curta. É glúteo médio — girar o tronco tira o alvo.",
    "B|Remada Invertida na Barra":
      "Mais horizontal o corpo, mais difícil. Ajuste a barra pra fechar as 12 com boa forma.",
    "B|Desenvolvimento com Halteres Sentado":
      "Costas apoiadas e sem arquear a lombar pra empurrar.",
    "B|Tríceps Banco com Peso":
      "Cotovelos pra trás e próximos do corpo; 90° de descida é suficiente.",
  },

  "Curvas Definidas Pro": {
    "A|Agachamento na Máquina Smith":
      "Pés levemente à frente e descida até a coxa paralela. A barra guiada deixa você focar na profundidade sem se preocupar com equilíbrio.",
    "A|Leg Press 45":
      "Lombar apoiada em toda a descida e sem travar o joelho no topo.",
    "A|Elevação Pélvica no Solo":
      "Pare no alinhamento tronco-quadril e aperte o glúteo 1s. Passar disso vira lombar.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, sem jogar o tronco pra trás.",
    "B|Remada Baixa no Cabo":
      "Junte as escápulas no fim do movimento; a lombar não embala o peso.",
    "B|Rosca Alternada com Halteres":
      "Alternar permite atenção total a um braço por vez — cotovelo fixo, sem balanço.",
    "C|Mesa Flexora":
      "Controle a volta em 2-3s: é a fase que constrói o posterior de coxa.",
    "C|Stiff com Halteres":
      "Joelho levemente flexionado e fixo, quadril pra trás, coluna neutra. Desça até sentir o alongamento, não até o chão.",
    "C|Exercício Ostra (Clamshell)":
      "Quadril empilhado e tronco imóvel. A amplitude é curta de propósito.",
  },

  "Cintura Fina & Bumbum VIP": {
    "A|Agachamento Goblet":
      "Halter junto ao peito, cotovelos pra baixo. É o agachamento que melhor ensina a manter o tronco ereto.",
    "A|Elevação Pélvica no Solo":
      "Suba até o alinhamento tronco-quadril e aperte o glúteo 1s no topo.",
    "A|Leg Press 45":
      "Lombar apoiada e sem travar o joelho no topo.",
    "B|Stiff com Halteres":
      "Quadril pra trás, joelho levemente flexionado e fixo, coluna neutra. Desça até sentir o posterior alongar.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, tronco quase parado.",
    "B|Desenvolvimento na Máquina":
      "Ajuste o banco pra que as manoplas fiquem na linha dos ombros antes de escolher a carga.",
    "B|Crucifixo Reto com Halteres":
      "Cotovelo levemente flexionado e FIXO. Se ele abre e fecha, virou supino.",
  },

  "Clean Cut": {
    "A|Flexão de Braço Inclinada":
      "Quanto mais alto o apoio das mãos, mais fácil. Comece alto e desça o apoio conforme as 15 ficarem confortáveis.",
    "A|Remada Invertida na Barra":
      "Ajuste a inclinação do corpo pra fechar as 12 com o peito chegando perto da barra.",
    "B|Afundo com Halteres":
      "Passada firme e tronco ereto; complete as 12 de um lado antes de trocar.",
    "B|Desenvolvimento com Halteres Sentado":
      "Costas apoiadas e abdômen firme. Em circuito, cadência constante importa mais que carga.",
  },

  // ===================== PREMIUM INTERMEDIÁRIO =====================
  "Balanced Athlete": {
    "A|Supino Reto com Barra":
      "Escápulas retraídas, pés firmes, descida controlada em 2s até a linha do meio do peito.",
    "A|Desenvolvimento com Barra":
      "Abdômen contraído pra não arquear a lombar; a barra passa próxima ao rosto.",
    "B|Barra Fixa Pronada":
      "Amplitude completa vale mais que repetição parcial — se não fechar 4x8-10, use elástico ou máquina assistida.",
    "B|Remada Cavalinho":
      "Coluna neutra e peito apoiado quando houver apoio. Puxe com os cotovelos, não com as mãos.",
    "C|Agachamento Frontal":
      "Cotovelos altos e tronco vertical — se os cotovelos caem, a barra rola pra frente. Exige mais mobilidade que o agachamento tradicional.",
    "C|Salto no Caixote (Box Jump)":
      "Qualidade do salto acima da altura da caixa: aterrisse com o joelho flexionado e SUBA na caixa pra voltar, não pule pra baixo.",
  },

  // ===== Segundo lote: os que sobraram na faixa 20-30% =====
  // Não estavam zerados, mas ficariam num degrau esquisito ao lado dos 53-63%
  // acima — é a mesma desproporção em escala menor. Trazidos pra ~50-55%.
  "Fresh Recomp": {
    "A|Agachamento Livre":
      "Bloco de força antes do finalizador de cardio: aqui o objetivo é carga com boa forma, não fadiga. Coxa paralela, peito aberto, joelho alinhado ao pé.",
    "A|Supino Reto com Barra":
      "Escápulas retraídas e pés firmes; descida controlada até a linha do meio do peito.",
    "A|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, tronco quase parado.",
    "B|Levantamento Terra Romeno":
      "Quadril pra trás, joelho levemente flexionado e FIXO, coluna neutra. Desça até sentir o posterior alongar.",
    "B|Remada Curvada com Barra":
      "Tronco a cerca de 45° e coluna neutra. Se a lombar arredonda, reduza a carga na hora.",
  },

  "Hipertrofia Express 3X": {
    "A|Supino Reto com Halteres":
      "Sessão curta: use a mesma carga nas 3 séries e invista o tempo na execução, não em ajustar peso.",
    "A|Desenvolvimento com Halteres":
      "Abdômen firme, sem arquear a lombar pra empurrar.",
    "B|Puxada Frontal na Polia":
      "Cotovelos em direção às costelas, sem jogar o tronco pra trás.",
    "B|Remada Baixa no Cabo":
      "Junte as escápulas no fim do movimento; a lombar não embala o peso.",
    "C|Leg Press 45":
      "Único composto de perna da sessão express: lombar apoiada, sem travar o joelho no topo, e é aqui que vale buscar carga.",
    "C|Cadeira Flexora Sentado":
      "Quadril encostado no banco do início ao fim e volta controlada em 2-3s.",
  },

  "Lean Start": {
    "A|Afundo com Halteres":
      "Passada firme, joelho de trás descendo em direção ao chão, tronco ereto. Complete as 12 de um lado antes de trocar.",
    "A|Elevação Pélvica no Solo":
      "Suba até alinhar tronco e quadril e aperte o glúteo 1s no topo.",
    "A|Flexão de Braço Inclinada":
      "Quanto mais alto o apoio das mãos, mais fácil. Vá baixando o apoio conforme as repetições ficarem confortáveis.",
    "A|Prancha Isométrica":
      "Circuito com 30s de descanso: encerre quando o quadril cair, mesmo antes do tempo.",
    "B|Remada Invertida na Barra":
      "Ajuste a inclinação do corpo pra calibrar a dificuldade — mais horizontal, mais difícil.",
    "B|Tríceps Banco com Peso":
      "Cotovelos apontando pra trás e próximos do corpo; 90° de descida é suficiente.",
  },

  "Silhueta Ampulheta": {
    "A|Glúteo Cabo Joelho Estendido":
      "Perna estendida e tronco firme; a amplitude útil é curta. Girar o quadril pra subir mais tira o glúteo do movimento.",
    "A|Step Up Lateral com Halteres":
      "Suba empurrando com a perna que está no banco, sem impulso da de baixo. 10-12 por perna, alternando só ao terminar o lado.",
    "A|Exercício Ostra (Clamshell)":
      "Quadril empilhado e tronco imóvel — é glúteo médio, e a amplitude é curta de propósito.",
    "B|Barra Fixa Pronada":
      "Amplitude completa vale mais que repetição parcial: se não fechar 4x8-10, use elástico ou máquina assistida.",
    "B|Remada Curvada com Barra":
      "Tronco a cerca de 45° e coluna neutra do início ao fim.",
    "B|Desenvolvimento Militar em Pé":
      "Em pé exige o core: abdômen contraído, sem arquear a lombar. A barra passa próxima ao rosto.",
    "C|Agachamento na Máquina Smith":
      "4x8-10 é a faixa mais pesada da sessão: descida controlada até a coxa paralela, aproveitando a guia pra buscar profundidade.",
    "C|Stiff com Barra":
      "Quadril pra trás, joelho levemente flexionado e fixo. Desça até sentir o posterior alongar — não até a barra tocar o chão.",
    "D|Crucifixo Reto com Halteres":
      "Cotovelo levemente flexionado e FIXO. Se ele abre e fecha, virou supino.",
  },

  "Pernas Magníficas": {
    "A|Agachamento Frontal":
      "Cotovelos altos e tronco vertical — se os cotovelos caem, a barra rola pra frente. Com 120s de descanso, o foco é carga com técnica, não fadiga.",
    "A|Passada com Halteres":
      "12 passos POR PERNA, ou seja 24 passadas no total. Tronco ereto e passada longa o suficiente pro joelho de trás descer.",
    "A|Agachamento Sumô com Halter":
      "Pés abertos e pontas pra fora, descida entre os pés. Fecha a sessão trabalhando adutores junto ao quadríceps.",
    "B|Remada Unilateral com Halter":
      "Coluna neutra e sem rotação do tronco. Puxe em direção ao quadril, não ao ombro.",
    "B|Puxada Frontal com Pegada Fechada":
      "Pegada fechada permite puxar mais perto do corpo: cotovelos descem em direção às costelas.",
    "B|Mergulho nas Paralelas":
      "Desça até uns 90° de cotovelo. Tronco mais vertical foca tríceps; inclinado pra frente puxa mais peito.",
    "C|Levantamento Terra Sumô":
      "Pés abertos, barra junto às canelas, coluna neutra. Empurre o chão com as pernas em vez de puxar com as costas — 120s de descanso existem pra isso ser feito bem.",
    "C|Stiff com Halteres":
      "Joelho levemente flexionado e fixo, quadril pra trás. Complementa o terra sumô com mais alongamento do posterior.",
    "C|Pull-Through no Cabo":
      "Movimento de quadril, não de braço: leve o quadril pra trás e traga à frente contraindo o glúteo.",
    "D|Abdominal na Roda (Ab Wheel)":
      "Avance só até onde conseguir manter a lombar sem arquear. Distância maior com lombar cedendo é pior que distância curta com controle.",
  },

  "Curve & Cut": {
    "A|Hip Thrust com Barra":
      "Pare no alinhamento tronco-quadril e aperte o glúteo 1s no topo. Hiperextender a lombar pra subir mais não aumenta o estímulo no glúteo.",
    "A|Elevação Pélvica Unilateral":
      "Quadril nivelado durante todas as 15 de cada perna — se ele cai pro lado da perna livre, reduza a amplitude.",
    "B|Puxada Frontal na Polia":
      "Em circuito com 45s de descanso, mantenha a carga moderada e a execução limpa.",
    "B|Remada Baixa no Cabo":
      "Junte as escápulas no fim; sem embalar com a lombar.",
    "C|Agachamento Búlgaro":
      "Pé de trás no banco, tronco ereto, descida vertical. 12 por perna: é o exercício mais exigente da sessão — faça antes da fadiga chegar.",
  },
};

/**
 * Descrições ("Foco" na UI) dos 6 programas de catálogo que não tinham nenhuma.
 * Todos das Fases 54/59, anteriores ao campo — e todos GRATUITOS, os mais
 * visíveis do catálogo. EN/ES vão pra WorkoutProgramTranslation.description.
 */
const DESCRICOES: Record<string, { pt: string; en: string; es: string }> = {
  "Glúteos & Coxas Definitivo (ABC - Feminino)": {
    pt: "Programa gratuito com foco em glúteos, posterior de coxa e adutores, em divisão ABC — cada sessão ataca um bloco diferente da perna, com uma sessão de superiores para manter o equilíbrio postural.",
    en: "Free program focused on glutes, hamstrings and adductors in an ABC split — each session targets a different part of the legs, with one upper-body session to keep postural balance.",
    es: "Programa gratuito centrado en glúteos, isquiotibiales y aductores, en división ABC — cada sesión trabaja una parte distinta de la pierna, con una sesión de tren superior para mantener el equilibrio postural.",
  },
  "Corpo Esculpido & Tônus (ABC - Feminino)": {
    pt: "Programa gratuito de tonificação de corpo inteiro em divisão ABC, distribuindo pernas, superiores e a cadeia posterior ao longo da semana — indicado para quem quer definição geral sem concentrar tudo em um só grupo.",
    en: "Free full-body toning program in an ABC split, spreading legs, upper body and the posterior chain across the week — for anyone after overall definition rather than focusing on a single muscle group.",
    es: "Programa gratuito de tonificación de cuerpo completo en división ABC, repartiendo piernas, tren superior y cadena posterior a lo largo de la semana — ideal para quien busca definición general sin concentrarlo todo en un solo grupo.",
  },
  "Shape V: Hipertrofia (ABCD - Masculino/Geral)": {
    pt: "Programa gratuito de hipertrofia em divisão ABCD, com uma sessão dedicada a ombros e trapézio para construir o formato em V — mais volume por grupo muscular que uma divisão ABC, para quem já treina com constância.",
    en: "Free hypertrophy program in an ABCD split, with a dedicated shoulders and traps session to build the V-taper — more volume per muscle group than an ABC split, for those already training consistently.",
    es: "Programa gratuito de hipertrofia en división ABCD, con una sesión dedicada a hombros y trapecio para construir la forma en V — más volumen por grupo muscular que una división ABC, para quien ya entrena con constancia.",
  },
  "Bumbum na Lua, Pernas & Core em Casa": {
    pt: "Treino em casa sem equipamento, em divisão ABC, com foco em glúteos, adutores/abdutores e estabilidade de core — trabalha os grupos que mais respondem ao peso corporal, com progressão por amplitude e cadência em vez de carga.",
    en: "Equipment-free home workout in an ABC split focused on glutes, adductors/abductors and core stability — it targets the muscles that respond best to bodyweight, progressing through range of motion and tempo instead of load.",
    es: "Entrenamiento en casa sin equipamiento, en división ABC, centrado en glúteos, aductores/abductores y estabilidad del core — trabaja los grupos que mejor responden al peso corporal, progresando por amplitud y cadencia en vez de carga.",
  },
  "Seca Barriga em Casa": {
    pt: "Treino em casa de alta intensidade e pouco descanso, em divisão ABC alternando cardio, core e agilidade — sem equipamento nenhum, pensado para gasto calórico e resistência abdominal.",
    en: "High-intensity home workout with short rests, in an ABC split alternating cardio, core and agility — no equipment at all, built for calorie burn and abdominal endurance.",
    es: "Entrenamiento en casa de alta intensidad y poco descanso, en división ABC alternando cardio, core y agilidad — sin ningún equipamiento, pensado para el gasto calórico y la resistencia abdominal.",
  },
  "Hipertrofia & Força em Casa": {
    pt: "Treino em casa em divisão ABC usando peso corporal e uma mochila carregada como carga externa — cobre empurrar, puxar e pernas com progressão real, para quem quer ganhar massa sem academia.",
    en: "Home workout in an ABC split using bodyweight plus a loaded backpack as external resistance — it covers push, pull and legs with real progression, for building muscle without a gym.",
    es: "Entrenamiento en casa en división ABC usando el peso corporal y una mochila cargada como resistencia externa — cubre empuje, tracción y piernas con progresión real, para ganar masa sin gimnasio.",
  },
};

/**
 * Desproporção de prescrição. O catálogo já tinha uma convenção consolidada
 * pra "Corrida Intervalada (Sprints)", usada por 6 programas (Shred Circuit,
 * Cut Elite, Vanguard Recomp, Definition Engine, Curve & Cut, Peak
 * Definition): `reps: "30s"`, `rest: 30`, 4-5 séries, e uma nota explicando
 * que os 30s de caminhada são a recuperação entre tiros.
 *
 * Dois programas fugiam dela, e nos dois casos o resultado era um bloco de
 * sprint desproporcional dentro de uma sessão que já era longa:
 *
 * - "Queima Fatal 360"/A: 8 séries, com a caminhada de recuperação embutida
 *   nas reps E MAIS 120s de descanso por cima. Somando, o sprint sozinho
 *   passava de 20 minutos numa sessão que já tem 9 exercícios — descanso
 *   duplicado por acidente.
 * - "Metabolic Shred Pro"/D: 10 séries com `rest: 0` e NENHUMA nota, enquanto
 *   todos os finalizadores de cardio equivalentes do catálogo têm nota
 *   explicando o protocolo.
 *
 * Normalizados pra convenção, mantendo o nível mais alto dos dois programas
 * (6 séries em vez das 4-5 dos intermediários, já que ambos são AVANCADO).
 * `matchSets` existe pra idempotência: se o valor já é o novo, não reescreve.
 */
const AJUSTES_SPRINT: Array<{
  programa: string;
  letra: string;
  matchSets: number;
  sets: number;
  repsRange: string;
  restSeconds: number;
  notes: string;
}> = [
  {
    programa: "Queima Fatal 360",
    letra: "A",
    matchSets: 8,
    sets: 6,
    repsRange: "30s",
    restSeconds: 30,
    notes:
      "6 tiros de 30s no ritmo mais forte que conseguir sustentar, com 30s de caminhada leve entre eles — a caminhada É a recuperação, não pare além dela. Finalizador: deixe pro fim da sessão.",
  },
  {
    programa: "Metabolic Shred Pro",
    letra: "D",
    matchSets: 10,
    sets: 6,
    repsRange: "30s",
    restSeconds: 30,
    notes:
      "6 tiros de 30s em esforço máximo, com 30s de caminhada entre eles. Se não conseguir manter a intensidade do primeiro tiro, encerre antes de completar os 6 — sprint lento não é sprint.",
  },
];

/**
 * Cardio de "Metabolic Shred Pro" que estava sem nota, ao contrário de todos
 * os finalizadores equivalentes do catálogo (que usam o prefixo "Finalizador:").
 */
const NOTAS_CARDIO_FALTANTES: Array<{ programa: string; letra: string; exercicio: string; notes: string }> = [
  {
    programa: "Metabolic Shred Pro",
    letra: "A",
    exercicio: "Remo Ergométrico",
    notes:
      "Finalizador: 15 minutos alternando 45s em ritmo moderado e 15s de tiro máximo, sem parar entre os blocos. Puxe com as pernas primeiro, depois tronco e braços.",
  },
  {
    programa: "Metabolic Shred Pro",
    letra: "C",
    exercicio: "Pular Corda",
    notes:
      "Finalizador: 10 minutos contínuos em ritmo moderado a alto. Se errar o passo, retome sem pausar — o objetivo é manter a frequência cardíaca alta o tempo inteiro.",
  },
];

async function aplicarNotas(): Promise<{ escritas: number; jaTinham: number; naoAchados: string[] }> {
  let escritas = 0;
  let jaTinham = 0;
  const naoAchados: string[] = [];

  for (const [nomePrograma, notas] of Object.entries(NOTAS)) {
    const programa = await prisma.workoutProgram.findFirst({
      where: { name: nomePrograma, isTemplate: true, origin: { in: ["SELF", "PERSONAL_CATALOG"] } },
      include: { workouts: { include: { exercises: { include: { exercise: true } } } } },
    });
    if (!programa) {
      naoAchados.push(`programa "${nomePrograma}"`);
      continue;
    }

    for (const [chave, nota] of Object.entries(notas)) {
      const [letra, nomeExercicio] = chave.split("|");
      const sessao = programa.workouts.find((w) => w.letter === letra);
      if (!sessao) {
        naoAchados.push(`"${nomePrograma}" sessão ${letra}`);
        continue;
      }
      const we = sessao.exercises.find((e) => e.exercise.name === nomeExercicio);
      if (!we) {
        naoAchados.push(`"${nomePrograma}"/${letra} exercício "${nomeExercicio}"`);
        continue;
      }
      // Idempotência: nunca sobrescreve curadoria que já existe.
      if (we.notes && we.notes.trim() !== "") {
        jaTinham++;
        continue;
      }
      await prisma.workoutExercise.update({ where: { id: we.id }, data: { notes: nota } });
      escritas++;
    }
  }
  return { escritas, jaTinham, naoAchados };
}

async function aplicarDescricoes(): Promise<{ pt: number; trad: number; jaTinham: number }> {
  let pt = 0;
  let trad = 0;
  let jaTinham = 0;

  for (const [nome, textos] of Object.entries(DESCRICOES)) {
    const programa = await prisma.workoutProgram.findFirst({
      where: { name: nome, isTemplate: true, origin: { in: ["SELF", "PERSONAL_CATALOG"] } },
      include: { translations: true },
    });
    if (!programa) {
      console.log(`  Aviso: programa "${nome}" não encontrado — descrição pulada.`);
      continue;
    }

    if (programa.description && programa.description.trim() !== "") {
      jaTinham++;
    } else {
      await prisma.workoutProgram.update({ where: { id: programa.id }, data: { description: textos.pt } });
      pt++;
    }

    for (const locale of ["EN", "ES"] as const) {
      const texto = locale === "EN" ? textos.en : textos.es;
      const existente = programa.translations.find((t) => t.locale === locale);
      if (existente) {
        // A tradução do NOME já existe (Fase 59) — só completa a descrição, se
        // ainda estiver vazia. Nunca reescreve nome traduzido.
        if (!existente.description || existente.description.trim() === "") {
          await prisma.workoutProgramTranslation.update({
            where: { id: existente.id },
            data: { description: texto },
          });
          trad++;
        }
      } else {
        // Sem tradução nenhuma: cria com o nome canônico PT como fallback de
        // nome (é o que o app já faz na leitura) e a descrição traduzida.
        await prisma.workoutProgramTranslation.create({
          data: { workoutProgramId: programa.id, locale, name: programa.name, description: texto },
        });
        trad++;
      }
    }
  }
  return { pt, trad, jaTinham };
}

async function aplicarAjustesSprint(): Promise<{ ajustados: number; jaOk: number }> {
  let ajustados = 0;
  let jaOk = 0;

  for (const a of AJUSTES_SPRINT) {
    const we = await prisma.workoutExercise.findFirst({
      where: {
        exercise: { name: "Corrida Intervalada (Sprints)" },
        workout: { letter: a.letra, program: { name: a.programa, isTemplate: true } },
      },
    });
    if (!we) {
      console.log(`  Aviso: sprint de "${a.programa}"/${a.letra} não encontrado — ajuste pulado.`);
      continue;
    }
    if (we.sets !== a.matchSets) {
      jaOk++;
      continue;
    }
    await prisma.workoutExercise.update({
      where: { id: we.id },
      data: { sets: a.sets, repsRange: a.repsRange, restSeconds: a.restSeconds, notes: a.notes },
    });
    console.log(
      `  Sprint normalizado: "${a.programa}"/${a.letra} — ${a.matchSets}x -> ${a.sets}x30s, rest ${we.restSeconds}s -> ${a.restSeconds}s`
    );
    ajustados++;
  }
  return { ajustados, jaOk };
}

async function aplicarNotasCardio(): Promise<number> {
  let n = 0;
  for (const c of NOTAS_CARDIO_FALTANTES) {
    const we = await prisma.workoutExercise.findFirst({
      where: {
        exercise: { name: c.exercicio },
        workout: { letter: c.letra, program: { name: c.programa, isTemplate: true } },
      },
    });
    if (!we) {
      console.log(`  Aviso: "${c.programa}"/${c.letra} ${c.exercicio} não encontrado.`);
      continue;
    }
    if (we.notes && we.notes.trim() !== "") continue;
    await prisma.workoutExercise.update({ where: { id: we.id }, data: { notes: c.notes } });
    n++;
  }
  return n;
}

async function main() {
  console.log("Curadoria do catálogo de programas (Fase 124):\n");

  console.log("1) Observações por exercício:");
  const notas = await aplicarNotas();
  console.log(`   escritas: ${notas.escritas} | já tinham (preservadas): ${notas.jaTinham}`);
  if (notas.naoAchados.length) {
    console.log(`   NÃO ENCONTRADOS (${notas.naoAchados.length}):`);
    notas.naoAchados.forEach((n) => console.log(`     - ${n}`));
  }

  console.log("\n2) Descrições ('Foco') + traduções EN/ES:");
  const desc = await aplicarDescricoes();
  console.log(`   descrições PT escritas: ${desc.pt} | traduções escritas: ${desc.trad} | já tinham: ${desc.jaTinham}`);

  console.log("\n3) Notas de cardio que faltavam:");
  const cardio = await aplicarNotasCardio();
  console.log(`   escritas: ${cardio}`);

  console.log("\n4) Desproporção de sprint:");
  const sprint = await aplicarAjustesSprint();
  console.log(`   ajustados: ${sprint.ajustados} | já estavam normalizados: ${sprint.jaOk}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
