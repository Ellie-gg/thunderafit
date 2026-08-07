"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdminUsers,
  updateUserRole,
  updateUserPremium,
  verifyUserEmail,
  deleteAdminUser,
} from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { hasActivePremium } from "@/lib/premium";
import { useAuthStore } from "@/lib/store/auth-store";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { UserAvatar } from "@/components/user-avatar";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import type { AdminUser, Role } from "@/lib/types";

const PAGE_SIZE = 20;

const EDITABLE_ROLES: Role[] = ["PERSONAL", "ALUNO", "NUTRICIONISTA", "ADMIN"];

/**
 * Fase 33: edição de role — ação sensível, então exige um passo de
 * confirmação explícito (mesmo padrão inline do `DeleteProgramButton`,
 * Fase 31) em vez de aplicar a mudança assim que o `<select>` muda. O
 * próprio admin logado não pode se auto-editar aqui — o backend já bloqueia
 * isso, mas escondemos o controle de propósito pra não convidar o clique.
 */
function RoleEditor({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const t = useTranslations("nimbusUsuarios");
  const tCommon = useTranslations("common");
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [editing, setEditing] = useState(false);
  const [pendingRole, setPendingRole] = useState<Role>(user.role);

  const mutation = useMutation({
    mutationFn: (role: Role) => updateUserRole(user.id, role),
    onSuccess: () => {
      setEditing(false);
      onChanged();
    },
  });

  if (user.id === currentUserId) return null;

  if (!editing) {
    return (
      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setEditing(true)}>
        {t("roleEditor.edit")}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 rounded-md border border-accent-secondary/40 bg-accent-secondary/10 p-2 sm:w-auto sm:items-end">
      <select
        value={pendingRole}
        onChange={(e) => setPendingRole(e.target.value as Role)}
        className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {EDITABLE_ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {pendingRole !== user.role && (
        <p className="text-xs text-accent-secondary">
          {t("roleEditor.confirmMessage", { email: user.email, currentRole: user.role, newRole: pendingRole })}
        </p>
      )}
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("roleEditor.genericError")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setEditing(false)}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 px-2.5 text-xs"
          disabled={mutation.isPending || pendingRole === user.role}
          onClick={() => mutation.mutate(pendingRole)}
        >
          {mutation.isPending ? t("roleEditor.saving") : t("roleEditor.confirmButton")}
        </Button>
      </div>
    </div>
  );
}

// Fase 90: dias restantes até uma data-limite, ou null se já venceu/não tem
// prazo — usado tanto pro Aluno Premium quanto pro plano do Personal.
function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / (24 * 60 * 60 * 1000)) : null;
}

/**
 * Fase 58: liga/desliga Premium manualmente — mesmo padrão inline de
 * confirmação do `RoleEditor` acima. "Premium" atual é derivado por role;
 * ADMIN não tem esse controle (backend rejeita com 400, então nem mostramos
 * o botão).
 *
 * O "tem Premium agora?" mora em `lib/premium.ts` (`hasActivePremium`), com
 * teste próprio — as regras de ALUNO e PERSONAL são diferentes de propósito, e
 * a do ALUNO precisa checar o PRAZO, não só o status (ver o comentário lá pro
 * porquê e pro bug que isso corrigiu).
 *
 * Fase 90: ao CONCEDER, ganha 2 campos opcionais — `tier` (só
 * PERSONAL/NUTRICIONISTA: Base ou Plus, antes só dava Plus) e "dias até
 * expirar" (em branco = permanente, mesmo comportamento de antes desta
 * fase — pra brindes por tempo limitado). Ao REVOGAR continua sem campo
 * nenhum, só confirmação (não faz sentido perguntar tier/prazo pra tirar
 * o acesso).
 */
