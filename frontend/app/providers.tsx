"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AndroidBackButtonHandler } from "@/components/android-back-button-handler";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => {
    const client = new QueryClient({
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
    });

    // Perf (Grupo Y, item 101): dado quase-estático que só muda via uma ação
    // que já invalida a própria chave explicitamente (ver cada mutação) —
    // `setQueryDefaults` casa por PREFIXO de queryKey, então cobre todas as
    // variações (`["relations"]`, `["workout-programs","aluno"]`, etc.) num
    // lugar só, em vez de repetir `staleTime` em ~15 call sites.
    client.setQueryDefaults(["billing-status"], { staleTime: Infinity });
    client.setQueryDefaults(["my-profile"], { staleTime: Infinity });
    client.setQueryDefaults(["relations"], { staleTime: 5 * 60_000 });
    client.setQueryDefaults(["self-templates"], { staleTime: 5 * 60_000 });
    client.setQueryDefaults(["workout-programs"], { staleTime: 2 * 60_000 });
    client.setQueryDefaults(["aluno-dashboard-summary"], { staleTime: 2 * 60_000 });
    client.setQueryDefaults(["aluno-premium-status"], { staleTime: 2 * 60_000 });

    return client;
  });

  return (
    <QueryClientProvider client={queryClient}>
      <AndroidBackButtonHandler />
      {children}
    </QueryClientProvider>
  );
}
