import Link from "next/link";

// Fase 91: Termos de Uso — texto canônico vive em docs/termos-de-uso.md
// (mesmo conteúdo, mantido em sincronia manualmente — nenhuma pipeline de
// markdown foi introduzida só pra 2 páginas estáticas). Só português —
// documento legal específico da legislação brasileira (CDC/LGPD), não faz
// sentido "traduzir" pro público EN/ES do resto do app.
export const metadata = {
  title: "Termos de Uso — ThunderaFit",
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

export default function TermosDeUsoPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-10">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          Termos de Uso — ThunderaFit
        </h1>
        <p className="mt-1 text-xs text-muted">Última atualização: 29 de julho de 2026</p>
      </div>

      <section className="flex flex-col gap-2">
        <H2>1. Quem somos e o que é o ThunderaFit</H2>
        <P>
          O ThunderaFit é uma plataforma de software (aplicativo web e, futuramente, aplicativo
          para Android/iOS) operada por <strong>Eliel Ortiz Garcia</strong>, com sede em
          Florianópolis, SC, Brasil, doravante &ldquo;ThunderaFit&rdquo;, &ldquo;nós&rdquo; ou
          &ldquo;a Plataforma&rdquo;.
        </P>
        <P>
          O ThunderaFit <strong>conecta profissionais de educação física e nutrição</strong>{" "}
          (&ldquo;Personal&rdquo; e &ldquo;Nutricionista&rdquo;) <strong>a seus alunos/clientes</strong>{" "}
          (&ldquo;Aluno&rdquo;), oferecendo ferramentas para prescrição, execução e acompanhamento de
          treinos e planos alimentares. O ThunderaFit também permite que um Aluno monte e execute
          treinos por conta própria, sem necessariamente ter um profissional vinculado
          (&ldquo;Aluno Solo&rdquo;).
        </P>
        <P>
          <strong>
            O ThunderaFit é uma ferramenta de software. Não somos uma clínica, consultório,
            academia, personal trainer, nutricionista ou qualquer tipo de prestador de serviço de
            saúde, educação física ou nutrição
          </strong>{" "}
          — ver Seção 4 abaixo, o ponto mais importante destes Termos.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>2. Aceite</H2>
        <P>
          Ao criar uma conta no ThunderaFit, você declara que leu, entendeu e concorda
          integralmente com estes Termos de Uso e com a nossa{" "}
          <Link href="/politica-de-privacidade" className="font-semibold text-accent-secondary hover:underline">
            Política de Privacidade
          </Link>
          . Se você não concordar com qualquer parte destes Termos, não deve criar uma conta nem
          usar a Plataforma.
        </P>
        <P>
          <strong>Idade mínima</strong>: o ThunderaFit é destinado a maiores de 18 (dezoito) anos.
          Ao criar uma conta, você declara ter 18 anos ou mais. Contas de menores de idade
          identificadas serão suspensas.
        </P>
      </section>

      <section className="flex flex-col gap-3">
        <H2>3. Papéis na plataforma e responsabilidade de cada um</H2>
        <P>
          Esta é a seção mais importante pra entender como a responsabilidade é dividida entre
          quem usa o ThunderaFit.
        </P>

        <H3>3.1 Personal Trainer / Nutricionista</H3>
        <P>
          O Personal e o Nutricionista são <strong>profissionais independentes</strong>, não
          empregados, prepostos ou representantes do ThunderaFit. Cada um é o{" "}
          <strong>único responsável</strong> por:
        </P>
        <ul className="ml-4 list-disc text-sm leading-relaxed text-muted">
          <li>
            Possuir a formação, registro profissional (ex: CREF para Educação Física, CRN para
            Nutrição) e qualificação técnica exigidos por lei para exercer sua profissão;
          </li>
          <li>
            Avaliar adequadamente a condição física, de saúde e as limitações de cada Aluno antes
            de prescrever qualquer treino ou plano alimentar;
          </li>
          <li>A adequação, segurança e correção técnica de tudo que prescrever através da Plataforma;</li>
          <li>Cumprir o código de ética e as normas do seu conselho profissional.</li>
        </ul>
        <P>
          O ThunderaFit não revisa, valida ou audita o conteúdo técnico de nenhuma prescrição
          feita por um profissional — apenas fornece a ferramenta de software para registrá-la e
          compartilhá-la com o Aluno.
        </P>

        <H3>3.2 Aluno (com profissional vinculado)</H3>
        <P>
          Ao vincular-se a um Personal ou Nutricionista através da Plataforma, o Aluno reconhece
          que a relação profissional (inclusive eventual cobrança por aquele serviço, orientação e
          acompanhamento) é estabelecida <strong>diretamente entre o Aluno e o profissional</strong>,
          fora do ThunderaFit — o ThunderaFit não é parte dessa relação, não intermedeia pagamento
          entre Aluno e profissional, e não responde por sua qualidade, resultado ou eventuais
          danos dela decorrentes.
        </P>

        <H3>3.3 Aluno Solo (monta/executa o próprio treino)</H3>
        <P>
          Quando o Aluno usa a Plataforma para montar, escolher ou executar um treino{" "}
          <strong>sem um profissional acompanhando</strong> (área &ldquo;Meu Treino
          Pessoal&rdquo;), o Aluno é o <strong>único responsável</strong> por avaliar sua própria
          condição de saúde e capacidade física antes de executar qualquer exercício, e por
          executar cada movimento com a técnica adequada.
        </P>
        <P>
          <strong>
            Recomendamos fortemente que você consulte um médico antes de iniciar qualquer programa
            de atividade física
          </strong>
          , especialmente se tiver qualquer condição de saúde preexistente, estiver grávida, ou
          não praticar exercícios há muito tempo.
        </P>

        <H3>3.4 ThunderaFit (a Plataforma)</H3>
        <P>
          O ThunderaFit fornece exclusivamente o software — a infraestrutura para prescrever,
          registrar, acompanhar e visualizar treinos e planos alimentares. Não prestamos
          consultoria médica, nutricional ou de educação física, não avaliamos a condição de
          saúde de nenhum usuário, e não garantimos resultado, adequação ou segurança de nenhum
          treino ou plano alimentar registrado por profissionais ou por Alunos Solo na Plataforma.
        </P>
      </section>

      <section className="flex flex-col gap-2 rounded-md border border-accent/40 bg-accent/10 p-4">
        <H2>4. Isenção de responsabilidade médica e física (leia com atenção)</H2>
        <P>
          <strong>
            O ThunderaFit é uma ferramenta de software, não um médico, personal trainer ou
            nutricionista.
          </strong>{" "}
          A prática de atividade física e a adoção de qualquer plano alimentar envolvem riscos
          inerentes, incluindo risco de lesão. Ao usar a Plataforma, você reconhece que:
        </P>
        <ol className="ml-4 list-decimal text-sm leading-relaxed text-muted">
          <li>
            Nenhuma informação, treino, plano alimentar ou funcionalidade da Plataforma substitui
            avaliação, diagnóstico ou acompanhamento médico profissional;
          </li>
          <li>
            Cabe exclusivamente a você (e, quando houver, ao profissional que o acompanha) avaliar
            se está apto a realizar determinado exercício ou seguir determinado plano;
          </li>
          <li>
            O ThunderaFit não se responsabiliza por lesões, agravamento de condições de saúde
            preexistentes, ou qualquer dano decorrente da execução de treinos ou planos
            alimentares registrados na Plataforma, seja por um profissional vinculado ou pelo
            próprio Aluno (Aluno Solo);
          </li>
          <li>
            Esta seção não pretende afastar responsabilidade por defeito comprovado do próprio
            software (ex: um bug que exiba uma prescrição diferente da que o profissional
            realmente registrou) — isso permanece coberto pela Seção 10 (Limitação de
            Responsabilidade) e pelo Código de Defesa do Consumidor.
          </li>
        </ol>
      </section>

      <section className="flex flex-col gap-3">
        <H2>5. Planos, cobrança e cancelamento</H2>

        <H3>5.1 Estrutura de planos</H3>
        <P>O ThunderaFit opera num modelo Freemium:</P>
        <ul className="ml-4 list-disc text-sm leading-relaxed text-muted">
          <li>
            <strong>Aluno</strong>: uso gratuito para treinar com um profissional vinculado ou
            montar o próprio treino com templates gratuitos; o degrau Aluno Premium é opcional,
            pago, com teste grátis de 7 dias, e libera funcionalidades adicionais (montar/editar o
            próprio treino do zero, catálogo de templates premium).
          </li>
          <li>
            <strong>Personal / Nutricionista</strong>: uso gratuito com limite de até 3 alunos
            vinculados (plano Free). Os planos pagos Base (até 20 alunos) e Plus (alunos
            ilimitados) removem esse limite e liberam a disponibilidade no diretório público de
            profissionais.
          </li>
        </ul>
        <P>
          Os valores e condições vigentes de cada plano são sempre os exibidos na tela de upgrade
          dentro do aplicativo no momento da contratação — este documento não fixa preços, que
          podem mudar mediante aviso prévio na própria Plataforma.
        </P>

        <H3>5.2 Cobrança</H3>
        <P>
          Assinaturas pagas são processadas por um provedor de pagamento terceirizado (Stripe) —
          o ThunderaFit nunca recebe nem armazena o número do seu cartão. A cobrança é recorrente
          (mensal ou trimestral, conforme o plano escolhido) até o cancelamento.
        </P>

        <H3>5.3 Direito de arrependimento</H3>
        <P>
          Nos termos do artigo 49 do Código de Defesa do Consumidor, você tem o direito de
          desistir da contratação de um plano pago em até <strong>7 (sete) dias corridos</strong>{" "}
          a partir da data da primeira cobrança, com reembolso integral, sem necessidade de
          justificativa. Para exercer esse direito, entre em contato através de{" "}
          <a href="mailto:eliel.garcia@gmail.com" className="font-semibold text-accent-secondary hover:underline">
            eliel.garcia@gmail.com
          </a>
          .
        </P>

        <H3>5.4 Cancelamento e efeitos</H3>
        <P>
          Você pode cancelar sua assinatura a qualquer momento através do Portal de Gerenciamento
          de Assinatura (Stripe), acessível dentro do aplicativo. O cancelamento:
        </P>
        <ul className="ml-4 list-disc text-sm leading-relaxed text-muted">
          <li>
            Bloqueia a criação de <strong>novos</strong> vínculos de aluno (Personal/Nutricionista)
            ou de novos treinos premium (Aluno) além do limite do plano Free, a partir do momento
            em que a assinatura deixa de estar ativa;
          </li>
          <li>
            <strong>Não desfaz</strong> vínculos, treinos ou dados já existentes — alunos já
            vinculados continuam vinculados, o histórico de treino/progresso continua acessível;
          </li>
          <li>
            Não gera reembolso proporcional ao período não utilizado do ciclo já pago (exceto
            dentro do prazo de arrependimento da Seção 5.3), salvo disposição legal em contrário.
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <H2>6. Conteúdo e dados inseridos na Plataforma</H2>
        <P>
          Você é responsável pela veracidade das informações que insere na Plataforma, incluindo
          dados de anamnese (saúde), medidas corporais, e conteúdo de treino/prescrição. O
          tratamento desses dados, especialmente os de saúde, segue nossa{" "}
          <Link href="/politica-de-privacidade" className="font-semibold text-accent-secondary hover:underline">
            Política de Privacidade
          </Link>
          .
        </P>
        <P>
          O profissional que prescreve um treino/plano para um Aluno mantém a titularidade sobre o
          conteúdo técnico que criou, mas concede ao ThunderaFit e ao próprio Aluno vinculado o
          direito de acessar, exibir e armazenar esse conteúdo dentro da Plataforma, para o
          funcionamento do serviço.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>7. Condutas proibidas</H2>
        <P>
          Não é permitido: usar a Plataforma para fins diferentes de prescrição/execução legítima
          de treino e acompanhamento nutricional; se passar por profissional qualificado sem
          sê-lo; tentar acessar dados de outros usuários sem autorização; usar a Plataforma de
          forma que viole lei aplicável.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>8. Suspensão e encerramento de conta</H2>
        <P>
          Podemos suspender ou encerrar contas que violem estes Termos. Você pode excluir sua
          própria conta a qualquer momento pela tela de Perfil, o que apaga (ou desvincula, quando
          o dado pertencer a outro usuário) seus dados conforme detalhado na{" "}
          <Link href="/politica-de-privacidade" className="font-semibold text-accent-secondary hover:underline">
            Política de Privacidade
          </Link>
          .
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>9. Alterações destes Termos</H2>
        <P>
          Podemos atualizar estes Termos periodicamente. Mudanças relevantes serão comunicadas
          dentro do aplicativo antes de entrarem em vigor. O uso continuado da Plataforma após a
          mudança entrar em vigor constitui aceite dos novos Termos.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>10. Limitação de responsabilidade</H2>
        <P>
          Na máxima medida permitida pela legislação aplicável, o ThunderaFit não se
          responsabiliza por: danos indiretos, lucros cessantes, ou perda de dados decorrentes de
          uso indevido da Plataforma por terceiros; indisponibilidade temporária do serviço por
          manutenção, falha de provedores de infraestrutura (hospedagem, banco de dados,
          processamento de pagamento) fora do nosso controle direto; e pelo conteúdo técnico de
          prescrições de profissionais terceiros, conforme detalhado nas Seções 3 e 4 acima. Esta
          seção não afasta a responsabilidade do ThunderaFit por vício comprovado do próprio
          software, nos termos do Código de Defesa do Consumidor.
        </P>
      </section>

      <section className="flex flex-col gap-2">
        <H2>11. Lei aplicável e foro</H2>
        <P>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o
          foro da comarca de Florianópolis, SC, para dirimir quaisquer controvérsias decorrentes
          destes Termos, com renúncia a qualquer outro, por mais privilegiado que seja, ressalvado
          o foro do domicílio do consumidor, quando aplicável por lei.
        </P>
      </section>

      <section className="flex flex-col gap-2 pb-6">
        <H2>12. Contato</H2>
        <P>
          Dúvidas sobre estes Termos:{" "}
          <a href="mailto:eliel.garcia@gmail.com" className="font-semibold text-accent-secondary hover:underline">
            eliel.garcia@gmail.com
          </a>
          .
        </P>
      </section>
    </main>
  );
}
