import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import VincularAlunoPage from "@/app/personal/alunos/novo/page";
import { createClientInvite } from "@/lib/api/client-invites";
import { ApiError } from "@/lib/api/client";
import ptMessages from "@/messages/pt.json";

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn() }),
}));

jest.mock("@/components/auth-guard", () => ({
  AuthGuard: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock("@/components/app-header", () => ({
  AppHeader: () => null,
}));

jest.mock("@/lib/api/client-invites", () => ({
  createClientInvite: jest.fn(),
}));

const mockedCreateInvite = createClientInvite as jest.Mock;

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <QueryClientProvider client={queryClient}>
        <VincularAlunoPage />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

async function submit(label: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Apelido do convite"), label);
  await user.click(screen.getByRole("button", { name: /gerar convite/i }));
}

beforeEach(() => {
  mockedCreateInvite.mockReset();
});

describe("Tela de convidar novo aluno (Fase 104 — substitui o fluxo de e-mail)", () => {
  it("sucesso: mostra o link do convite pronto pra compartilhar (WhatsApp + copiar)", async () => {
    mockedCreateInvite.mockResolvedValue({
      invite: { id: "inv-1", label: "João da academia" },
      token: "abc123tokenxyz",
    });

    renderPage();
    await submit("João da academia");

    expect(await screen.findByText("Convite pronto!")).toBeInTheDocument();
    expect(mockedCreateInvite).toHaveBeenCalledWith("João da academia");

    const whatsappLink = screen.getByRole("link", { name: "Enviar no WhatsApp" });
    expect(whatsappLink).toHaveAttribute("href", expect.stringContaining("https://wa.me/?text="));
    const decoded = decodeURIComponent(whatsappLink.getAttribute("href")!.split("?text=")[1]);
    expect(decoded).toContain("/login?invite=abc123tokenxyz");
    expect(whatsappLink).toHaveAttribute("target", "_blank");

    expect(screen.getByRole("button", { name: "Copiar link" })).toBeInTheDocument();
  });

  it("erro (ex: limite de alunos atingido): mostra a mensagem real do backend", async () => {
    mockedCreateInvite.mockRejectedValue(new ApiError(403, "Limite de alunos atingido."));

    renderPage();
    await submit("Maria");

    expect(await screen.findByText("Limite de alunos atingido.")).toBeInTheDocument();
  });

  it("botão fica desabilitado sem apelido preenchido", () => {
    renderPage();
    expect(screen.getByRole("button", { name: /gerar convite/i })).toBeDisabled();
  });
});
