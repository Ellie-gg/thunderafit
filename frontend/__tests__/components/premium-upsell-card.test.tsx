import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { PremiumUpsellCard } from "@/components/premium-upsell-card";
import { getAlunoPremiumStatus, startAlunoPremiumTrial } from "@/lib/api/billing";
import ptMessages from "@/messages/pt.json";

jest.mock("@/lib/api/billing", () => ({
  getAlunoPremiumStatus: jest.fn(),
  startAlunoPremiumTrial: jest.fn(),
}));

const mockedGetStatus = getAlunoPremiumStatus as jest.Mock;
const mockedStartTrial = startAlunoPremiumTrial as jest.Mock;

function renderCard() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <QueryClientProvider client={queryClient}>
        <PremiumUpsellCard />
      </QueryClientProvider>
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  mockedGetStatus.mockReset();
  mockedStartTrial.mockReset();
});

describe("PremiumUpsellCard — Fase 85", () => {
  it("não renderiza nada enquanto o status ainda não carregou", () => {
    mockedGetStatus.mockImplementation(() => new Promise(() => {}));
    const { container } = renderCard();
    expect(container).toBeEmptyDOMElement();
  });

  it("não renderiza nada quando o aluno já tem acesso Premium", async () => {
    mockedGetStatus.mockResolvedValue({ status: "ACTIVE", hasAccess: true, premiumExpiresAt: null, trialAvailable: false });
    const { container } = renderCard();
    await waitFor(() => expect(container.querySelector("h2")).not.toBeInTheDocument());
  });

  it("mostra o botão de teste grátis quando disponível, e inicia o teste ao clicar", async () => {
    mockedGetStatus.mockResolvedValue({ status: "NONE", hasAccess: false, premiumExpiresAt: null, trialAvailable: true });
    mockedStartTrial.mockResolvedValue({ status: "TRIAL", hasAccess: true, premiumExpiresAt: null, trialAvailable: false });
    const user = userEvent.setup();
    renderCard();

    const button = await screen.findByRole("button", { name: /testar 7 dias grátis/i });
    await user.click(button);

    await waitFor(() => expect(mockedStartTrial).toHaveBeenCalledTimes(1));
  });

  it("mostra 'assinatura em breve' quando o teste já foi usado", async () => {
    mockedGetStatus.mockResolvedValue({ status: "NONE", hasAccess: false, premiumExpiresAt: null, trialAvailable: false });
    renderCard();

    expect(await screen.findByText(/assinatura em breve/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /testar 7 dias grátis/i })).not.toBeInTheDocument();
  });
});
