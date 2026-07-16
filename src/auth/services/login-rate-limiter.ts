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

interface AttemptEntry {
  failedCount: number;
  blockedUntil: number | null;
}

const attempts = new Map<string, AttemptEntry>();

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
  const entry = attempts.get(key) ?? { failedCount: 0, blockedUntil: null };
  entry.failedCount += 1;
  if (entry.failedCount >= MAX_FAILED_ATTEMPTS) {
    entry.blockedUntil = Date.now() + BLOCK_DURATION_MS;
  }
  attempts.set(key, entry);
}

export function recordSuccessfulAttempt(ip: string, email: string): void {
  attempts.delete(keyFor(ip, email));
}

/** Exportado só para os testes limparem o estado entre casos. */
export function _resetForTests(): void {
  attempts.clear();
}
