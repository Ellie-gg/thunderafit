import { screen } from "@testing-library/react";
import { AuthGuard } from "@/components/auth-guard";
import { useAuthStore } from "@/lib/store/auth-store";
import { onAuthExpired } from "@/lib/api/client";
import { renderWithIntl as render } from "@/lib/i18n-test-utils";

const replace = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace }),
}));

jest.mock("@/lib/store/auth-store", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/lib/api/client", () => ({
  onAuthExpired: jest.fn(),
  ApiError: class ApiError extends Error {},
}));

const mockedUseAuthStore = useAuthStore as unknown as jest.Mock;

function setStore(overrides: Partial<ReturnType<typeof useAuthStore>>) {
  mockedUseAuthStore.mockReturnValue({
    user: null,
    isHydrated: true,
    hydrate: jest.fn(),
    clearSession: jest.fn(),
    setSession: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  replace.mockClear();
});

describe("AuthGuard", () => {
  it("mostra 'Carregando...' antes de hidratar", () => {
    setStore({ isHydrated: false, user: null });
    render(
      <AuthGuard>
        <div>Conteúdo protegido</div>
      </AuthGuard>
    );
    expect(screen.getByText("Carregando...")).toBeInTheDocument();
    expect(screen.queryByText("Conteúdo protegido")).not.toBeInTheDocument();
  });

  it("redireciona para /login quando hidratado e sem usuário", () => {
    setStore({ isHydrated: true, user: null });
    render(
      <AuthGuard>
        <div>Conteúdo protegido</div>
      </AuthGuard>
    );
    expect(replace).toHaveBeenCalledWith("/login");
  });

  it("renderiza os filhos quando o usuário está em allowedRoles", () => {
    setStore({
      isHydrated: true,
      user: { id: "1", email: "aluno@x.com", role: "ALUNO", planoAssinatura: "FREE", limiteAlunos: 3, createdAt: "", updatedAt: "" },
    });
    render(
      <AuthGuard allowedRoles={["ALUNO"]}>
        <div>Conteúdo do aluno</div>
      </AuthGuard>
    );
    expect(screen.getByText("Conteúdo do aluno")).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });

  it("redireciona um PERSONAL para /personal/dashboard ao acessar área allowedRoles=['ALUNO']", () => {
    setStore({
      isHydrated: true,
      user: { id: "2", email: "personal@x.com", role: "PERSONAL", planoAssinatura: "FREE", limiteAlunos: 3, createdAt: "", updatedAt: "" },
    });
    render(
      <AuthGuard allowedRoles={["ALUNO"]}>
        <div>Conteúdo do aluno</div>
      </AuthGuard>
    );
    expect(replace).toHaveBeenCalledWith("/personal/dashboard");
    expect(screen.queryByText("Conteúdo do aluno")).not.toBeInTheDocument();
  });

  it("redireciona um ALUNO para /dashboard ao acessar área allowedRoles=['PERSONAL']", () => {
    setStore({
      isHydrated: true,
      user: { id: "3", email: "aluno@x.com", role: "ALUNO", planoAssinatura: "FREE", limiteAlunos: 3, createdAt: "", updatedAt: "" },
    });
    render(
      <AuthGuard allowedRoles={["PERSONAL"]}>
        <div>Área do personal</div>
      </AuthGuard>
    );
    expect(replace).toHaveBeenCalledWith("/dashboard");
  });

  it("registra um callback via onAuthExpired ao montar", () => {
    setStore({ isHydrated: true, user: null });
    render(
      <AuthGuard>
        <div>x</div>
      </AuthGuard>
    );
    expect(onAuthExpired).toHaveBeenCalledWith(expect.any(Function));
  });
});
