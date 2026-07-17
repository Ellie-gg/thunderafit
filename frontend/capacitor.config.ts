import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Fase 19 — SPIKE: provar autenticação por cookie httpOnly dentro do WebView.
 *
 * Estratégia de mitigação (pesquisada antes do spike): em vez do
 * `https://localhost` interno padrão do Capacitor, apontamos `server.url`
 * para o domínio REAL de produção. Assim o WebView carrega exatamente a
 * origem que emite os cookies (`thunderafit-frontend-...run.app`) — as
 * requisições viram same-origin de verdade e os cookies httpOnly
 * (`access_token`/`refresh_token`, com Max-Age, portanto persistentes) são
 * first-party para essa origem, contornando a maior parte dos problemas
 * documentados de cookie em WebView sob `localhost`.
 *
 * IMPORTANTE:
 * - NÃO habilitamos o plugin CapacitorHttp. Se habilitado, ele intercepta o
 *   fetch e o roteia pelo código nativo, que historicamente mistura/perde
 *   cookies httpOnly — deixar OFF mantém o fetch dentro do WebView, onde o
 *   CookieManager do Android trata os cookies nativamente.
 * - Como `server.url` carrega o site remoto de produção, o `webDir` local é
 *   só um fallback (ver frontend/capacitor-www/index.html). NÃO usamos o
 *   `output: 'export'` do Next como app real: o export estático é
 *   incompatível com o proxy server-side (app/api/[...path]/route.ts, exigido
 *   pelo backend restrito por IAM) — e é desnecessário, já que o WebView
 *   carrega a produção, que já roda esse proxy. Ver STATUS.md (Fase 19).
 */
const PROD_FRONTEND_URL = "https://thunderafit-frontend-vy6oiie6rq-uc.a.run.app";

const config: CapacitorConfig = {
  appId: "app.thunderafit.twa",
  appName: "ThunderaFit",
  webDir: "capacitor-www",
  server: {
    url: PROD_FRONTEND_URL,
    // Produção é HTTPS puro — nunca permitir tráfego em texto claro.
    cleartext: false,
  },
};

export default config;
