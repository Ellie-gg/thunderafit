"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { revokeClientInvite } from "@/lib/api/client-invites";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";

/**
 * Fase 104 — mesmo padrão de confirmação inline de `DeleteProgramButton`/
 * `RemoveAlunoButton`. Revogar um convite ainda não usado só some com o
 * link — quem recebeu o link (se ainda não clicou) passa a ver "convite
 * inválido" ao tentar abri-lo depois.
 */
export function RevokeInviteButton({
  inviteId,
  onRevoked,
}: {
  inviteId: string;
  onRevoked?: () => void;
}) {
  const t = useTranslations("revokeInviteButton");
  const tCommon = useTranslations("common");
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => revokeClientInvite(inviteId),
    onSuccess: () => {
      setConfirming(false);
      onRevoked?.();
    },
  });

  if (!confirming) {
    return (
      <Button type="button" variant="ghost" size="sm" onClick={() => setConfirming(true)}>
        {t("revoke")}
      </Button>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1.5 rounded-md border border-danger/40 bg-danger/10 p-2">
      <p className="text-xs text-danger">{t("confirmRevoke")}</p>
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("revokeError")}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => setConfirming(false)}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t("revoking") : t("confirmRevokeButton")}
        </Button>
      </div>
    </div>
  );
}