function PremiumEditor({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const t = useTranslations("nimbusUsuarios");
  const tCommon = useTranslations("common");
  const [confirming, setConfirming] = useState(false);
  const [pendingTier, setPendingTier] = useState<"BASE" | "PLUS">("PLUS");
  const [pendingDays, setPendingDays] = useState("");

  const isPersonalLike = user.role === "PERSONAL" || user.role === "NUTRICIONISTA";
  const isPremium = hasActivePremium(user);

  const expiresInDays = daysUntil(user.role === "ALUNO" ? user.alunoPremiumExpiresAt : user.planoAssinaturaExpiresAt);

  const mutation = useMutation({
    mutationFn: (active: boolean) =>
      updateUserPremium(user.id, active, {
        tier: isPersonalLike ? pendingTier : undefined,
        days: active && pendingDays.trim() ? Number(pendingDays) : undefined,
      }),
    onSuccess: () => {
      setConfirming(false);
      setPendingDays("");
      onChanged();
    },
  });

  if (user.role === "ADMIN") return null;

  const statusLabel = !isPremium
    ? t("premiumEditor.statusNone")
    : isPersonalLike
      ? expiresInDays != null
        ? t("premiumEditor.statusTierExpiring", { tier: user.planoAssinatura, days: expiresInDays })
        : t("premiumEditor.statusTierPermanent", { tier: user.planoAssinatura })
      : expiresInDays != null
        ? t("premiumEditor.statusActiveExpiring", { days: expiresInDays })
        : t("premiumEditor.statusActivePermanent");

  if (!confirming) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-xs text-muted">{statusLabel}</span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px]"
          onClick={() => setConfirming(true)}
        >
          {isPremium ? t("premiumEditor.revoke") : t("premiumEditor.grant")}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 rounded-md border border-accent/40 bg-accent/10 p-2 sm:w-auto sm:items-end">
      <p className="text-xs text-accent">
        {isPremium
          ? t("premiumEditor.confirmRevoke", { email: user.email })
          : t("premiumEditor.confirmGrant", { email: user.email })}
      </p>
      {!isPremium && (
        <div className="flex flex-wrap items-stretch gap-1.5 sm:flex-col sm:items-end">
          {isPersonalLike && (
            <select
              value={pendingTier}
              onChange={(e) => setPendingTier(e.target.value as "BASE" | "PLUS")}
              className="h-8 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <option value="BASE">Base</option>
              <option value="PLUS">Plus</option>
            </select>
          )}
          <input
            type="number"
            min={1}
            step={1}
            value={pendingDays}
            onChange={(e) => setPendingDays(e.target.value)}
            placeholder={t("premiumEditor.daysPlaceholder")}
            className="h-8 w-36 rounded-md border border-border bg-surface px-2 text-xs text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
        </div>
      )}
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("premiumEditor.genericError")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setConfirming(false)}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 px-2.5 text-xs"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(!isPremium)}
        >
          {mutation.isPending
            ? t("premiumEditor.saving")
            : isPremium
              ? t("premiumEditor.revoke")
              : t("premiumEditor.grant")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Fase 90 — confirmar e-mail manualmente (suporte: e-mail nunca chegou,
 * conta antiga sem verificação). Mesmo padrão inline de confirmação —
 * quando já verificado, nem mostra botão de ação, só a data (nada a fazer).
 */
function EmailVerificationEditor({ user, onChanged }: { user: AdminUser; onChanged: () => void }) {
  const t = useTranslations("nimbusUsuarios");
  const tCommon = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => verifyUserEmail(user.id),
    onSuccess: () => {
      setConfirming(false);
      onChanged();
    },
  });

  if (user.emailVerifiedAt) {
    return (
      <span className="text-xs text-muted">
        {t("emailVerification.verifiedAt", { date: new Date(user.emailVerifiedAt).toLocaleDateString(intlLocale) })}
      </span>
    );
  }

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px]"
        onClick={() => setConfirming(true)}
      >
        {t("emailVerification.markVerified")}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 rounded-md border border-accent-secondary/40 bg-accent-secondary/10 p-2 sm:w-auto sm:items-end">
      <p className="text-xs text-accent-secondary">
        {t("emailVerification.confirmMessage", { email: user.email })}
      </p>
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("emailVerification.genericError")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setConfirming(false)}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 px-2.5 text-xs"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t("emailVerification.saving") : t("emailVerification.markVerified")}
        </Button>
      </div>
    </div>
  );
}

/**
 * Fase 80 — remoção definitiva de usuário. Mesmo padrão inline de
 * confirmação do `RoleEditor`/`PremiumEditor` acima — ação irreversível
 * (cascade manual no backend), então nunca aplica no primeiro clique. O
 * próprio admin logado não pode se auto-remover aqui — escondido de
 * propósito, mesmo espírito do `RoleEditor` (o backend também bloqueia).
 */
