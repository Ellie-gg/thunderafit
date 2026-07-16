import { NextRequest } from "next/server";
import { GoogleAuth } from "google-auth-library";

/**
 * Proxy server-side para o backend, substituindo o rewrite simples que
 * existia em next.config.ts. Motivo: em produção o backend do Cloud Run
 * fica com invocação restrita por IAM (não aceita chamada anônima) — só o
 * runtime service account do próprio frontend pode chamá-lo, via um token
 * de identidade do Google assinado por request. Um `rewrites()` do
 * next.config.ts não tem como anexar esse header, por isso virou uma rota
 * de verdade.
 *
 * `BACKEND_URL` é server-only (sem prefixo NEXT_PUBLIC_) de propósito: como
 * este proxy roda no servidor e lê a env em tempo de request (não em build
 * time), a URL do backend não precisa mais estar "baked" na imagem Docker
 * do frontend — resolve de quebra o problema de NEXT_PUBLIC_* ser embutido
 * no build.
 *
 * Fora do Cloud Run (dev local, testes, o smoke test em Docker), o passo de
 * token é pulado inteiramente — o proxy vira um forward simples, igual ao
 * rewrite antigo.
 *
 * A detecção usa `K_SERVICE` (injetada automaticamente pelo próprio Cloud
 * Run em todo container, sem precisar configurar nada) em vez de
 * `NODE_ENV === "production"` — bug real encontrado durante o smoke test
 * local em Docker: o `server.js` do output `standalone` do Next roda como
 * build de produção *sempre*, independente do que for passado por `-e
 * NODE_ENV=...` no `docker run`, então checar NODE_ENV aqui nunca pulava o
 * passo de token fora do Cloud Run de verdade.
 */

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:3000";

let cachedAuth: GoogleAuth | null = null;

async function getAuthHeaders(): Promise<Record<string, string>> {
  if (!process.env.K_SERVICE) {
    return {};
  }

  cachedAuth ??= new GoogleAuth();
  const client = await cachedAuth.getIdTokenClient(BACKEND_URL);
  const idToken = await client.idTokenProvider.fetchIdToken(BACKEND_URL);
  return { Authorization: `Bearer ${idToken}` };
}

async function proxy(req: NextRequest, path: string[]): Promise<Response> {
  const targetUrl = `${BACKEND_URL}/api/${path.join("/")}${req.nextUrl.search}`;

  const headers = new Headers(req.headers);
  headers.delete("host");
  headers.delete("content-length");

  // Minting o token de identidade do Google (produção) ou a própria chamada
  // ao backend podem falhar por razões de infra (credenciais indisponíveis,
  // backend fora do ar) — sem esse catch, isso vira um 500 não tratado do
  // Next em vez de um erro claro (bug real encontrado no smoke test local
  // em Docker: sem credenciais do GCP configuradas, getIdTokenClient() jogava
  // uma exceção não capturada e derrubava a requisição inteira).
  let authHeaders: Record<string, string>;
  try {
    authHeaders = await getAuthHeaders();
  } catch (err) {
    console.error("Falha ao obter token de identidade para o backend:", err);
    return Response.json(
      { error: "Não foi possível autenticar com o backend." },
      { status: 502 }
    );
  }
  for (const [key, value] of Object.entries(authHeaders)) {
    headers.set(key, value);
  }

  const hasBody = !["GET", "HEAD"].includes(req.method);

  let backendResponse: Response;
  try {
    backendResponse = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
    });
  } catch (err) {
    console.error("Falha ao repassar requisição para o backend:", err);
    return Response.json({ error: "Backend indisponível." }, { status: 502 });
  }

  const responseHeaders = new Headers(backendResponse.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("set-cookie");

  // O login/refresh do backend seta DOIS cookies (access_token + refresh_token)
  // via duas chamadas separadas a reply.setCookie() — ou seja, a resposta real
  // carrega dois headers Set-Cookie distintos. Copiar `backendResponse.headers`
  // direto (ou usar Headers#get) colapsaria os dois num único valor unido por
  // vírgula — getSetCookie() é o único jeito correto de pegar cada um
  // separadamente para reanexar no Response de saída.
  for (const cookie of backendResponse.headers.getSetCookie()) {
    responseHeaders.append("set-cookie", cookie);
  }

  return new Response(backendResponse.body, {
    status: backendResponse.status,
    headers: responseHeaders,
  });
}

type RouteContext = { params: Promise<{ path: string[] }> };

async function handler(req: NextRequest, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxy(req, path);
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
