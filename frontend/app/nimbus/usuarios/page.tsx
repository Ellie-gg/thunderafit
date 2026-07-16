"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { listAdminUsers } from "@/lib/api/admin";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import type { Role } from "@/lib/types";

const PAGE_SIZE = 20;

const ROLE_FILTERS: Array<{ value: Role | ""; label: string }> = [
  { value: "", label: "Todos os papéis" },
  { value: "PERSONAL", label: "Personal Trainers" },
  { value: "ALUNO", label: "Alunos" },
  { value: "NUTRICIONISTA", label: "Nutricionistas" },
  { value: "ADMIN", label: "Admins" },
];

function UsersContent() {
  const [role, setRole] = useState<Role | "">("");
  const [page, setPage] = useState(1);

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
          <h1 className="font-display text-2xl font-bold tracking-tight">Usuários</h1>
          <p className="text-sm text-muted">
            Alunos sem nenhum vínculo (nem Personal, nem Nutricionista) aparecem marcados como
            "órfão".
          </p>
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

        {usersQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {usersQuery.isError && (
          <QueryError error={usersQuery.error} onRetry={() => usersQuery.refetch()} />
        )}

        {data && (
          <Card className="flex flex-col gap-2 overflow-x-auto">
            {data.users.map((u) => (
              <div
                key={u.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold">{u.email}</span>
                  <span className="text-xs text-muted">
                    {u.role} · desde {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {u.isOrphanAluno && (
                    <span className="rounded-full border border-danger/40 bg-danger/10 px-2 py-0.5 text-xs font-semibold text-danger">
                      órfão
                    </span>
                  )}
                  <span className="text-xs text-muted">
                    {u.lastLoginAt
                      ? `último login ${new Date(u.lastLoginAt).toLocaleString("pt-BR")}`
                      : "nunca logou"}
                  </span>
                  {u.role === "ALUNO" && (
                    <Link
                      href={`/nimbus/alunos/${u.id}/anamnese`}
                      className="text-xs font-semibold text-accent-secondary hover:underline"
                    >
                      Ver anamnese
                    </Link>
                  )}
                </div>
              </div>
            ))}
            {data.users.length === 0 && <p className="text-sm text-muted">Nenhum usuário encontrado.</p>}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-muted">
                Página {data.page} de {totalPages} · {data.total} usuário(s)
              </span>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Anterior
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Próxima
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
