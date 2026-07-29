# Política de Privacidade — ThunderaFit

**Última atualização: 29 de julho de 2026**

> ⚠️ Recomendamos fortemente uma revisão por advogado antes de considerar este
> documento definitivo — foi escrito com base em pesquisa das regras vigentes da
> LGPD, mas não substitui aconselhamento jurídico profissional.

Esta Política de Privacidade descreve como o ThunderaFit ("nós") coleta, usa,
armazena e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de
Dados Pessoais (Lei nº 13.709/2018, "LGPD").

## 1. Quem é o controlador dos seus dados

**Eliel Ortiz Garcia**, responsável pelo ThunderaFit, com sede em Florianópolis, SC,
Brasil, é o controlador dos dados pessoais tratados nesta Plataforma.

**Contato para assuntos de privacidade / encarregado (DPO)**: eliel.garcia@gmail.com.

## 2. Quais dados coletamos

### 2.1 Dados de cadastro e perfil (todos os usuários)
E-mail, senha (armazenada apenas como hash criptográfico — nunca em texto legível,
nem por nós), nome, foto de perfil (opcional), papel na plataforma (Aluno, Personal,
Nutricionista ou Admin), idioma preferido.

### 2.2 Dados de profissionais (Personal/Nutricionista)
Cidade/UF, especialidades, biografia, disponibilidade para novos alunos — exibidos
publicamente no diretório de profissionais **somente se você optar por ativar essa
visibilidade**.

### 2.3 Dados de saúde — dado pessoal sensível (LGPD art. 5º, II)

Quando você (Aluno) preenche a **anamnese**, coletamos informações de saúde:
altura, peso, condições de saúde relatadas e outras respostas do questionário. Também
tratamos como dado de saúde/fitness o **histórico de treino** (exercícios, séries,
repetições, cargas levantadas, frequência de treino).

**Este é um dado sensível pela LGPD e seu tratamento depende do seu consentimento
explícito**, obtido através de uma confirmação específica exibida no momento em que
você preenche a anamnese pela primeira vez — separada do aceite geral destes Termos no
cadastro. Você pode revogar esse consentimento a qualquer momento excluindo sua conta
(Seção 7).

A anamnese só é visível para: você mesmo, e o(s) profissional(is) (Personal/
Nutricionista) aos quais você está vinculado. Acessos de administradores do
ThunderaFit à sua anamnese (ex: para suporte) são registrados numa trilha de auditoria
interna.

### 2.4 Dados de pagamento

Não armazenamos número de cartão de crédito. Pagamentos de assinatura são processados
inteiramente pelo **Stripe** (processador de pagamento terceirizado) — guardamos apenas
um identificador de referência da sua assinatura no Stripe, nunca o dado do cartão em
si.

### 2.5 Dados técnicos e de uso

Endereço IP no momento do login (para segurança/prevenção de abuso), data/hora de
acesso, e dados de localização aproximada (cidade/UF) que você informar manualmente ou
autorizar via geolocalização do navegador (usada uma única vez para preencher
cidade/UF automaticamente, nunca rastreada continuamente).

## 3. Para que usamos seus dados (finalidades)

- Viabilizar o funcionamento da Plataforma (login, prescrição/execução de treino,
  acompanhamento nutricional, mensagens entre você e seu profissional);
- Processar pagamento de assinaturas pagas;
- Comunicação essencial sobre sua conta (confirmação de e-mail, redefinição de senha,
  avisos de cobrança);
- Exibir seu perfil profissional no diretório público, **somente se você ativar essa
  opção**;
- Segurança e prevenção de fraude/abuso (ex: limite de tentativas de login).

Nunca vendemos seus dados pessoais a terceiros, nem os usamos para publicidade de
terceiros.

## 4. Base legal (LGPD)

- **Dados de cadastro/conta e de uso do serviço**: execução de contrato (art. 7º, V) —
  necessários para prestar o serviço que você contratou ao criar a conta.
