
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

rate limit