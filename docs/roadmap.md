Implementar no menu de configurações trocar / redefinir senha. alem disso em caso de esquecimento de senha, pesquise melhor forma de fazer recuperação de login, 
também nessa tela um excluir minha conta ( com todos os avisos de perdas de dados), alem disso aprimorar cadastro no primeiro uso, nome  me questione

veja se ja podemos incluir essa tarefa junto com login do google, avalie a complexidade antes


--------------------------------------------------------
na edição de treino o personal deverá poder excluir os exercícios do treino, hoje ele só consegue adicionar 

bug: quando o personal tem acesso ilimitado a tela demora a carregar ele deve renderizar varios quadrados com a quantidade de alunos disponível, remova a contagem de alunos quando o personal for do plano plus.


--------

no cadastro do Aluno e personal deverá incluir país estado cidade 

-----------------------------------------------------------------

rate limit


--------------------------------------
psql "$DATABASE_URL" -c 'SELECT name FROM "Exercise" ORDER BY name;'
psql "$DATABASE_URL" -c "SELECT name FROM \"ExerciseTranslation\" WHERE locale = 'EN' ORDER BY name;"
psql "$DATABASE_URL" -c "SELECT name FROM \"ExerciseTranslation\" WHERE locale = 'ES' ORDER BY name;"
