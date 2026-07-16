"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getThread, addThreadMessage } from "@/lib/api/support";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

export function SupportThreadDetail({ threadId, backHref }: { threadId: string; backHref: string }) {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const threadQuery = useQuery({
    queryKey: ["support-thread", threadId],
    queryFn: () => getThread(threadId),
    // Sem WebSocket nesta fase (decisão da Fase 10) — refetch ao focar a
    // aba já é suficiente para o volume de mensagens de um chat de dúvidas.
    refetchOnWindowFocus: true,
  });

  const mutation = useMutation({
    mutationFn: () => addThreadMessage(threadId, text),
    onSuccess: () => {
      setText("");
      queryClient.invalidateQueries({ queryKey: ["support-thread", threadId] });
      queryClient.invalidateQueries({ queryKey: ["support-threads"] });
    },
  });

  if (threadQuery.isLoading) {
    return (
      <main className="flex flex-1 items-center justify-center">
        <span className="text-sm text-muted">Carregando...</span>
      </main>
    );
  }

  if (threadQuery.isError) {
    return (
      <main className="flex flex-1 flex-col gap-4 px-6 py-8">
        <QueryError error={threadQuery.error} onRetry={() => threadQuery.refetch()} />
      </main>
    );
  }

  if (!threadQuery.data) return null;

  const thread = threadQuery.data.thread;

  return (
    <main className="flex flex-1 flex-col gap-4 px-6 py-8">
      <a href={backHref} className="text-sm font-semibold text-accent-secondary hover:underline">
        ← Voltar
      </a>

      <div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
            thread.status === "RESPONDIDO" ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
          }`}
        >
          {thread.status === "RESPONDIDO" ? "Respondido" : "Aberto"}
        </span>
        <h1 className="mt-2 font-display text-xl font-bold">{thread.subject}</h1>
      </div>

      <div className="flex flex-col gap-3">
        {thread.messages.map((m) => {
          const isMine = m.authorId === user?.id;
          return (
            <Card
              key={m.id}
              className={`max-w-[85%] ${isMine ? "self-end border-accent/40" : "self-start"}`}
            >
              <p className="text-sm">{m.text}</p>
              <p className="mt-1 text-xs text-muted">
                {new Date(m.createdAt).toLocaleString("pt-BR")}
              </p>
            </Card>
          );
        })}
      </div>

      <form
        className="flex items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <textarea
          required
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          className="flex-1 rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          placeholder="Escreva uma mensagem..."
        />
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? "..." : "Enviar"}
        </Button>
      </form>

      {mutation.isError && (
        <p className="text-sm text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : "Erro ao enviar mensagem."}
        </p>
      )}
    </main>
  );
}
