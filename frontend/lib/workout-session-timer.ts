// Fase 89 — cronômetro real da sessão de treino, com início explícito
// ("Iniciar Treino") e guard-rail de inatividade: uma aba esquecida aberta
// (ou o app fechado sem concluir) não pode inflar a duração indefinidamente.
//
// Persistido em localStorage por treino (não por aluno/global) — sobrevive a
// refresh/fechar aba sem precisar de nenhum campo novo no backend, seguindo
// o mesmo espírito 100% client-side já usado no cronômetro anterior (Fase
// 39). Se o aluno reabrir o app dias depois com uma sessão "pendurada" (nunca
// concluída), a MESMA regra de auto-encerramento por inatividade (ver
// `workoutSessionPhase`) já resolve: a sessão é fechada sozinha com a
// duração real até a última atividade registrada, sem precisar de um
// caminho de código separado pra "sessão velha".

const STORAGE_PREFIX = "thundera:workout-session:";

// 30 min sem nenhuma atividade (clique, tecla, série marcada) → mostra o
// aviso "Ainda está treinando?". Mais 15 min sem resposta → encerra sozinho,
// contando a duração só até a ÚLTIMA atividade real (não até o momento do
// auto-encerramento), pra não inflar o tempo com o celular parado no bolso.
export const IDLE_WARNING_MS = 30 * 60 * 1000;
export const IDLE_GRACE_MS = 15 * 60 * 1000;
export const IDLE_AUTO_FINISH_MS = IDLE_WARNING_MS + IDLE_GRACE_MS;

export interface WorkoutSessionState {
  startedAt: number;
  lastActivityAt: number;
}

function storageKey(workoutId: string): string {
  return `${STORAGE_PREFIX}${workoutId}`;
}

export function loadWorkoutSession(workoutId: string): WorkoutSessionState | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(storageKey(workoutId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.startedAt === "number" && typeof parsed?.lastActivityAt === "number") {
      return { startedAt: parsed.startedAt, lastActivityAt: parsed.lastActivityAt };
    }
  } catch {
    // Valor corrompido/formato antigo — trata como se não houvesse sessão.
  }
  return null;
}

export function saveWorkoutSession(workoutId: string, state: WorkoutSessionState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(workoutId), JSON.stringify(state));
}

export function clearWorkoutSession(workoutId: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(storageKey(workoutId));
}

export type WorkoutSessionPhase = "not-started" | "in-progress" | "idle-warning";

export function workoutSessionPhase(session: WorkoutSessionState | null, now: number): WorkoutSessionPhase {
  if (!session) return "not-started";
  const idleMs = now - session.lastActivityAt;
  return idleMs >= IDLE_WARNING_MS ? "idle-warning" : "in-progress";
}
