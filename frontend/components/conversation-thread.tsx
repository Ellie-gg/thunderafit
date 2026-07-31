"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listConnectionMessages, sendConnectionMessage } from "@/lib/api/connections";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { Button } from "@/components/ui/button";

/**
 * Fase 76: thread de mensagens de uma ConnectionRequest — reaproveitada
 * tanto na lista "Minhas solicitações" do aluno quanto em
 * "/personal/solicitacoes" do Personal. Some sozinha (sem enviar) quando a
 * conversa está RECUSADA, já que o backend não aceita mais mensagens ali.
 */
export function ConversationThread({
  requestId,
  closed,
}: {
  requestId: string;
  closed?: boolean;
}) {
  const t = useTranslations("conversationThread");
  const queryClient = useQueryClient();
  const myId = useAuthStore((s) => s.user?.id);
  const [body, setBody] = useState("");

  const messagesQuery = useQuery({
    queryKey: ["connection-messages", requestId],
    queryFn: () => listConnectionMessages(requestId),
  });

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendConnectionMessage(requestId, text),
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey: ["connection-messages", requestId] });
    },
  });

  const messages = messagesQuery.data?.messages ?? [];

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      {messagesQuery.isLoading && <p className="text-xs text-muted">{t("loading")}</p>}
      {messagesQuery.isError && (
        // Fr13 (auditoria 2026-07-31): sem isso, uma falha aqui renderizava
        // uma lista VAZIA, indistinguível de "nenhuma mensagem" — quem abre
        // pra "ler o contexto antes de decidir" (aceitar/recusar) achava que
        // o outro lado não tinha escrito nada, e decidia às cegas.
        <p className="text-xs text-danger">
          {messagesQuery.error instanceof ApiError ? messagesQuery.error.message : t("loadError")}
        </p>
      )}
      <div className="flex max-h-64 flex-col gap-2 overflow-y-auto">
        {messages.map((m) => {
          const mine = m.senderId === myId;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <p
                className={
                  mine
                    ? "max-w-[80%] break-words rounded-lg bg-accent/15 px-3 py-2 text-sm text-foreground"
                    : "max-w-[80%] break-words rounded-lg bg-surface-raised px-3 py-2 text-sm text-foreground"
                }
              >
                {m.body}
              </p>
            </div>
          );
        })}
      </div>

      {!closed ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (body.trim()) sendMutation.mutate(body.trim());
          }}
        >
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={1}
            placeholder={t("placeholder")}
            className="flex-1 resize-none rounded-md border border-border bg-surface px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <Button type="submit" size="sm" disabled={sendMutation.isPending || !body.trim()}>
            {sendMutation.isPending ? t("sending") : t("send")}
          </Button>
        </form>
      ) : (
        <p className="text-xs text-muted">{t("closed")}</p>
      )}

      {sendMutation.isError && (
        <p className="text-xs text-danger">
          {sendMutation.error instanceof ApiError ? sendMutation.error.message : t("sendError")}
        </p>
      )}
    </div>
  );
}
