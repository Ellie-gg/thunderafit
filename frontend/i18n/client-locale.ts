import { AppLocale, DEFAULT_LOCALE, isSupportedLocale } from "./locales";

const LOCALE_COOKIE = "locale";
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 ano

/** Lê o cookie de locale no cliente — mesmo cookie que `proxy.ts`/`i18n/request.ts` usam no servidor. */
export function getClientLocale(): AppLocale {
  if (typeof document === "undefined") return DEFAULT_LOCALE;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LOCALE_COOKIE}=([^;]*)`));
  const value = match ? decodeURIComponent(match[1]) : undefined;
  return isSupportedLocale(value) ? value : DEFAULT_LOCALE;
}

/** Grava a escolha explícita do usuário (tela de Configurações). Quem chama ainda precisa recarregar a página pro SSR pegar o novo locale. */
export function setClientLocale(locale: AppLocale) {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${LOCALE_COOKIE_MAX_AGE}; samesite=lax`;
}
