// i18n: fonte única da lista de idiomas suportados — usada pelo `proxy.ts`
// (detecção via Accept-Language), por `i18n/request.ts` (fallback + carga do
// JSON certo) e pela tela de Configurações (seletor). Mudar aqui é o único
// lugar que precisa mudar pra adicionar um 4º idioma no futuro.
export const SUPPORTED_LOCALES = ["pt", "en", "es"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const DEFAULT_LOCALE: AppLocale = "pt";

export function isSupportedLocale(value: string | undefined | null): value is AppLocale {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value);
}

/**
 * Mapeia nosso código curto (pt/en/es) pra uma tag BCP-47 completa, usada só
 * em `Intl`/`toLocaleDateString` (formatação de data/número) — o app em si
 * só distingue 3 idiomas, não variantes regionais.
 */
export function toIntlLocale(locale: AppLocale): string {
  return { pt: "pt-BR", en: "en-US", es: "es-ES" }[locale];
}
