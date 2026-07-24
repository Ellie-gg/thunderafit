"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("duvidasList");
  const isRespondido = status === "RESPONDIDO";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        isRespondido ? "bg-success/15 text-success" : "bg-accent/15 text-accent"
      }`}
    >
      {isRespondido ? t("status.respondido") : t("status.aberto")}
    </span>
  );
}

function NovaDuvidaForm({ onCreated }: { onCreated: () => void }) {
  const t = useTranslations("duvidasList");
  const personalsQuery = useQuery({ queryKey: ["my-personals"], queryFn: listMyPersonals });
  const [selectedPersonalId, setSelectedPersonalId] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");

  const personals = personalsQuery.data?.personals ?? [];
  // Sem estado derivado via effect: se só existe 1 profissional, usa ele
  // direto; com mais de 1 (ex: Personal + Nutricionista), cai no que o usuário
  // escolheu no <select>.
  const personalId = personals.length === 1 ? personals[0].id : selectedPersonalId;
  const typeLabel = (type: string) =>
    type === "NUTRICIONISTA" ? t("form.typeNutricionista") : t("form.typePersonal");

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
      <h2 className="font-display text-lg font-bold">{t("newQuestion")}</h2>

      {personalsQuery.isSuccess && personals.length === 0 && (
        <p className="text-sm text-muted">{t("form.noPersonals")}</p>
      )}

      {personals.length === 1 && (
        <p className="text-xs text-muted">
          {t("form.recipientFor", {
            type: typeLabel(personals[0].professionalType),
            email: personals[0].email,
          })}
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
              <Label htmlFor="personal">{t("form.recipientLabel")}</Label>
              <select
                id="personal"
                required
                value={selectedPersonalId}
                onChange={(e) => setSelectedPersonalId(e.target.value)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="" disabled>
                  {t("form.selectOption")}
                </option>
                {personals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {t("form.recipientOption", { type: typeLabel(p.professionalType), email: p.email })}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="subject">{t("form.subjectLabel")}</Label>
            <Input
              id="subject"
              required
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("form.subjectPlaceholder")}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="message">{t("form.messageLabel")}</Label>
            <textarea
              id="message"
              required
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
              className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              placeholder={t("form.messagePlaceholder")}
            />
          </div>

          {mutation.isError && (
            <p className="text-sm text-danger">
              {mutation.error instanceof ApiError
                ? mutation.error.message
                : t("form.connectionError")}
            </p>
          )}

          <Button type="submit" disabled={mutation.isPending} className="self-start">
            {mutation.isPending ? t("form.sending") : t("form.submit")}
          </Button>
        </form>
      )}
    </Card>
  );
}

function DuvidasContent() {
  const t = useTranslations("duvidasList");
  const tCommon = useTranslations("common");
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
            <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
            <p className="text-sm text-muted">{t("subtitle")}</p>
          </div>
          <Button size="sm" onClick={() => setShowForm((s) => !s)}>
            {showForm ? tCommon("cancel") : t("newQuestion")}
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

        {threadsQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}

        {threadsQuery.isError && (
          <QueryError error={threadsQuery.error} onRetry={() => threadsQuery.refetch()} />
        )}

        {threadsQuery.isSuccess && threads.length === 0 && (
          <Card>
            <p className="text-sm text-muted">{t("empty")}</p>
          </Card>
        )}

        <div className="flex flex-col gap-3">
          {threads.map((thread) => (
            <Link key={thread.id} href={`/duvidas/${thread.id}`}>
              <Card className="flex items-center justify-between transition-colors hover:border-accent">
                <div>
                  <p className="font-semibold">{thread.subject}</p>
                  <p className="text-xs text-muted">
                    {thread.messages[0]?.text.slice(0, 60)}
                    {(thread.messages[0]?.text.length ?? 0) > 60 ? t("truncationEllipsis") : ""}
                  </p>
                </div>
                <StatusBadge status={thread.status} />
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
