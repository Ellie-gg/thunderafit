"use client";

import { useLocale } from "next-intl";
import { toIntlLocale, type AppLocale } from "./locales";

/**
 * Tag BCP-47 do locale ativo (ex: "pt-BR") — usar no lugar de `"pt-BR"` fixo
 * em qualquer `toLocaleDateString`/`toLocaleString`/`toLocaleTimeString`.
 */
export function useActiveIntlLocale(): string {
  const locale = useLocale() as AppLocale;
  return toIntlLocale(locale);
}
