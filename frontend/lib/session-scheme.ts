import type { SessionScheme } from "./types";

/**
 * Fase 26: ordem "de calendário/sequência" de cada esquema — espelha
 * `src/fitness/repository/workout-programs.repository.ts` no backend. A
 * ordem alfabética de LETTER coincide por acaso com a sequência; a de
 * WEEKDAY NÃO coincide (ex: "QUARTA" < "SEGUNDA" alfabeticamente), então
 * toda tela que ordena sessões por `letter` precisa usar `sortByScheme`
 * abaixo, nunca `localeCompare` puro.
 */
export const LETTER_ORDER = ["A", "B", "C", "D", "E"];
export const WEEKDAY_ORDER = [
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
  "DOMINGO",
];

export const WEEKDAY_LABELS: Record<string, string> = {
  SEGUNDA: "Segunda",
  TERCA: "Terça",
  QUARTA: "Quarta",
  QUINTA: "Quinta",
  SEXTA: "Sexta",
  SABADO: "Sábado",
  DOMINGO: "Domingo",
};

export function orderFor(scheme: SessionScheme): string[] {
  return scheme === "WEEKDAY" ? WEEKDAY_ORDER : LETTER_ORDER;
}

export function maxSessionsFor(scheme: SessionScheme): number {
  return orderFor(scheme).length;
}

/** Rótulo de exibição de uma chave de sessão (letra ou código de dia). */
export function labelFor(scheme: SessionScheme, key: string): string {
  return scheme === "WEEKDAY" ? (WEEKDAY_LABELS[key] ?? key) : key;
}

export function sortByScheme<T extends { letter: string }>(
  sessions: T[],
  scheme: SessionScheme
): T[] {
  const order = orderFor(scheme);
  return [...sessions].sort((a, b) => order.indexOf(a.letter) - order.indexOf(b.letter));
}

/**
 * Próxima chave da SEQUÊNCIA do esquema após `currentKey` (ex: A→B,
 * SEGUNDA→TERCA) — não é "próxima não usada"; existir ou não a sessão dessa
 * chave é decidido por quem chama (cria se não existir, abre se já existir).
 * Retorna null se `currentKey` já é a última do esquema.
 */
export function nextKeyInSequence(scheme: SessionScheme, currentKey: string): string | null {
  const order = orderFor(scheme);
  const index = order.indexOf(currentKey);
  if (index === -1 || index === order.length - 1) return null;
  return order[index + 1];
}

/**
 * F12 (auditoria 2026-07-31): a PRIMEIRA chave da sequência ainda não usada
 * por nenhuma sessão existente — pra decidir qual sessão criar a seguir.
 * Achado real: `/programas/[id]` derivava isso via `nextKeyInSequence` a
 * partir da ÚLTIMA sessão já ordenada, então um programa WEEKDAY com só
 * SEGUNDA+DOMINGO escondia o botão de adicionar (DOMINGO é a última do
 * esquema, `nextKeyInSequence` devolve null) mesmo o backend aceitando
 * QUARTA, TERCA etc. sem problema. Esta função olha o CONJUNTO usado, não a
 * posição do último — encontra a lacuna real.
 */
export function firstMissingKey(scheme: SessionScheme, existingKeys: string[]): string | null {
  const used = new Set(existingKeys);
  return orderFor(scheme).find((key) => !used.has(key)) ?? null;
}
