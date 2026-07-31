/**
 * Rate limiting de login por tentativas falhas consecutivas (Fase 14).
 *
 * Decisão (documentada no STATUS.md): implementado em memória, sem
 * `@fastify/rate-limit`/Redis. O requisito é "bloquear após N tentativas
 * FALHAS CONSECUTIVAS, resetando no sucesso" — um plugin de janela
 * deslizante genérico conta toda requisição (sucesso ou falha) contra o
 * mesmo teto, o que não é a semântica pedida. Para o volume atual (uma
 * única instância de backend, sem necessidade de estado compartilhado
 * entre processos), um Map em memória resolve sem introduzir Redis só
 * para isso. Efeito colateral aceito: o contador zera se o processo
 * reiniciar (deploy, restart do Cloud Run) — não é um problema de
 * segurança real, já que um restart não é algo que um atacante controla.
 *
 * Chave = IP + e-mail tentado (não só IP): em produção, o backend só
 * recebe tráfego do proxy do próprio frontend, então múltiplas contas
 * atacadas a partir do mesmo IP de origem compartilhariam o mesmo
 * "primeiro segmento" de X-Forwarded-For — combinar com o e-mail evita
 * que o bloqueio de uma conta afete todas as outras.
 */

const MAX_FAILED_ATTEMPTS = 5;
const BLOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutos

// A8 (auditoria 2026-07-31): entradas com `failedCount < MAX_FAILED_ATTEMPTS`
// (nunca chegam a `blockedUntil`) não eram varridas em lugar nenhum — um
// endpoint público que registra toda chamada como "tentativa" (ex:
// `check-email`) alimentado com e-mails aleatórios cria uma entrada nova
// permanente a cada chamada, crescimento monotônico até o processo reiniciar
// por OOM. `ATTEMPT_TTL_MS` bem maior que `BLOCK_DURATION_MS` (não quer
// varrer nada que ainda possa importar pro bloqueio real) — a varredura é
// barata e só roda a cada N tentativas, nunca no caminho comum de 1
// requisição.
const ATTEMPT_TTL_MS = 60 * 60 * 1000; // 1h
const SWEEP_EVERY_N_ATTEMPTS = 100;

interface AttemptEntry {
  failedCount: number;
  blockedUntil: number | null;
  lastAttemptAt: number;
}

const attempts = new Map<string, AttemptEntry>();
let attemptsSinceSweep = 0;

function sweepStaleEntries(): void {
  const now = Date.now();
  for (const [key, entry] of attempts) {
    const stillBlocked = entry.blockedUntil !== null && entry.blockedUntil > now;
    if (!stillBlocked && now - entry.lastAttemptAt > ATTEMPT_TTL_MS) {
      attempts.delete(key);
    }
  }
}

function keyFor(ip: string, email: string): string {
  return `${ip}:${email.trim().toLowerCase()}`;
}

export interface BlockStatus {
  blocked: boolean;
  retryAfterSeconds?: number;
}

export function isBlocked(ip: string, email: string): BlockStatus {
  const key = keyFor(ip, email);
  const entry = attempts.get(key);
  if (!entry?.blockedUntil) {
    return { blocked: false };
  }

  const remainingMs = entry.blockedUntil - Date.now();
  if (remainingMs <= 0) {
    attempts.delete(key);
    return { blocked: false };
  }

  return { blocked: true, retryAfterSeconds: Math.ceil(remainingMs / 1000) };
}

export function recordFailedAttempt(ip: string, email: string): void {
  const key = keyFor(ip, email);
  const entry = attempts.get(key) ?? { failedCount: 0, blockedUntil: null, lastAttemptAt: Date.now() };
  entry.failedCount += 1;
  entry.lastAttemptAt = Date.now();
  if (entry.failedCount >= MAX_FAILED_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_DURATION_MS;
  }
  attempts.set(key, entry);

  attemptsSinceSweep += 1;
  if (attemptsSinceSweep >= SWEEP_EVERY_N_ATTEMPTS) {
    attemptsSinceSweep = 0;
    sweepStaleEntries();
  }
}

export function recordSuccessfulAttempt(ip: string, email: string): void {
  attempts.delete(keyFor(ip, email));
}

/** Exportado só para os testes limparem o estado entre casos. */
export function _resetForTests(): void {
  attempts.clear();
}
