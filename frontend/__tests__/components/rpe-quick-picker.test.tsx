import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { RpeQuickPicker } from "@/components/rpe-quick-picker";
import { setSessionRpe } from "@/lib/api/workouts";
import ptMessages from "@/messages/pt.json";

jest.mock("@/lib/api/workouts", () => ({
  setSessionRpe: jest.fn(),
}));

const mockedSetRpe = setSessionRpe as jest.Mock;

function renderPicker() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <QueryClientProvider client={queryClient}>
        <RpeQuickPicker sessionLogId="log-1" />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  mockedSetRpe.mockReset();
  mockedSetRpe.mockResolvedValue({});
});

/**
 * A3 (auditoria 2026-08-06): as faixas de `effortDistribution` no backend
 * (`src/progress/services/progress.service.ts`) são a leitura padrão da Borg
 * CR10 e NÃO devem mudar; quem tem que casar com elas é o valor emitido aqui.
 * Replicado abaixo pra o teste falhar se o picker voltar a divergir — foi
 * exatamente essa divergência que fazia "Leve" (que gravava 4) aparecer como
 * "Moderado" no gráfico do aluno, e tornava a faixa "Leve" inalcançável.
 */
function faixaDoBackend(rpe: number): "leve" | "moderado" | "intenso" {
  if (rpe <= 3) return "leve";
  if (rpe <= 6) return "moderado";
  return "intenso";
}

describe("RpeQuickPicker — mapeamento rótulo → faixa (A3)", () => {
  const casos: Array<{ rotulo: RegExp; rpeEsperado: number; faixa: "leve" | "moderado" | "intenso" }> = [
    { rotulo: /muito leve/i, rpeEsperado: 2, faixa: "leve" },
    { rotulo: /^leve$/i, rpeEsperado: 3, faixa: "leve" },
    { rotulo: /moderado/i, rpeEsperado: 5, faixa: "moderado" },
    { rotulo: /^difícil$/i, rpeEsperado: 7, faixa: "intenso" },
    { rotulo: /muito difícil/i, rpeEsperado: 9, faixa: "intenso" },
  ];

  for (const { rotulo, rpeEsperado, faixa } of casos) {
    it(`"${rotulo.source}" grava rpe ${rpeEsperado} e cai na faixa "${faixa}"`, async () => {
      const user = userEvent.setup();
      renderPicker();

      const botao = await screen.findByRole("button", { name: rotulo });
      await user.click(botao);

      await waitFor(() => expect(mockedSetRpe).toHaveBeenCalledWith("log-1", rpeEsperado));
      // O acoplamento em si: o valor gravado tem que cair na faixa que o
      // rótulo tocado promete ao aluno.
      expect(faixaDoBackend(rpeEsperado)).toBe(faixa);
    });
  }

  it("nenhum nível cai numa faixa que contradiga seu próprio rótulo", async () => {
    // Guarda-corpo agregado: garante que as 3 faixas continuam alcançáveis
    // pelo picker (antes da correção, "leve" só era alcançável por 1 dos 5
    // níveis e "Leve" era impossível de reportar).
    const faixas = casos.map((c) => faixaDoBackend(c.rpeEsperado));
    expect(new Set(faixas)).toEqual(new Set(["leve", "moderado", "intenso"]));
    expect(faixas.filter((f) => f === "leve")).toHaveLength(2);
    expect(faixas.filter((f) => f === "intenso")).toHaveLength(2);
  });

  it("mostra confirmação e para de oferecer os botões depois de responder", async () => {
    const user = userEvent.setup();
    renderPicker();

    await user.click(await screen.findByRole("button", { name: /moderado/i }));

    await waitFor(() => expect(screen.getByText(ptMessages.rpeQuickPicker.confirmed)).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /muito leve/i })).not.toBeInTheDocument();
  });
});
