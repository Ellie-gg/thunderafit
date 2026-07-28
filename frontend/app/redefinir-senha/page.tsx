"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { resetPasswordRequest } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

function RedefinirSenhaContent() {
  const t = useTranslations("resetPassword");
  const router = useRouter();
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const [newPassword, setNewPassword] = useState("");

  const mutation = useMutation({
    mutationFn: () => resetPasswordRequest(uid!, token!, newPassword),
  });

  const linkIsValid = !!uid && !!token;

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
        className="w-full max-w-sm"
        style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}
      >
        <h2 className="mb-1 font-display text-xl font-bold text-foreground">{t("title")}</h2>

        {!linkIsValid && <p className="text-sm text-danger">{t("invalidLink")}</p>}

        {linkIsValid && mutation.isSuccess && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-success">{t("success")}</p>
            <Button type="button" onClick={() => router.push("/login")}>
              {t("goToLogin")}
            </Button>
          </div>
        )}

        {linkIsValid && !mutation.isSuccess && (
          <>
            <p className="mb-5 text-sm text-muted">{t("subtitle")}</p>
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                mutation.mutate();
              }}
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="new-password">{t("newPasswordLabel")}</Label>
                <Input
                  id="new-password"
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••"
                />
              </div>

              {mutation.isError && (
                <p className="text-sm text-danger">
                  {mutation.error instanceof ApiError ? mutation.error.message : t("connectionError")}
                </p>
              )}

              <Button type="submit" disabled={!newPassword.trim() || mutation.isPending} className="mt-2">
                {mutation.isPending ? t("submitting") : t("submit")}
              </Button>
            </form>
          </>
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

export default function RedefinirSenhaPage() {
  return (
    <Suspense fallback={null}>
      <RedefinirSenhaContent />
    </Suspense>
  );
}
