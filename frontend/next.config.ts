import type { NextConfig } from "next";

// Fase 19 (spike Capacitor): `CAPACITOR_EXPORT=true` troca para export
// estático. NÃO é usado por este spike (server.url carrega a produção remota,
// então o WebView não precisa do bundle estático) NEM pelo deploy do Cloud
// Run (que nunca seta a env, ficando sempre em `standalone`). Fica gated aqui
// porque o export estático é INCOMPATÍVEL com o proxy server-side
// (app/api/[...path]/route.ts) — só teria uso num futuro bundle 100% offline,
// que exigiria remover/repensar o proxy. Ver STATUS.md (Fase 19).
const isCapacitorExport = process.env.CAPACITOR_EXPORT === "true";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Produção (Cloud Run): standalone para um Docker image enxuto — sem isso a
  // imagem carrega node_modules inteiro + cache de build do .next.
  output: isCapacitorExport ? "export" : "standalone",
  // O rewrite simples de /api/* foi substituído por um proxy server-side de
  // verdade em app/api/[...path]/route.ts — em produção o backend do Cloud
  // Run fica com invocação restrita por IAM (não aceita chamada anônima), e
  // um rewrite do next.config.ts não consegue anexar o token de identidade
  // do Google por request. Ver o route.ts para o motivo completo.
};

export default nextConfig;
