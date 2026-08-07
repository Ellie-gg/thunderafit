/**
 * Validação compartilhada dos nomes editáveis pelo usuário (programa, sessão,
 * template).
 *
 * B4 (auditoria 2026-08-06): existia só `!name?.trim()` espalhado por 7 pontos
 * de `src/fitness/services/`, sem teto de tamanho e sem checagem de tipo. Duas
 * consequências reais:
 *
 * - A coluna é `text` (sem limite no banco), então um nome de 1 MB persistia e
 *   passava a viajar em TODA listagem de programas e no `GET /api/workouts/:id`.
 *   Comparar com `MAX_NOTES_LENGTH = 500`, que já limitava `notes` no mesmo
 *   service — o nome ficou sem o equivalente.
 * - `{"name": 123}` fazia `name?.trim` ser `undefined` → TypeError → 500 em vez
 *   de 400.
 *
 * A Fase 111 (renomear) elevou o risco: antes o nome só era definido na
 * criação; agora é mutável a qualquer momento, por aluno e por Personal.
 */

const MAX_NAME_LENGTH = 120;

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

/**
 * Valida e devolve o nome já com `trim`. Lança 400 (nunca 500) para ausente,
 * vazio/só espaços, tipo errado, ou acima do teto.
 *
 * @param label usado na mensagem de erro (ex: "Nome do programa").
 */
export function assertValidName(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw httpError(`${label} é obrigatório.`, 400);
  }
  const trimmed = value.trim();
  if (!trimmed) {
    throw httpError(`${label} é obrigatório.`, 400);
  }
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw httpError(`${label} deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`, 400);
  }
  return trimmed;
}

/**
 * Variante para nomes OPCIONAIS (onde ausente cai num default gerado, ex: o
 * nome de sessão em `addSession`): não exige valor, mas se vier um, aplica as
 * mesmas regras de tipo e tamanho.
 */
export function assertValidOptionalName(value: unknown, label: string): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") {
    throw httpError(`${label} deve ser um texto.`, 400);
  }
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > MAX_NAME_LENGTH) {
    throw httpError(`${label} deve ter no máximo ${MAX_NAME_LENGTH} caracteres.`, 400);
  }
  return trimmed;
}

export { MAX_NAME_LENGTH };
