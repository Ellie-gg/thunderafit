import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import ProgramaDetalhePage from "@/app/personal/programas/[id]/page";
import { getWorkoutProgram, changeWorkoutSessionLetter } from "@/lib/api/workouts";
import { listRelations } from "@/lib/api/relations";
import ptMessages from "@/messages/pt.json";

jest.mock("next/navigation", () => ({
  useParams: () => ({ id: "prog-1" }),
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("@/components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/app-header", () => ({
  AppHeader: () => null,
}));

jest.mock("@/lib/api/workouts", () => ({
  getWorkoutProgram: jest.fn(),
  changeWorkoutSessionLetter: jest.fn(),
  addProgramSession: jest.fn(),
  applyProgram: jest.fn(),
  saveInstanceAsTemplate: jest.fn(),
  renameWorkoutProgram: jest.fn(),
  deleteWorkoutSession: jest.fn(),
  deleteWorkoutProgram: jest.fn(),
}));

jest.mock("@/lib/api/relations", () => ({
  listRelations: jest.fn(),
}));

const mockedGetProgram = getWorkoutProgram as jest.Mock;
const mockedChangeLetter = changeWorkoutSessionLetter as jest.Mock;
const mockedListRelations = listRelations as jest.Mock;

beforeEach(() => {
  mockedGetProgram.mockReset();
  mockedChangeLetter.mockReset();
  mockedListRelations.mockReset();

  mockedChangeLetter.mockResolvedValue({});
  mockedListRelations.mockResolvedValue({ relations: [] });
  mockedGetProgram.mockResolvedValue({
    program: {
      id: "prog-1",
      name: "Programa Teste",
      sessionScheme: "LETTERS",
      workouts: [
        { id: "w-1", letter: "A", name: "Peito", exercises: [] },
        { id: "w-2", letter: "B", name: "Costas", exercises: [] },
      ],
    },
  });
});

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <QueryClientProvider client={queryClient}>
        <ProgramaDetalhePage />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

/**
 * Fase 123 — bug reportado pelo fundador: "ao clicar pra trocar de letra, a
 * funcionalidade que vc implementou, ele entra direto no treino".
 *
 * A causa: esta tela envolvia o CARD INTEIRO num `<Link>`, com o
 * `SessionKeyPicker` e o botão de excluir dentro dele. Navegar é a AÇÃO DEFAULT
 * da âncora, não um handler de clique, então o `stopPropagation()` do picker não
 * impedia nada — e num `<select>` não dá pra usar `preventDefault()` sem risco
 * (o dropdown abre no `mousedown`). `<select>` dentro de `<a>` também é HTML
 * inválido.
 *
 * A correção é ESTRUTURAL: o `<Link>` passa a envolver só o conteúdo do card, e
 * os controles são IRMÃOS dele — que é como a tela do ALUNO (`/programas/[id]`)
 * já fazia desde a Fase 85. Este teste trava exatamente esse invariante: nenhum
 * controle interativo pode voltar a ser descendente da âncora do card.
 */
describe("tela de detalhe do programa (Personal) — controles fora da âncora", () => {
  it("nenhum picker de letra/dia é descendente de link", async () => {
    renderPage();

    const selects = await screen.findAllByLabelText(/mudar a letra ou o dia da semana/i, {
      selector: "select",
    });

    // Assertivo em TODAS as sessões, não só na primeira: o bug vinha do JSX do
    // `.map`, então uma corrigida e outra não é um estado impossível — mas
    // checar todas mantém o teste honesto se a estrutura virar condicional.
    expect(selects).toHaveLength(2);
    // `closest("a")` é a asserção que reproduz o bug: enquanto o picker estava
    // dentro do `<Link>` do card, isso devolvia a âncora e clicar navegava.
    selects.forEach((select) => expect(select.closest("a")).toBeNull());
  });

  it("o botão de excluir sessão também não é descendente de link", async () => {
    renderPage();

    const excluir = await screen.findByRole("button", { name: /excluir a sessão A/i });
    expect(excluir.closest("a")).toBeNull();
  });

  it("o card em si continua sendo um link pra tela de prescrição", async () => {
    renderPage();

    // A correção não pode ter custado a navegação: abrir a sessão é o caminho
    // principal desta tela.
    await waitFor(() => expect(screen.getByText("Peito")).toBeInTheDocument());
    const link = screen.getByText("Peito").closest("a");
    expect(link).toHaveAttribute("href", "/personal/programas/prog-1/sessoes/w-1");
  });

  it("trocar a letra chama a API e não navega", async () => {
    const user = userEvent.setup();
    renderPage();

    const selects = await screen.findAllByLabelText(/mudar a letra ou o dia da semana/i, {
      selector: "select",
    });

    // A sessão "A" oferece a atual + as livres (C, D, E — B está ocupada).
    await user.selectOptions(selects[0], "C");

    await waitFor(() => expect(mockedChangeLetter).toHaveBeenCalledWith("w-1", "C"));
  });
});
