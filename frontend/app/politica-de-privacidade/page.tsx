import Link from "next/link";

// Fase 91: Política de Privacidade — texto canônico vive em
// docs/politica-de-privacidade.md (mesmo conteúdo, mantido em sincronia
// manualmente). Só português — documento legal específico da LGPD, não faz
// sentido "traduzir" pro público EN/ES do resto do app.
export const metadata = {
  title: "Política de Privacidade — ThunderaFit",
};

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-bold text-foreground">{children}</h2>;
}

function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="font-display text-base font-bold text-foreground">{children}</h3>;
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-relaxed text-muted">{children}</p>;
}

export default function PoliticaDePrivacidadePage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Política de Privacidade — ThunderaFit
        </h1>
        <p className="mt-1 text-xs text-muted">Última atualização: 29 de julho de 2026</p>
      </div>

      <P>
        Esta Política de Privacidade descreve como o ThunderaFit (&ldquo;nós&rdquo;) coleta, usa,
        armazena e protege seus dados pessoais, em conformidade com a Lei Geral de Proteção de
        Dados Pessoais (Lei nº 13.709/2018, &ldquo;LGPD&rdquo;).
      </P>

      <section className="flex flex-col gap-2">
        <H2>1. Quem é o controlador dos seus dados</H2>
        <P>
          <strong>Eliel Ortiz Garcia</strong>, responsável pelo ThunderaFit, com sede em
          Florianópolis, SC, Brasil, é o controlador dos dados pessoais tratados nesta Plataforma.
        </P>
        <P>
          <strong>Contato para assuntos de privacidade / encarregado (DPO)</strong>:{" "}
          <a href="mailto:eliel.garcia@gmail.com" className="font-semibold text-accent-secondary hover:underline">
            eliel.garcia@gmail.com
          </a>
          .
        </P>
      </section>

      <section className="flex flex-col gap-3">
        <H2>2. Quais dados coletamos</H2>

        <H3>2.1 Dados de cadastro e perfil (todos os usuários)</H3>
        <P>
          E-mail, senha (armazenada apenas como hash criptográfico — nunca em texto legível, nem
          por nós), nome, foto de perfil (opcional), papel na plataforma (Aluno, Personal,
          Nutricionista ou Admin), idioma preferido.
        </P>

        <H3>2.2 Dados de profissionais (Personal/Nutricionista)</H3>
        <P>
          Cidade/UF, especialidades, biografia, disponibilidade para novos alunos — exibidos
          publicamente no diretório de profissionais <strong>somente se você optar por ativar
          essa visibilidade</strong>.
        </P>

        <H3>2.3 Dados de saúde — dado pessoal sensível (LGPD art. 5º, II)</H3>
        <P>
          Quando você (Aluno) preenche a <strong>anamnese</strong>, coletamos informações de
          saúde: altura, peso, condições de saúde relatadas e outras respostas do questionário.
          Também tratamos como dado de saúde/fitness o <strong>histórico de treino</strong>{" "}
          (exercícios, séries, repetições, cargas levantadas, frequência de treino).
        </P>
        <P>
          <strong>
            Este é um dado sensível pela LGPD e seu tratamento depende do seu consentimento
            explícito
          </strong>
          , obtido através de uma confirmação específica exibida no momento em que você preenche a
          anamnese pela primeira vez — separada do aceite geral dos Termos no cadastro. Você pode
          revogar esse consentimento a qualquer momento excluindo sua conta (Seção 7).
        </P>
        <P>
          A anamnese só é visível para: você mesmo, e o(s) profissional(is) (Personal/
          Nutricionista) aos quais você está vinculado. Acessos de administradores do ThunderaFit
          à sua anamnese (ex: para suporte) são registrados numa trilha de auditoria interna.
        </P>

        <H3>2.4 Dados de pagamento</H3>
        <P>
          Não armazenamos número de cartão de crédito. Pagamentos de assinatura são processados
          inteiramente pelo <strong>Stripe</strong> (processador de pagamento terceirizado) —
          guardamos apenas um identificador de referência da sua assinatura no Stripe, nunca o
          dado do cartão em si.
        </P>

        <H3>2.5 Dados técnicos e de uso</H3>
        <P>
          Endereço IP no momento do login (para segurança/prevenção de abuso), data/hora de
          acesso, e dados de localização aproximada (cidade/UF) que você informar manualmente ou
          autorizar via geolocalização do navegador (usada uma única vez para preencher cidade/UF
          automaticamente, nunca rastreada continuamente).
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>3. Para que usamos seus dados (finalidades)</H2>
        <ul className="ml-4 list-disc text-sm leading-relaxed text-muted">
          <li>
            Viabilizar o funcionamento da Plataforma (login, prescrição/execução de treino,
            acompanhamento nutricional, mensagens entre você e seu profissional);
          </li>
          <li>Processar pagamento de assinaturas pagas;</li>
          <li>
            Comunicação essencial sobre sua conta (confirmação de e-mail, redefinição de senha,
            avisos de cobrança);
          </li>
          <li>
            Exibir seu perfil profissional no diretório público, somente se você ativar essa
            opção;
          </li>
          <li>Segurança e prevenção de fraude/abuso (ex: limite de tentativas de login).</li>
        </ul>
        <P>
          Nunca vendemos seus dados pessoais a terceiros, nem os usamos para publicidade de
          terceiros.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>4. Base legal (LGPD)</H2>
        <ul className="ml-4 list-disc text-sm leading-relaxed text-muted">
          <li>
            <strong>Dados de cadastro/conta e de uso do serviço</strong>: execução de contrato
            (art. 7º, V) — necessários para prestar o serviço que você contratou ao criar a conta.
          </li>
          <li>
            <strong>Dados de saúde (anamnese, histórico de treino)</strong>: consentimento
            específico (art. 11, I) — obtido no momento em que você preenche esses dados,
            revogável a qualquer momento.
          </li>
          <li>
            <strong>Dados de pagamento</strong>: execução de contrato, processados pelo Stripe
            conforme a política de privacidade própria do Stripe.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <H2>5. Com quem compartilhamos seus dados</H2>
        <P>
          Usamos os seguintes prestadores de serviço (operadores, no sentido da LGPD) para
          viabilizar a Plataforma — cada um trata apenas o dado estritamente necessário à sua
          função:
        </P>
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="p-2 font-semibold text-foreground">Prestador</th>
                <th className="p-2 font-semibold text-foreground">Finalidade</th>
                <th className="p-2 font-semibold text-foreground">Dado envolvido</th>
              </tr>
            </thead>
            <tbody className="text-muted">
              <tr className="border-b border-border">
                <td className="p-2 font-semibold">Stripe</td>
                <td className="p-2">Processamento de pagamento de assinaturas</td>
                <td className="p-2">Dados de pagamento, e-mail</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-2 font-semibold">Resend</td>
                <td className="p-2">
                  Envio de e-mails transacionais (confirmação de conta, redefinição de senha)
                </td>
                <td className="p-2">E-mail, nome</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-2 font-semibold">Google (Sign-In)</td>
                <td className="p-2">Login opcional via conta Google</td>
                <td className="p-2">E-mail, nome, foto (se você optar por esse método de login)</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-2 font-semibold">Google Cloud Platform</td>
                <td className="p-2">Hospedagem da aplicação e armazenamento de mídia (fotos de perfil)</td>
                <td className="p-2">Todos os dados da conta, dados hospedados na infraestrutura</td>
              </tr>
              <tr className="border-b border-border">
                <td className="p-2 font-semibold">Neon (banco de dados)</td>
                <td className="p-2">Armazenamento do banco de dados da aplicação</td>
                <td className="p-2">Todos os dados pessoais</td>
              </tr>
              <tr>
                <td className="p-2 font-semibold">OpenStreetMap/Nominatim</td>
                <td className="p-2">
                  Conversão de coordenadas GPS em cidade/UF, só quando você usa &ldquo;usar minha
                  localização atual&rdquo;
                </td>
                <td className="p-2">
                  Coordenadas de geolocalização (uma única consulta, não armazenada por esse
                  serviço)
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <P>
          Cada um desses prestadores tem sua própria política de privacidade e é responsável pela
          proteção do dado que processa em nosso nome. Não compartilhamos dados com nenhum outro
          terceiro além destes, exceto se exigido por lei ou ordem judicial.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>6. Seus direitos como titular dos dados (LGPD art. 18)</H2>
        <P>
          Você tem direito a: confirmar a existência de tratamento; acessar seus dados; corrigir
          dados incompletos/desatualizados; solicitar anonimização, bloqueio ou eliminação de
          dados desnecessários; solicitar portabilidade; revogar o consentimento dado para dados
          sensíveis; e excluir seus dados pessoais.
        </P>
        <P>
          <strong>Como exercer</strong>: a maioria desses direitos já está disponível diretamente
          no aplicativo (editar perfil, excluir conta na tela de Perfil). Para qualquer outro
          pedido, entre em contato pelo e-mail{" "}
          <a href="mailto:eliel.garcia@gmail.com" className="font-semibold text-accent-secondary hover:underline">
            eliel.garcia@gmail.com
          </a>
          .
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>7. Retenção e exclusão de dados</H2>
        <P>
          Você pode excluir sua própria conta a qualquer momento pela tela de Perfil. Ao fazer
          isso, seus dados pessoais são apagados definitivamente do banco de dados, exceto:
        </P>
        <ul className="ml-4 list-disc text-sm leading-relaxed text-muted">
          <li>
            Registros que outro usuário ainda precisa manter (ex: se você era Personal e um aluno
            seu continua na plataforma, o histórico de treino dele é preservado — só o vínculo com
            sua conta removida é desfeito);
          </li>
          <li>
            Trilhas de auditoria administrativa (ex: registro de que um administrador acessou
            determinada anamnese), preservadas por razões de segurança/responsabilização mesmo
            após a exclusão da conta envolvida.
          </li>
        </ul>
        <P>
          Não mantemos seus dados por prazo indeterminado além do necessário — contas inativas não
          são removidas automaticamente hoje; a exclusão sempre parte de uma ação sua (tela de
          Perfil) ou de um pedido seu por e-mail.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>8. Segurança</H2>
        <P>
          Senhas nunca são armazenadas em texto legível — usamos hash criptográfico (bcrypt).
          Tokens de sessão e de verificação de e-mail/redefinição de senha também são armazenados
          apenas como hash. Toda comunicação entre seu dispositivo e nossos servidores é
          criptografada (HTTPS/TLS).
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>9. Cookies</H2>
        <P>
          Usamos cookies estritamente necessários ao funcionamento do serviço (manter você logado
          com segurança) — não usamos cookies de rastreamento publicitário de terceiros.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>10. Menores de idade</H2>
        <P>
          O ThunderaFit é destinado a maiores de 18 anos (ver{" "}
          <Link href="/termos-de-uso" className="font-semibold text-accent-secondary hover:underline">
            Termos de Uso
          </Link>
          , Seção 2) e não coleta intencionalmente dados de menores de idade.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>11. Alterações nesta Política</H2>
        <P>
          Podemos atualizar esta Política periodicamente. Mudanças relevantes serão comunicadas
          dentro do aplicativo antes de entrarem em vigor.
        </P>
      </section>

      <section className="flex flex-col gap-2 pb-6">
        <H2>12. Contato</H2>
        <P>
          Dúvidas sobre esta Política ou solicitações relacionadas aos seus dados pessoais:{" "}
          <a href="mailto:eliel.garcia@gmail.com" className="font-semibold text-accent-secondary hover:underline">
            eliel.garcia@gmail.com
          </a>
          .
        </P>
      </section>
    </main>
  );
}
