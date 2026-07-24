"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            retry: 1,
            refetchOnWindowFocus: false,
            // Sem isso, toda `useQuery` tinha `staleTime` implícito de 0 —
            // qualquer remount (voltar de outra tela, reabrir um modal)
            // refazia o fetch mesmo pra dado que raramente muda. 30s é curto
            // o bastante pra qualquer mutação sem invalidação explícita se
            // autocorrigir quase na hora, mas já corta a maioria dos refetches
            // redundantes de navegação. Queries de dado mais estável (ex:
            // catálogo de exercícios) sobrescrevem com um valor maior na
            // própria chamada.
            staleTime: 30_000,
          },
        },
      })
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
