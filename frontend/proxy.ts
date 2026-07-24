import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SUPPORTED_LOCALES, DEFAULT_LOCALE, isSupportedLocale, type AppLocale } from "./i18n/locales";

const LOCALE_COOKIE = "locale";
// 1 ano — é uma preferência de longa duração, não uma sessão.
const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Detecção automática do idioma do SISTEMA na primeira abertura (Fase i18n):
 * sem cookie de locale ainda, parseia `Accept-Language` (o Capacitor
 * WebView já reflete o idioma do device aí — mesmo sinal que
 * `navigator.language`, só que disponível no primeiro request, sem esperar
 * JS do cliente rodar) e grava o cookie com o primeiro idioma suportado
 * encontrado. Nenhum dos 3 suportados → português. Nunca redireciona nem
 * reescreve rota (não há prefixo de URL nesta arquitetura) — só garante que
 * o cookie exista antes de `i18n/request.ts` precisar dele.
 */
function detectSupportedLocale(acceptLanguage: string | null): AppLocale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const preferred = acceptLanguage
    .split(",")
    .map((part) => part.split(";")[0].trim().split("-")[0].toLowerCase());
  return preferred.find(isSupportedLocale) ?? DEFAULT_LOCALE;
}

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  const existing = request.cookies.get(LOCALE_COOKIE)?.value;
  if (!isSupportedLocale(existing)) {
    const detected = detectSupportedLocale(request.headers.get("accept-language"));
    response.cookies.set(LOCALE_COOKIE, detected, {
      maxAge: LOCALE_COOKIE_MAX_AGE,
      path: "/",
      sameSite: "lax",
    });
  }

  return response;
}

export const config = {
  // Não roda em API/assets estáticos/internos do Next — só em navegação de página.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
