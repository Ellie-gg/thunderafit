import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { User } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Fase 39: primeiro nome do usuário quando existe (cadastro mínimo de nome);
// contas antigas não têm esse dado, então cai pro mesmo fallback já usado na
// saudação do dashboard (prefixo do e-mail).
export function firstNameOrEmailPrefix(user: Pick<User, "name" | "email"> | null | undefined): string {
  if (user?.name?.trim()) return user.name.trim().split(/\s+/)[0];
  return user?.email.split("@")[0] ?? "Você";
}

/**
 * Fase 40 — bug real corrigido: `WorkoutExercise.setLogs` traz o histórico
 * INTEIRO (todas as vezes que esse exercício foi logado, de todas as
 * semanas), não só as séries desta sessão — o mesmo `Workout`/
 * `WorkoutExercise` é reaberto toda semana (não é recriado a cada ciclo).
 * Sem esse corte, depois da 1ª semana completa o aluno nunca mais
 * conseguia logar séries novas (o formulário ficava escondido pra sempre,
 * achando que "3/3 séries" já tinham sido feitas — eram só as da semana 1).
 *
 * `boundary` = `Workout.lastCompletedAt` ANTES desta sessão (null na
 * primeiríssima vez) — tudo logado ATÉ esse instante (inclusive) é de um
 * ciclo anterior; depois dele é desta sessão.
 */
export function splitSetLogsBySessionBoundary<T extends { loggedAt: string }>(
  setLogs: T[],
  boundary: string | null
): { thisSession: T[]; previous: T[] } {
  if (!boundary) return { thisSession: setLogs, previous: [] };
  const boundaryTime = new Date(boundary).getTime();
  const thisSession: T[] = [];
  const previous: T[] = [];
  for (const log of setLogs) {
    if (new Date(log.loggedAt).getTime() <= boundaryTime) {
      previous.push(log);
    } else {
      thisSession.push(log);
    }
  }
  return { thisSession, previous };
}
