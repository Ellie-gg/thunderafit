"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { listSelfTemplates, applySelfTemplate } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

/**
 * Fase 34.5 — "Meu treino pessoal": templates curados pelo admin (origin:
 * SELF), sem Personal nenhum envolvido. O aluno só escolhe e aplica (cópia,
 * mesmo padrão de sempre) — sem acesso ao catálogo completo de exercícios
 * nem montagem livre nesta fase. "Crie seu treino do zero" é só um
 * placeholder visual ("em breve"): não decidimos ainda se vira feature paga.
 */
function MeuTreinoPessoalContent() {
  const router = useRouter();
  const templatesQuery = useQuery({ queryKey: ["self-templates"], queryFn: listSelfTemplates });

  const applyMutation = useMutation({
    mutationFn: (programId: string) => applySelfTemplate(programId),
    onSuccess: (data) => {
      router.push(`/programas/${data.program.id}`);
    },
  });

  const templates = templatesQuery.data?.programs ?? [];

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Meu Treino Pessoal</h1>
          <p className="text-sm text-muted">
            Templates prontos, sem precisar de um Personal. Escolha um e comece a treinar hoje
            mesmo.
          </p>
        </div>

        {templatesQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {templatesQuery.isError && (
          <QueryError error={templatesQuery.error} onRetry={() => templatesQuery.refetch()} />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {templates.map((tpl) => (
            <Card key={tpl.id} className="flex flex-col gap-2">
              <h2 className="font-display text-lg font-bold">{tpl.name}</h2>
              <p className="text-xs text-muted">
                {tpl.workouts?.length ?? 0} sessão(ões) ·{" "}
                {tpl.sessionScheme === "WEEKDAY" ? "dias da semana" : "letras"}
              </p>
              <Button
                className="mt-2"
                disabled={applyMutation.isPending}
                onClick={() => applyMutation.mutate(tpl.id)}
              >
                {applyMutation.isPending ? "Aplicando..." : "Aplicar este treino"}
              </Button>
            </Card>
          ))}
        </div>

        {templatesQuery.isSuccess && templates.length === 0 && (
          <p className="text-sm text-muted">Nenhum treino pessoal disponível ainda.</p>
        )}

        {applyMutation.isError && (
          <p className="text-sm text-danger">
            {applyMutation.error instanceof ApiError
              ? applyMutation.error.message
              : "Erro ao aplicar o treino."}
          </p>
        )}

        {/* Placeholder visual — sem lógica por trás, "em breve". Não decide
            ainda se vira feature paga (ver STATUS.md, Fase 34.5). */}
        <Card className="flex flex-col gap-2 border-dashed opacity-70">
          <div className="flex items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold">Crie seu treino do zero</h2>
            <span className="shrink-0 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted">
              Em breve
            </span>
          </div>
          <p className="text-sm text-muted">
            Montar seu próprio treino, exercício por exercício, com acesso ao catálogo completo.
          </p>
          <Button type="button" disabled>
            Em breve
          </Button>
        </Card>

        <p className="text-center text-sm text-muted">
          Quer um acompanhamento mais de perto?{" "}
          <Link href="/profissionais" className="font-semibold text-accent-secondary hover:underline">
            Convide um Personal
          </Link>
          .
        </p>
      </main>
    </>
  );
}

export default function MeuTreinoPessoalPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <MeuTreinoPessoalContent />
    </AuthGuard>
  );
}
