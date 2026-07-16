/**
 * O fetch do navegador sempre chama a própria origem do Next (same-origin,
 * evitando CORS); é o rewrite em next.config.ts que repassa `/api/*` para
 * NEXT_PUBLIC_API_URL do lado do servidor.
 *
 * Fase 5.5: os tokens não são mais lidos/escritos pelo JS do frontend — o
 * backend seta `access_token`/`refresh_token` como cookies httpOnly nas
 * respostas de login/refresh, e o navegador os envia automaticamente em
 * toda requisição same-origin. Por isso os fetches abaixo não montam mais
 * um header `Authorization` nem leem token de lugar nenhum.
 */

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onAuthExpiredCallback: (() => void) | null = null;

/**
 * Registrado uma vez pela UI (ver AuthGuard) para reagir quando o refresh
 * via cookie falha — como o JS não consegue inspecionar o cookie httpOnly,
 * esse é o único jeito de saber que a sessão morreu e limpar o estado local.
 */
export function onAuthExpired(callback: () => void) {
  onAuthExpiredCallback = callback;
}

let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  const res = await fetch(`/api/auth/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  return res.ok;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  auth?: boolean;
}

/**
 * Wrapper de fetch central. Quando `auth` é true (padrão) e a resposta for
 * 401, tenta renovar via /api/auth/refresh (cookie httpOnly) uma única vez
 * antes de repetir a requisição original.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body } = options;

  const doFetch = async (): Promise<Response> => {
    // Bug real encontrado na Fase 10: mandar `Content-Type: application/json`
    // num POST sem corpo (ex: logout, marcar notificação como lida) faz o
    // parser de JSON do Fastify rejeitar o corpo vazio com 400 — o header só
    // pode ir junto quando existe body de verdade.
    const hasBody = body !== undefined;
    return fetch(path, {
      method,
      headers: hasBody ? { "Content-Type": "application/json" } : {},
      body: hasBody ? JSON.stringify(body) : undefined,
    });
  };

  let res = await doFetch();

  if (res.status === 401 && options.auth !== false) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      res = await doFetch();
    } else {
      onAuthExpiredCallback?.();
    }
  }

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiError(res.status, data.error ?? "Erro inesperado na requisição.");
  }

  return data as T;
}
