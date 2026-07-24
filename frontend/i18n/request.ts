import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, isSupportedLocale } from "./locales";

// i18n: SEM `[locale]` de segmento na URL — o locale ativo vem do cookie
// `locale` (setado pelo `proxy.ts` na primeira visita, via Accept-Language, e
// sobrescrito explicitamente pela tela de Configurações). Sem cookie válido,
// cai pro português — nunca quebra a renderização.
export default getRequestConfig(async () => {
  const store = await cookies();
  const cookieValue = store.get("locale")?.value;
  const locale = isSupportedLocale(cookieValue) ? cookieValue : DEFAULT_LOCALE;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
