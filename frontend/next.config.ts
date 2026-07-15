import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  // O backend (Fases 1-4) não emite cabeçalhos CORS e está fora do escopo
  // de arquivos desta fase. Em vez de alterar `/src`, o navegador só fala
  // com a própria origem do Next (same-origin) e este rewrite repassa
  // `/api/*` para NEXT_PUBLIC_API_URL no servidor, onde CORS não se aplica.
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
