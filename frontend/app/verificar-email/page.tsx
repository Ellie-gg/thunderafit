"use client";

import { Suspense, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { verifyEmailRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { dashboardPathForRole } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

function VerificarEmailContent() {
  const t = useTranslations("verifyEmail");
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");
  const setSession = useAuthStore((s) => s.setSession);
  const sessionUser = useAuthStore((s) => s.user);

  const mutation = useMutation({
    mutationFn: () => verifyEmailRequest(uid!, token!),
    onSuccess: (data) => {
      // Se este dispositivo já estava logado com a mesma conta, atualiza a
      // sessão local pra sumir o banner de "confirme seu e-mail" na hora.
      if (sessionUser?.id === data.user.id) {
        setSession(data.user);
      }
    },
  });

  const linkIsValid = !!uid && !!token;

  useEffect(() => {
    if (linkIsValid) mutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, token]);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mb-10 flex flex-col items-center gap-3">
        <span className="text-3xl" aria-hidden>
          ⚡
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          ThunderaFit
        </h1>
      </div>

      <Card
        className="w-full max-w-sm text-center"
        style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}
      >
        <h2 className="mb-4 font-display text-xl font-bold text-foreground">{t("title")}</h2>

        {!linkIsValid && <p className="text-sm text-danger">{t("invalidLink")}</p>}

        {linkIsValid && mutation.isPending && <p className="text-sm text-muted">{t("verifying")}</p>}

        {linkIsValid && mutation.isSuccess && (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-success">{t("success")}</p>
            <Button
              type="button"
              onClick={() =>
                router.push(sessionUser ? dashboardPathForRole(sessionUser.role) : "/login")
              }
            >
              {sessionUser ? t("goToDashboard") : t("goToLogin")}
            </Button>
          </div>
        )}

        {linkIsValid && mutation.isError && (
          <p className="text-sm text-danger">
            {mutation.error instanceof ApiError ? mutation.error.message : t("connectionError")}
          </p>
        )}

        <Link
          href="/login"
          className="mt-5 block text-center text-xs font-semibold text-muted hover:text-foreground"
        >
          {t("backToLogin")}
        </Link>
      </Card>
    </main>
  );
}

export default function VerificarEmailPage() {
  return (
    <Suspense fallback={null}>
      <VerificarEmailContent />
    </Suspense>
  );
}
