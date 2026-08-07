import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { DeleteSessionButton } from "@/components/delete-session-button";
import { deleteWorkoutSession } from "@/lib/api/workouts";
import ptMessages from "@/messages/pt.json";

jest.mock("@/lib/api/workouts", () => ({
  deleteWorkoutSession: jest.fn(),
}));

const mockedDelete = deleteWorkoutSession as jest.Mock;

function renderButton(onDeleted?: () => void) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <QueryClientProvider client={queryClient}>
        <DeleteSessionButton workoutId="w-1" sessionLabel="A" onDeleted={onDeleted} />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  mockedDelete.mockReset();
  mockedDelete.mockResolvedValue({});
});

/**
 * Fase 123 — bug reportado pelo fundador: "a mensagem de exclusão do treino
 * trunca a tela, não é responsiva a mensagem vermelha de exclusão".
 *
 * A causa era de LAYOUT, não de texto: a confirmação era um box inline dentro
 * de um item `shrink-0` de uma linha flex, e o texto tem 150+ caracteres. Sem
 * poder encolher, o box empurrava a linha além da viewport e a página ganhava
 * scroll horizontal.
 *
 * Jest/jsdom não faz layout, então testar "não trunca" medindo pixels é
 * impossível aqui. O que estes testes travam é a MUDANÇA ESTRUTURAL que
 * corrige o bug — a confirmação sai do fluxo da linha e passa a ser um diálogo
 * em overlay — mais o comportamento de confirmação em si, que precisa continuar
 * intacto depois da refatoração. A verificação visual em largura de celular é
 * manual, e está registrada no STATUS.md.
 */
describe("DeleteSessionButton", () => {
  it("não mostra confirmação nenhuma antes do primeiro clique", () => {
    renderButton();

    expect(screen.getByRole("button", { name: /excluir a sessão A/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("confirma em DIÁLOGO (não em box inline), que é o que corrige o truncamento", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: /excluir a sessão A/i }));

    // `role=dialog` é a garantia estrutural: em overlay `fixed`, a confirmação
    // não participa mais do fluxo da linha flex e não pode esticá-la.
    const dialogo = screen.getByRole("dialog");
    expect(dialogo).toBeInTheDocument();
    expect(dialogo).toHaveAttribute("aria-modal", "true");
    expect(dialogo).toHaveTextContent(/não pode ser desfeita/i);
  });

  it("mantém o gatilho renderizado com o diálogo aberto (era a troca que remexia a linha)", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: /excluir a sessão A/i }));

    // Antes o box de confirmação SUBSTITUÍA o botão; agora ele coexiste, então
    // a largura que o componente ocupa na linha nunca muda.
    expect(screen.getByRole("button", { name: /excluir a sessão A/i })).toBeInTheDocument();
  });

  it("só exclui no segundo clique, e avisa quem chamou", async () => {
    const user = userEvent.setup();
    const onDeleted = jest.fn();
    renderButton(onDeleted);

    await user.click(screen.getByRole("button", { name: /excluir a sessão A/i }));
    expect(mockedDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: /sim, excluir/i }));

    await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith("w-1"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("cancelar fecha o diálogo sem chamar a API", async () => {
    const user = userEvent.setup();
    renderButton();

    await user.click(screen.getByRole("button", { name: /excluir a sessão A/i }));
    await user.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockedDelete).not.toHaveBeenCalled();
  });

  it("erro da API aparece DENTRO do diálogo, que continua aberto", async () => {
    const user = userEvent.setup();
    mockedDelete.mockRejectedValue(new Error("boom"));
    renderButton();

    await user.click(screen.getByRole("button", { name: /excluir a sessão A/i }));
    await user.click(screen.getByRole("button", { name: /sim, excluir/i }));

    // Fechar o diálogo no erro esconderia a mensagem — o usuário tem que poder
    // ler o que falhou e decidir se tenta de novo.
    await waitFor(() =>
      expect(screen.getByRole("dialog")).toHaveTextContent(/erro ao excluir a sessão/i)
    );
  });

  it("não navega: o clique não vaza pro link em volta", async () => {
    const user = userEvent.setup();
    const onLinkClick = jest.fn();
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
    });

    // Reproduz o aninhamento que existia na tela do Personal até a Fase 123.
    // Mesmo com a estrutura corrigida (controles como IRMÃOS do link), o
    // componente tem que continuar seguro se alguém voltar a aninhá-lo.
    render(
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <QueryClientProvider client={queryClient}>
          {/* Âncora com URL ABSOLUTA de propósito: o `<Link>` do card aponta pra
              uma rota interna, mas usar `/treinos/w-1` aqui viola a regra
              `@next/next/no-html-link-for-pages`. O que o teste precisa é de uma
              âncora de verdade, com ação default de navegação — o host é
              irrelevante. */}
          <a href="https://exemplo.test/treinos/w-1" onClick={onLinkClick}>
            <DeleteSessionButton workoutId="w-1" sessionLabel="A" />
          </a>
        </QueryClientProvider>
      </NextIntlClientProvider>
    );

    await user.click(screen.getByRole("button", { name: /excluir a sessão A/i }));

    expect(onLinkClick).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
