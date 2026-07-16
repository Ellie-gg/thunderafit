import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // Necessário para um Docker image enxuto (deploy em produção) — sem isso
  // a imagem carrega node_modules inteiro + cache de build do .next.
  output: "standalone",
  // O rewrite simples de /api/* foi substituído por um proxy server-side de
  // verdade em app/api/[...path]/route.ts — em produção o backend do Cloud
  // Run fica com invocação restrita por IAM (não aceita chamada anônima), e
  // um rewrite do next.config.ts não consegue anexar o token de identidade
  // do Google por request. Ver o route.ts para o motivo completo.
};

export default nextConfig;