function DeleteUserButton({ user, onDeleted }: { user: AdminUser; onDeleted: () => void }) {
  const t = useTranslations("nimbusUsuarios");
  const tCommon = useTranslations("common");
  const currentUserId = useAuthStore((s) => s.user?.id);
  const [confirming, setConfirming] = useState(false);

  const mutation = useMutation({
    mutationFn: () => deleteAdminUser(user.id),
    onSuccess: () => {
      setConfirming(false);
      onDeleted();
    },
  });

  if (user.id === currentUserId) return null;

  if (!confirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 px-2 text-[11px]"
        onClick={() => setConfirming(true)}
      >
        {t("deleteUser.button")}
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col items-stretch gap-1.5 rounded-md border border-danger/40 bg-danger/10 p-2 sm:w-auto sm:items-end">
      <p className="text-xs text-danger">
        {t("deleteUser.confirmMessage", { email: user.email })}
      </p>
      {mutation.isError && (
        <p className="text-xs text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("deleteUser.genericError")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="h-8 px-2.5 text-xs" onClick={() => setConfirming(false)}>
          {tCommon("cancel")}
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 border-danger/60 px-2.5 text-xs text-danger hover:border-danger"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? t("deleteUser.deleting") : t("deleteUser.confirmButton")}
        </Button>
      </div>
    </div>
  );
}

function UsersContent() {
  const t = useTranslations("nimbusUsuarios");
  const tCommon = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const queryClient = useQueryClient();
  const [role, setRole] = useState<Role | "">("");
  const [page, setPage] = useState(1);

  const ROLE_FILTERS: Array<{ value: Role | ""; label: string }> = [
    { value: "", label: t("roleFilter.all") },
    { value: "PERSONAL", label: t("roleFilter.personal") },
    { value: "ALUNO", label: t("roleFilter.aluno") },
    { value: "NUTRICIONISTA", label: t("roleFilter.nutricionista") },
    { value: "ADMIN", label: t("roleFilter.admin") },
  ];

  const usersQuery = useQuery({
    queryKey: ["admin", "users", role, page],
    queryFn: () => listAdminUsers({ role: role || undefined, page, pageSize: PAGE_SIZE }),
  });

  const data = usersQuery.data;
  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-sm text-muted">{t("description")}</p>
        </div>

        <select
          value={role}
          onChange={(e) => {
            setRole(e.target.value as Role | "");
            setPage(1);
          }}
          className="h-11 w-fit rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {ROLE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </select>

        {usersQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {usersQuery.isError && (
          <QueryError error={usersQuery.error} onRetry={() => usersQuery.refetch()} />
        )}

        {data && (
          <Card className="flex flex-col gap-2 overflow-x-auto">
            {data.users.map((u) => (
              <div
                key={u.id}
                data-testid={`user-row-${u.id}`}
                className="flex flex-col gap-3 rounded-md border border-border px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <UserAvatar email={u.email} avatarUrl={u.avatarUrl} size={36} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-semibold">{u.name?.trim() || u.email}</span>
                    {u.name?.trim() && <span className="truncate text-xs text-muted">{u.email}</span>}
                    <span className="truncate text-xs text-muted">
                      {u.role} · {t("linkedSince", { date: new Date(u.createdAt).toLocaleDateString(intlLocale) })}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  {u.isOrphanAluno && (
                    <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                      {t("orphanBadge")}
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {u.lastLoginAt
                      ? t("lastLogin", { date: new Date(u.lastLoginAt).toLocaleString(intlLocale) })
                      : t("neverLoggedIn")}
                  </span>
                  {u.role === "ALUNO" && (
                    <Link
                      href={`/nimbus/alunos/${u.id}/anamnese`}
                      className="text-xs font-semibold text-accent-secondary hover:underline"
                    >
                      {t("viewAnamnesis")}
                    </Link>
                  )}
                  <EmailVerificationEditor
                    user={u}
                    onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
                  />
                  <PremiumEditor
                    user={u}
                    onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
                  />
                  <RoleEditor
                    user={u}
                    onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
                  />
                  <DeleteUserButton
                    user={u}
                    onDeleted={() => queryClient.invalidateQueries({ queryKey: ["admin", "users"] })}
                  />
                </div>
              </div>
            ))}
            {data.users.length === 0 && <p className="text-sm text-muted">{t("empty")}</p>}

            <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs text-muted">
                {t("pagination", { page: data.page, totalPages, total: data.total })}
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  {t("previous")}
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 px-2.5 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  {t("next")}
                </Button>
              </div>
            </div>
          </Card>
        )}
      </main>
    </>
  );
}

export default function AdminUsersPage() {
  return (
    <AuthGuard allowedRoles={["ADMIN"]}>
      <UsersContent />
    </AuthGuard>
  );
}
