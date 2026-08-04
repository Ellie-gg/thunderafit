import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { EffortDistributionBar } from "@/components/effort-distribution-bar";
import ptMessages from "@/messages/pt.json";

function renderBar(distribution: { leve: number; moderado: number; intenso: number }) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <EffortDistributionBar distribution={distribution} />
    </NextIntlClientProvider>
  );
}

describe("EffortDistributionBar", () => {
  it("mostra a mensagem de 'sem dado' quando não há nenhuma sessão com RPE", () => {
    renderBar({ leve: 0, moderado: 0, intenso: 0 });
    expect(screen.getByText(/Responda "quão difícil foi"/i)).toBeInTheDocument();
  });

  it("mostra a legenda com a contagem de cada faixa", () => {
    renderBar({ leve: 2, moderado: 1, intenso: 3 });
    expect(screen.getByText(/Leve \(2\)/)).toBeInTheDocument();
    expect(screen.getByText(/Moderado \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/Intenso \(3\)/)).toBeInTheDocument();
  });
});
