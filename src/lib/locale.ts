import { Locale } from "@prisma/client";
import { FastifyRequest } from "fastify";

const SUPPORTED_LOCALES: Record<string, Locale> = { pt: "PT", en: "EN", es: "ES" };

/**
 * i18n: resolve o locale ativo da requisição a partir do header `x-locale`
 * (setado pelo `apiFetch` do frontend a partir do cookie de locale — não do
 * JWT, propositalmente, já que o mesmo mecanismo precisa funcionar em telas
 * sem sessão, como /login). Header ausente/valor desconhecido → PT, nunca
 * lança erro — a resolução de locale nunca pode quebrar uma requisição.
 */
export function resolveRequestLocale(request: FastifyRequest): Locale {
  const header = request.headers["x-locale"];
  const value = Array.isArray(header) ? header[0] : header;
  return SUPPORTED_LOCALES[value?.toLowerCase() ?? ""] ?? "PT";
}
