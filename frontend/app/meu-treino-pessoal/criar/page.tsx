"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { createSelfWorkoutProgram, addSelfProgramSession } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ReplaceSelfTemplateDialog } from "@/components/replace-self-template-dialog";

/**
 * Fase 85 — 1º passo de "montar meu treino do zero": só pede um nome. A
 * primeira sessão ("Treino A") já é criada automaticamente em seguida (2ª
 * chamada encadeada) — o aluno cai direto na tela de adicionar exercícios,
 * sem precisar entender o conceito de "sessão" antes de ver algo acontecer.
 * Sessões extras (B, C...) só entram depois, pelo botão "Adicionar treino"
 * na própria tela de exercícios — mesmo padrão incremental já usado pelo
 * Personal em `/personal/programas/[id]/sessoes/[sessionId]`.
 */
function CriarTreinoContent() {
  const t = useTranslations("criarMeuTreino");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [name, setName] = useState("");
  const [pendingReplace, setPendingReplace] = useState<{ existingProgramName: string } | null>(null);

  async function createAndOpenFirstSession(replace: boolean) {
    const { program } = await createSelfWorkoutProgram(name.trim(), replace);
    const { session } = await addSelfProgramSession(program.id, { letter: "A" });
    return { program, session };
  }

  const mutation = useMutation({
    mutationFn: () => createAndOpenFirstSession(false),
    onSuccess: ({ program, session }) => {
      router.push(`/meu-treino-pessoal/${program.id}/sessoes/${session.id}`);
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409 && error.data?.code === "SELF_PROGRAM_EXISTS") {
        setPendingReplace({ existingProgramName: String(error.data.existingProgramName ?? "") });
      }
    },
  });

  const replaceMutation = useMutation({
    mutationFn: () => createAndOpenFirstSession(true),
    onSuccess: ({ program, session }) => {
      router.push(`/meu-treino-pessoal/${program.id}/sessoes/${session.id}`);
    },
  });

  const genericError =
    mutation.isError &&
    !(mutation.error instanceof ApiError && mutation.error.status === 409 && mutation.error.data?.code === "SELF_PROGRAM_EXISTS");

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <Link
            href="/meu-treino-pessoal"
            className="mb-2 inline-block text-xs font-semibold text-muted hover:text-foreground"
          >
            {t("backLink")}
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("subtitle")}</p>
        </div>

        <Card
          className="flex flex-col gap-4"
          style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              mutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workout-name">{t("nameLabel")}</Label>
              <Input
                id="workout-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("namePlaceholder")}
              />
            </div>

            {genericError && (
              <p className="text-sm text-danger">
                {mutation.error instanceof ApiError ? mutation.error.message : t("createError")}
              </p>
            )}

            <Button type="submit" disabled={mutation.isPending || !name.trim()}>
              {mutation.isPending ? t("creating") : t("createButton")}
            </Button>
          </form>
        </Card>
      </main>

      {pendingReplace && (
        <ReplaceSelfTemplateDialog
          existingProgramName={pendingReplace.existingProgramName}
          isPending={replaceMutation.isPending}
          onCancel={() => setPendingReplace(null)}
          onConfirm={() => replaceMutation.mutate()}
        />
      )}
    </>
  );
}

export default function CriarTreinoPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <CriarTreinoContent />
    </AuthGuard>
  );
}
