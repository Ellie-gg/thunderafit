"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listThreads, listMyPersonals, createThread } from "@/lib/api/support";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { QueryError } from "@/components/query-error";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function StatusBadge({ status }: { status: string }) {
  const isRespondido = status === "RESPONDIDO";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        isRespondido ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
      }`}
    >
      {isRespondido ? "Respondido" : "Aberto"}
    </span>
  );
}

function NovaDuvidaForm({ onCreated }: { onCreated: () => void }) {
  const personalsQuery = useQuery({ queryKey: ["my-personals"], queryFn: listMyPersonals });
  const [selectedPersonalId, setSelectedPersonalId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const personals = personalsQuery.data?.personals ?? [];
  // Sem estado derivado via effect: se só existe 1 profissional, usa ele
  // direto; com mais de 1 (ex: Personal + Nutricionista), cai no que o usuário
  // escolheu no <select>.
  const personalId = personals.length === 1 ? personals[0].id : selectedPersonalId;
  const typeLabel = (t: string) => (t === "NUTRICIONISTA" ? "Nutricionista" : "Personal");

  const mutation = useMutation({
    mutationFn: () => createThread({ personalId, subject, message }),
    onSuccess: () => {
      setSubject("");
      setMessage("");
      onCreated();
    },
  });

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold">Nova dúvida</h2>

      {personalsQuery.isSuccess && personals.length === 0 && (
        <p className="text-sm text-muted">
          Você precisa estar vinculado a um Personal Trainer ou Nutricionista para enviar uma
          dúvida.
        </p>
      )}

      {personals.length === 1 && (
        <p className="text-xs text-muted">
          Para: {typeLabel(personals[0].professionalType)} ({personals[0].email})
        </p>
      )}

      {personals.length > 0 && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            mutation.mutate();
          }}
        >
          {personals.length > 1 && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="personal">Destinatário</Label>
              <select
                id="personal"
                required
                value={selectedPersonalId}
                onChange={(e) => setSelectedPersonalId(e.target.value)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="" disabled>
                  Selecione
                </option>
                {personals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {typeLabel(p.professionalType)} — {p.email}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">Assunto</Label>
            <Input
              id="subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex: Dor no ombro durante o supino"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">Mensagem</Label>
            <textarea
              id="message"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder="Descreva sua dúvida..."
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-danger">
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : "Não foi possível conectar ao servidor."}
            </p>
          )}

          <Button type="submit" disabled={mutation.isPending} className="self-start">
            {mutation.isPending ? "Enviando..." : "Enviar dúvida"}
          </Button>
        </form>
      )}
    </Card>
  );
}

function DuvidasContent() {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const threadsQuery = useQuery({ queryKey: ["support-threads"], queryFn: listThreads });

  const threads = threadsQuery.data?.threads ?? [];

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight">Dúvidas</h1>
            <p className="text-sm text-muted">Converse com seu Personal Trainer.</p>
          </div>
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? "Cancelar" : "Nova dúvida"}
          </Button>
        </div>

        {showForm && (
          <NovaDuvidaForm
            onCreated={() => {
              setShowForm(false);
              queryClient.invalidateQueries({ queryKey: ["support-threads"] });
            }}
          />
        )}

        {threadsQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}

        {threadsQuery.isError && (
          <QueryError error={threadsQuery.error} onRetry={() => threadsQuery.refetch()} />
        )}

        {threadsQuery.isSuccess && threads.length === 0 && (
          <Card>
            <p className="text-sm text-muted">Nenhuma dúvida enviada ainda.</p>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {threads.map((t) => (
            <Link key={t.id} href={`/duvidas/${t.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <p className="font-semibold">{t.subject}</p>
                  <p className="text-xs text-muted">
                    {t.messages[0]?.text.slice(0, 60)}
                    {(t.messages[0]?.text.length ?? 0) > 60 ? "..." : ""}
                  </p>
                </div>
                <StatusBadge status={t.status} />
              </Card>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

export default function DuvidasPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <DuvidasContent />
    </AuthGuard>
  );
}
