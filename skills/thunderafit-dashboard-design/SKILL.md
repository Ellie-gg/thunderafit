---
name: thunderafit-dashboard-design
description: Use this skill whenever creating or editing workout dashboard screens, post-workout summary cards, training history views, or any metric-heavy visualization screen in ThunderaFit (web or Capacitor/Android). Covers layout patterns, card structure, chart selection per metric type, and visual hierarchy for training data — following an established dark-mode fitness-app pattern. Does NOT define the color palette or typography scale (those already exist in the project's design tokens/Tailwind config) — this skill governs how to apply them to data-dense training screens.
---

# ThunderaFit — Dashboard & Training Metrics Design

## Quando usar esta skill
Sempre que a tarefa envolver:
- Telas de resumo pós-treino
- Dashboards de histórico/tendência de treino (athlete ou personal trainer)
- Qualquer tela que mostre séries temporais de métricas (FC, calorias, carga, volume)
- Cards de "sessão de treino" com estatísticas agregadas

Esta skill **não** define cores nem fontes — use os design tokens já existentes no projeto. Ela define **como organizar e hierarquizar dados de treino visualmente**.

## Princípios de layout

1. **Cabeçalho de contexto primeiro.** Toda tela de detalhe de treino abre com: nome do treino/tipo, data, janela de horário (ex: "16:29 – 17:28"). Isso ancora todo o resto da tela.

2. **Hero stat opcional.** Se houver uma métrica "estrela" da sessão (tempo total, ex: "00:58:42"), ela pode ganhar destaque tipográfico maior que as demais, mas sem cor de destaque — cor é reservada para significado semântico (ver abaixo), não para hierarquia.

3. **Grid de estatísticas em pares.** Métricas relacionadas (Calorias Ativas / Calorias Totais, FC Média / FC Máxima) ficam lado a lado em grid 2 colunas, não empilhadas verticalmente. Cada célula: label pequeno em cima (cor neutra/secundária), valor grande embaixo (cor semântica), unidade inline menor.

4. **Um card = uma métrica, quando há gráfico.** Séries temporais (FC ao longo do treino, curva de calorias acumuladas) cada uma ganha seu próprio card com título da métrica no topo. Não misturar duas séries diferentes no mesmo gráfico a menos que compartilhem a mesma unidade e escala.

5. **Zonas/faixas usam barra segmentada horizontal, não pizza.** Quando há distribuição em faixas (zonas de FC, tempo em cada tipo de esforço), use barra horizontal segmentada proporcional com legenda de cor + tempo em cada segmento, não gráfico de pizza — mais fácil de comparar tempo relativo de forma linear.

## Mapeamento cor semântica → tipo de dado
(usando os tokens já definidos no projeto — não redefinir hex aqui, apenas o papel de cada um)

| Tipo de dado | Papel da cor |
|---|---|
| Esforço/intensidade (calorias, carga levantada, RPE) | cor "quente" de destaque do design system |
| Frequência cardíaca / métricas cardiovasculares | cor "fria" distinta da anterior — nunca a mesma cor de esforço |
| Tempo, duração, sucesso/conclusão | cor de sucesso do design system |
| Distância/volume | pode reutilizar a cor de sucesso se não houver cor dedicada, mas nunca a de esforço nem a cardio |
| Texto de label/secundário | sempre neutro (cinza), nunca cor semântica — cor é só para o valor, não para o rótulo |

Regra dura: **cada papel semântico usa sempre a mesma cor em toda a aplicação.** Se calorias são vermelhas na tela de resumo, são vermelhas também no dashboard histórico e no card de compartilhamento.

## Seleção de gráfico por tipo de métrica

- **Série temporal contínua durante uma sessão** (FC batimento a batimento, ritmo) → line chart, sem preenchimento de área pesado, pontos discretos visíveis nos picos.
- **Série temporal entre sessões** (evolução de carga máxima ao longo de semanas) → line chart com menos ruído visual, foco na tendência.
- **Distribuição em faixas/categorias** (zonas de FC, tipos de exercício na sessão) → barra horizontal segmentada.
- **Comparação direta de poucos valores** (prescrito vs. realizado) → barras verticais lado a lado, nunca line chart.
- **Progresso dentro de uma meta** (volume da semana vs. meta semanal) → barra de progresso simples, não gauge circular (gauge é mais pesado visualmente do que o dado merece na maioria dos casos).

## Estrutura de navegação entre telas
Seguir o padrão de "resumo → detalhe": uma tela lista sessões (cards compactos, 1 linha de destaque + 2-3 métricas secundárias), tap abre o detalhe completo com todos os cards de métrica. Não tentar caber tudo na lista.

## Adaptação Capacitor/Android
- Cards com padding generoso o suficiente para toque (mínimo 44x44pt em áreas tocáveis, mesmo em Android).
- Gráficos com scroll horizontal quando a série for longa, nunca comprimir eixo X a ponto de perder legibilidade dos rótulos.
- Respeitar safe area do notch/status bar já configurada no shell Capacitor — não duplicar padding manual por cima disso.

## O que esta skill não resolve
- De onde vêm os dados (captura manual, wearable, integração Apple Health/Strava) — isso é decisão de produto, não de design visual, e deve ser resolvida antes de implementar estas telas.
- Paleta de cores exata e escala tipográfica — vêm do design system já existente do projeto.
