"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getWorkoutProgram, addProgramSession, applyProgram } from "@/lib/api/workouts";
import { listRelations } from "@/lib/api/relations";
import { ApiError } from "@/lib/api/client";
import { orderFor, maxSessionsFor, sortByScheme, labelFor } from "@/lib/session-scheme";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";

function ProgramaDetalheContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const programId = params.id;
  const queryClient = useQueryClient();

  const programQuery = useQuery({
    queryKey: ["workout-program", programId],
    queryFn: () => getWorkoutProgram(programId),
  });
  const relationsQuery = useQuery({ queryKey: ["relations"], queryFn: listRelations });

  // Fase 25: pré-preenche com o aluno-alvo escolhido na criação do programa
  // (query string ?alunoId=), quando houver — só um atalho, aplicar continua
  // sendo um clique explícito. Preservado nos links pras telas de sessão
  // (Fase 26) pra sobreviver à ida-e-volta do fluxo de prescrição.
  const alunoIdParam = searchParams.get("alunoId") ?? "";
  const [applyAlunoId, setApplyAlunoId] = useState(alunoIdParam);
  const query = alunoIdParam ? `?alunoId=${alunoIdParam}` : "";

  const addSessionMutation = useMutation({
    mutationFn: (letter: string) => addProgramSession(programId, { letter }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["workout-program", programId] });
      router.push(`/personal/programas/${programId}/sessoes/${data.session.id}${query}`);
    },
  });

  const applyMutation = useMutation({
    mutationFn: () => applyProgram(programId, applyAlunoId),
    onSuccess: () => {
      setApplyAlunoId("");
      queryClient.invalidateQueries({ queryKey: ["workout-programs", "personal"] });
    },
  });

  const program = programQuery.data?.program;
  const scheme = program?.sessionScheme ?? "LETTER";
  const sessions = sortByScheme(program?.workouts ?? [], scheme);
  const usedKeys = new Set(sessions.map((s) => s.letter));
  const availableKeys = orderFor(scheme).filter((k) => !usedKeys.has(k));
  const maxSessions = maxSessionsFor(scheme);

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        {programQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {programQuery.isError && (
          <QueryError error={programQuery.error} onRetry={() => programQuery.refetch()} />
        )}

        {program && (
          <>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {program.isTemplate ? "Template" : "Aplicado a aluno"}
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">{program.name}</h1>
              <p className="text-sm text-muted">
                {sessions.length}/{maxSessions} sessão(ões)
              </p>
            </div>

            {/* Sessões — cada uma abre sua própria tela de prescrição (Fase 26) */}
            <section className="flex flex-col gap-3">
              {sessions.map((s) => (
                <Link key={s.id} href={`/personal/programas/${programId}/sessoes/${s.id}${query}`}>
                  <Card className="flex items-center justify-between transition-colors hover:border-accent">
                    <div>
                      <span className="font-display text-lg font-bold text-accent">
                        {labelFor(scheme, s.letter)}
                      </span>{" "}
                      <span className="font-semibold">{s.name}</span>
                      <p className="text-xs text-muted">{s.exercises?.length ?? 0} exercício(s)</p>
                    </div>
                    <span className="text-sm text-muted">Abrir →</span>
                  </Card>
                </Link>
              ))}
            </section>

            {/* Adicionar sessão */}
            {availableKeys.length > 0 && (
              <Card className="flex flex-col gap-2">
                <Label>Adicionar sessão</Label>
                <div className="flex flex-wrap gap-2">
                  {availableKeys.map((key) => (
                    <Button
                      key={key}
                      variant="outline"
                      size="sm"
                      disabled={addSessionMutation.isPending}
                      onClick={() => addSessionMutation.mutate(key)}
                    >
                      + {labelFor(scheme, key)}
                    </Button>
                  ))}
                </div>
                {addSessionMutation.isError && (
                  <p className="text-sm text-danger">Erro ao adicionar sessão.</p>
                )}
              </Card>
            )}

            {/* Aplicar a aluno */}
            <Card className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold">Aplicar a um aluno</h2>
              <p className="text-xs text-muted">
                Cria uma cópia independente deste programa para o aluno. Editar este
                programa depois não afeta cópias já aplicadas — e você pode aplicar
                este mesmo template a outros alunos vinculados quantas vezes quiser.
              </p>
              <select
                value={applyAlunoId}
                onChange={(e) => setApplyAlunoId(e.target.value)}
                className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <option value="" disabled>
                  Selecione um aluno
                </option>
                {relationsQuery.data?.relations.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.email}
                  </option>
                ))}
              </select>
              {applyMutation.isError && (
                <p className="text-sm text-danger">
                  {applyMutation.error instanceof ApiError
                    ? applyMutation.error.message
                    : "Erro ao aplicar."}
                </p>
              )}
              {applyMutation.isSuccess && (
                <p className="text-sm text-success">Programa aplicado ao aluno.</p>
              )}
              <Button
                disabled={!applyAlunoId || applyMutation.isPending || sessions.length === 0}
                onClick={() => applyMutation.mutate()}
              >
                {applyMutation.isPending ? "Aplicando..." : "Aplicar programa"}
              </Button>
            </Card>
          </>
        )}
      </main>
    </>
  );
}

export default function ProgramaDetalhePage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL", "NUTRICIONISTA"]}>
      <Suspense fallback={null}>
        <ProgramaDetalheContent />
      </Suspense>
    </AuthGuard>
  );
}
