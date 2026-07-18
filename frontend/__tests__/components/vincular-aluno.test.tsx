import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import VincularAlunoPage from "@/app/personal/alunos/novo/page";
import { lookupAlunoByEmail, createRelation } from "@/lib/api/relations";
import { ApiError } from "@/lib/api/client";

const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push, replace: jest.fn() }),
}));

jest.mock("@/components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/app-header", () => ({
  AppHeader: () => null,
}));

jest.mock("@/lib/api/relations", () => ({
  lookupAlunoByEmail: jest.fn(),
  createRelation: jest.fn(),
}));

const mockedLookup = lookupAlunoByEmail as jest.Mock;
const mockedCreateRelation = createRelation as jest.Mock;

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <VincularAlunoPage />
    </QueryClientProvider>
  );
}

async function submit(email: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("E-mail do aluno"), email);
  await user.click(screen.getByRole("button", { name: /vincular aluno/i }));
}

beforeEach(() => {
  push.mockClear();
  mockedLookup.mockReset();
  mockedCreateRelation.mockReset();
});

describe("Tela de vincular novo aluno", () => {
  it("sucesso: navega para o dashboard do personal", async () => {
    mockedLookup.mockResolvedValue({ user: { id: "aluno-1", email: "aluno@x.com", role: "ALUNO" } });
    mockedCreateRelation.mockResolvedValue({ relation: { id: "rel-1" } });

    renderPage();
    await submit("aluno@x.com");

    await waitFor(() => expect(push).toHaveBeenCalledWith("/personal/dashboard"));
  });

  it("404: mostra mensagem acionável com botão de copiar convite (Fase 12)", async () => {
    mockedLookup.mockRejectedValue(new ApiError(404, "Aluno não encontrado com este e-mail."));

    renderPage();
    await submit("naoexiste@x.com");

    expect(
      await screen.findByText(
        "Esse e-mail ainda não tem conta no ThunderaFit. Peça para seu aluno se cadastrar primeiro."
      )
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();

    const user = userEvent.setup();

    // userEvent.setup() instala seu próprio stub de clipboard — por isso o
    // mock só pode ser definido DEPOIS da última chamada a setup(), ou ele é
    // sobrescrito antes do clique acontecer.
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });

    await user.click(screen.getByRole("button", { name: "Copiar convite para compartilhar" }));

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("/login"));
    expect(await screen.findByText("Convite copiado!")).toBeInTheDocument();
  });

  it("409: mostra mensagem específica de vínculo já existente", async () => {
    mockedLookup.mockResolvedValue({ user: { id: "aluno-2", email: "ja@x.com", role: "ALUNO" } });
    mockedCreateRelation.mockRejectedValue(new ApiError(409, "Vínculo já existe."));

    renderPage();
    await submit("ja@x.com");

    expect(await screen.findByText("Esse aluno já está vinculado a você.")).toBeInTheDocument();
  });

  it("403: mostra mensagem específica de limite atingido", async () => {
    mockedLookup.mockResolvedValue({ user: { id: "aluno-3", email: "limite@x.com", role: "ALUNO" } });
    mockedCreateRelation.mockRejectedValue(new ApiError(403, "Limite de alunos atingido."));

    renderPage();
    await submit("limite@x.com");

    expect(
      await screen.findByText("Você atingiu o limite de alunos do seu plano. Faça upgrade para vincular mais.")
    ).toBeInTheDocument();
  });
});
