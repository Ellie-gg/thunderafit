"use client";

import { ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * Estado de erro reutilizável para queries do TanStack Query — antes desta
 * fase, várias telas (dashboard, /treinos, dashboard do Personal, /evolucao)
 * simplesmente ficavam presas em "Carregando..." para sempre se a query
 * falhasse, sem feedback nenhum pro usuário. Centralizado aqui para manter a
 * mensagem e o botão de "Tentar novamente" consistentes em todas elas.
 */
export function QueryError({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof ApiError ? error.message : "Não foi possível conectar ao servidor.";

  return (
    <Card className="flex flex-col gap-3">
      <p className="text-sm text-danger">{message}</p>
      <Button variant="secondary" size="sm" onClick={onRetry} className="self-start">
        Tentar novamente
      </Button>
    </Card>
  );
}
