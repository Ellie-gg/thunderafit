"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { lookupAlunoByEmail, createRelation } from "@/lib/api/relations";
import { ApiError } from "@/lib/api/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

function buildInviteText(t: ReturnType<typeof useTranslations>, professionalLabel: string) {
  // Fase 24 (Parte 2): /register não existe mais — o cadastro (com escolha de
  // papel) agora acontece dentro do fluxo unificado de e-mail em /login.
  const loginUrl =
    typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  return t("notFound.inviteText", { professionalLabel, loginUrl });
}

function AlunoNaoEncontrado({ professionalLabel }: { professionalLabel: string }) {
  const t = useTranslations("vincularAlunoForm");
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-md border border-danger/40 bg-danger/10 px-3 py-2.5">
      <p className="text-sm text-danger">{t("notFound.message")}</p>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={async () => {
          await navigator.clipboard.writeText(buildInviteText(t, professionalLabel));
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied ? t("notFound.copied") : t("notFound.copyButton")}
      </Button>
    </div>
  );
}

export function VincularAlunoForm({
  dashboardPath,
  professionalLabel,
}: {
  dashboardPath: string;
  /** Fase 12 (Item 3): usado no texto do convite copiável ("Personal Trainer" / "Nutricionista"). */
  professionalLabel: string;
}) {
  const t = useTranslations("vincularAlunoForm");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { user } = await lookupAlunoByEmail(email);
      return createRelation(user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relations"] });
      router.push(dashboardPath);
    },
  });

  const isAlunoNotFound = mutation.error instanceof ApiError && mutation.error.status === 404;

  function errorMessage(): string {
    if (!(mutation.error instanceof ApiError)) {
      return t("errors.connection");
    }
    switch (mutation.error.status) {
      case 409:
        return t("errors.alreadyLinked");
      case 403:
        return t("errors.planLimit");
      default:
        return mutation.error.message;
    }
  }

  return (
    <Card className="w-full max-w-sm">
      <h1 className="mb-4 font-display text-xl font-bold">{t("title")}</h1>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">{t("emailLabel")}</Label>
          <Input
            id="email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("emailPlaceholder")}
          />
        </div>

        {mutation.isError && isAlunoNotFound && (
          <AlunoNaoEncontrado professionalLabel={professionalLabel} />
        )}
        {mutation.isError && !isAlunoNotFound && (
          <p className="text-sm text-danger">{errorMessage()}</p>
        )}

        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t("submitting") : t("submit")}
        </Button>
      </form>
    </Card>
  );
}
