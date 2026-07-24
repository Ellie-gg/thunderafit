import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import ptMessages from "@/messages/pt.json";

/** Wrapper padrão pra testes de componentes que usam `useTranslations` — usa o pt.json real (não `{}`) pra evitar cair no fallback de mostrar a chave crua. */
export function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {ui}
    </NextIntlClientProvider>
  );
}