- **Dados de saúde (anamnese, histórico de treino)**: consentimento específico (art.
  11, I) — obtido no momento em que você preenche esses dados, revogável a qualquer
  momento.
- **Dados de pagamento**: execução de contrato, processados pelo Stripe conforme a
  política de privacidade própria do Stripe.

## 5. Com quem compartilhamos seus dados

Usamos os seguintes prestadores de serviço (operadores, no sentido da LGPD) para
viabilizar a Plataforma — cada um trata apenas o dado estritamente necessário à sua
função:

| Prestador | Finalidade | Dado envolvido |
|---|---|---|
| **Stripe** | Processamento de pagamento de assinaturas | Dados de pagamento, e-mail |
| **Resend** | Envio de e-mails transacionais (confirmação de conta, redefinição de senha) | E-mail, nome |
| **Google** (Sign-In) | Login opcional via conta Google | E-mail, nome, foto (se você optar por esse método de login) |
| **Google Cloud Platform** | Hospedagem da aplicação e armazenamento de mídia (fotos de perfil) | Todos os dados da conta, dados hospedados na infraestrutura |
| **Neon** (banco de dados PostgreSQL) | Armazenamento do banco de dados da aplicação | Todos os dados pessoais |
| **OpenStreetMap/Nominatim** | Conversão de coordenadas GPS em cidade/UF, só quando você usa "usar minha localização atual" | Coordenadas de geolocalização (uma única consulta, não armazenada por esse serviço) |

Cada um desses prestadores tem sua própria política de privacidade e é responsável
pela proteção do dado que processa em nosso nome. Não compartilhamos dados com
nenhum outro terceiro além destes, exceto se exigido por lei ou ordem judicial.

## 6. Seus direitos como titular dos dados (LGPD art. 18)

Você tem direito a: confirmar a existência de tratamento; acessar seus dados;
corrigir dados incompletos/desatualizados; solicitar anonimização, bloqueio ou
eliminação de dados desnecessários; solicitar portabilidade; revogar o consentimento
dado para dados sensíveis; e excluir seus dados pessoais.

**Como exercer**: a maioria desses direitos já está disponível diretamente no
aplicativo (editar perfil, excluir conta na tela de Perfil). Para qualquer outro
pedido, entre em contato pelo e-mail eliel.garcia@gmail.com.

## 7. Retenção e exclusão de dados

Você pode excluir sua própria conta a qualquer momento pela tela de Perfil. Ao fazer
isso, seus dados pessoais são apagados definitivamente do banco de dados, exceto:
- Registros que outro usuário ainda precisa manter (ex: se você era Personal e um
  aluno seu continua na plataforma, o histórico de treino DELE é preservado — só o
  vínculo com sua conta removida é desfeito);
- Trilhas de auditoria administrativa (ex: registro de que um administrador acessou
  determinada anamnese), preservadas por razões de segurança/responsabilização mesmo
  após a exclusão da conta envolvida.

Não mantemos seus dados por prazo indeterminado além do necessário — contas inativas
não são removidas automaticamente hoje; a exclusão sempre parte de uma ação sua
(tela de Perfil) ou de um pedido seu por e-mail.

## 8. Segurança

Senhas nunca são armazenadas em texto legível — usamos hash criptográfico (bcrypt).
Tokens de sessão e de verificação de e-mail/redefinição de senha também são
armazenados apenas como hash. Toda comunicação entre seu dispositivo e nossos
servidores é criptografada (HTTPS/TLS).

## 9. Cookies

Usamos cookies estritamente necessários ao funcionamento do serviço (manter você
logado com segurança) — não usamos cookies de rastreamento publicitário de
terceiros.

## 10. Menores de idade

O ThunderaFit é destinado a maiores de 18 anos (ver Termos de Uso, Seção 2) e não
coleta intencionalmente dados de menores de idade.

## 11. Alterações nesta Política

Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas
dentro do aplicativo antes de entrarem em vigor.

## 12. Contato

Dúvidas sobre esta Política ou solicitações relacionadas aos seus dados pessoais:
eliel.garcia@gmail.com.
