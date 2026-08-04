"use client";

import { useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listRelations, setPaymentReminder, type RelationAluno } from "@/lib/api/relations";
import { listWorkoutPrograms } from "@/lib/api/workouts";
import { listLoggedExercises, getLoadHistory, getFrequency, getSessionHistory } from "@/lib/api/progress";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QueryError } from "@/components/query-error";
import { DeleteProgramButton } from "@/components/delete-program-button";
import { UserAvatar } from "@/components/user-avatar";
import { EffortDistributionBar } from "@/components/effort-distribution-bar";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import { useTranslations } from "next-intl";

// Perf (Grupo Y, item 103): mesmo motivo do `/evolucao` do aluno — `recharts`
// só entra quando o histórico/frequência deste aluno específico já chegou.
const LoadHistoryChart = dynamic(
  () => import("@/components/load-history-chart").then((m) => m.LoadHistoryChart),
  { ssr: false }
);
const FrequencyChart = dynamic(
  () => import("@/components/frequency-chart").then((m) => m.FrequencyChart),
  { ssr: false }
);
// Fase 112: extensão leve pro Personal (plano de dados pro dashboard
// histórico) — MESMO componente/endpoint já usado em `/evolucao` do aluno,
// só passando `alunoId` (o backend já aceita isso desde a Fase 29, mesmo
// padrão de `getLoadHistory`/`getFrequency` acima). Nenhuma tela nova.
const SessionTrendChart = dynamic(
  () => import("@/components/session-trend-chart").then((m) => m.SessionTrendChart),
  { ssr: false }
);

// Fase 42 (MASTER_SPEC) — lembrete de pagamento: o Personal define uma
// próxima data de cobrança (com recorrência mensal opcional); o aluno recebe
// UMA notificação in-app quando faz login na data (ou depois dela). Não
// processa pagamento nenhum — é só lembrete. Checagem "já disparou" não
// existe à parte: disparar sempre avança (recorrente) ou limpa (não-recorrente)
// a própria data no backend, então o form aqui só reflete o estado atual.
function PaymentReminderCard({ alunoId, aluno }: { alunoId: string; aluno: RelationAluno }) {
  const t = useTranslations("paymentReminderCard");
  const intlLocale = useActiveIntlLocale();
  const queryClient = useQueryClient();
  const hasActiveReminder = !!aluno.paymentReminderDueDate;
  const [dueDate, setDueDate] = useState(aluno.paymentReminderDueDate?.slice(0, 10) ?? "");
  const [recurring, setRecurring] = useState(aluno.paymentReminderRecurring);

  const mutation = useMutation({
    mutationFn: (input: { dueDate: string | null; recurring: boolean }) =>
      setPaymentReminder(alunoId, input.dueDate, input.recurring),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["relations"] });
    },
  });

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="font-display text-lg font-bold">{t("titulo")}</h2>
      <p className="text-xs text-muted">{t("descricao")}</p>

      {hasActiveReminder && (
        <p className="text-sm text-foreground">
          {t("proximoLembrete", {
            data: new Date(aluno.paymentReminderDueDate!).toLocaleDateString(intlLocale),
          })}
          {aluno.paymentReminderRecurring && t("repeteTodoMes")}
        </p>
      )}

      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!dueDate) return;
          mutation.mutate({ dueDate: new Date(dueDate).toISOString(), recurring });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`payment-reminder-date-${alunoId}`}>{t("proximaCobranca")}</Label>
          <Input
            id={`payment-reminder-date-${alunoId}`}
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={recurring}
            onChange={(e) => setRecurring(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-accent"
          />
          {t("repetirTodoMes")}
        </label>
        <div className="flex gap-2">
          <Button type="submit" disabled={mutation.isPending || !dueDate}>
            {hasActiveReminder ? t("atualizarLembrete") : t("salvarLembrete")}
          </Button>
          {hasActiveReminder && (
            <Button
              type="button"
              variant="secondary"
              disabled={mutation.isPending}
              onClick={() => {
                setDueDate("");
                setRecurring(false);
                mutation.mutate({ dueDate: null, recurring: false });
              }}
            >
              {t("desativar")}
            </Button>
          )}
        </div>
      </form>

      {mutation.isError && (
        <p className="text-sm text-danger">
          {mutation.error instanceof ApiError ? mutation.error.message : t("erroSalvar")}
        </p>
      )}
    </Card>
  );
}

/**
 * Fase 29 — hub de administração do aluno: o Personal cria um programa e
 * antes não tinha pra onde voltar pra ver o que já prescreveu, acompanhar
 * evolução ou acessar a anamnese, tudo num só lugar. Cada seção reaproveita
 * telas/endpoints já existentes (programas → /personal/programas/[id];
 * evolução → mesmos componentes de gráfico e endpoints de /evolucao, agora
 * também liberados pro Personal vinculado; anamnese → link pra tela já
 * existente desde a Fase 17) — nada duplicado.
 */
function AlunoHubContent() {
  const t = useTranslations("alunoHub");
  const tc = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const params = useParams<{ alunoId: string }>();
  const alunoId = params.alunoId;
  const queryClient = useQueryClient();

  const relationsQuery = useQuery({ queryKey: ["relations"], queryFn: listRelations });
  const aluno = relationsQuery.data?.relations.find((r) => r.id === alunoId);

  // As 4 queries abaixo só precisam de `alunoId` (já disponível via
  // useParams, sem esperar `relationsQuery` resolver) — antes ficavam
  // `enabled: !!aluno`, criando um waterfall desnecessário (esperar a lista
  // inteira de alunos carregar só pra então disparar as outras 4 em série).
  // A posse (Personal realmente vinculado a este aluno) já é validada no
  // BACKEND em cada endpoint via ClientRelation (ex: progress.controller.ts
  // ::assertAluno) — o gate aqui nunca foi uma checagem de segurança, só
  // serialização client-side. Sem vínculo, o backend responde 403/vazio e a
  // mensagem de "não vinculado" abaixo (via relationsQuery) já cobre a UI.
  const programsQuery = useQuery({
    queryKey: ["workout-programs", "personal", "aluno", alunoId],
    queryFn: () => listWorkoutPrograms(undefined, alunoId),
  });

  const [selectedExerciseId, setSelectedExerciseId] = useState("");
  const exercisesQuery = useQuery({
    queryKey: ["progress-exercises", alunoId],
    queryFn: () => listLoggedExercises(alunoId),
  });
  const exercises = exercisesQuery.data?.exercises ?? [];
  const exerciseId = selectedExerciseId || exercises[0]?.id || "";

  const loadHistoryQuery = useQuery({
    queryKey: ["load-history", alunoId, exerciseId],
    queryFn: () => getLoadHistory(exerciseId, alunoId),
    enabled: !!exerciseId,
  });

  const frequencyQuery = useQuery({
    queryKey: ["frequency", alunoId],
    queryFn: () => getFrequency("6m", alunoId),
  });

  // Fase 112: mesma extensão leve — tendência de duração/carga de treino +
  // distribuição de esforço deste aluno específico.
  const sessionHistoryQuery = useQuery({
    queryKey: ["session-history", alunoId],
    queryFn: () => getSessionHistory(alunoId),
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        {relationsQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}
        {relationsQuery.isError && (
          <QueryError error={relationsQuery.error} onRetry={() => relationsQuery.refetch()} />
        )}

        {relationsQuery.isSuccess && !aluno && (
          <Card>
            <p className="text-sm text-danger">{t("naoVinculado")}</p>
          </Card>
        )}

        {aluno && (
          <>
            <div className="flex items-center gap-3">
              <UserAvatar email={aluno.email} avatarUrl={aluno.avatarUrl} size={56} />
              <div className="min-w-0">
                <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                  {t("aluno")}
                </span>
                {/* break-all: e-mail é uma string sem espaços — sem isso ela
                    estoura a largura da tela no celular em vez de quebrar linha. */}
                <h1 className="break-all font-display text-xl font-bold tracking-tight sm:text-2xl">
                  {aluno.email}
                </h1>
                <p className="text-sm text-muted">
                  {t("vinculadoDesde", {
                    data: new Date(aluno.createdAt).toLocaleDateString(intlLocale),
                  })}
                </p>
              </div>
            </div>

            <Link
              href={`/personal/alunos/${alunoId}/anamnese`}
              className="text-sm font-semibold text-accent-secondary hover:underline"
            >
              {t("verAnamnese")}
            </Link>

            <PaymentReminderCard alunoId={alunoId} aluno={aluno} />

            <Card className="flex flex-col gap-3">
              <h2 className="font-display text-lg font-bold">{t("programasDeTreino")}</h2>
              {programsQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}
              {programsQuery.isError && (
                <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
              )}
              {programsQuery.isSuccess && programsQuery.data.programs.length === 0 && (
                <p className="text-sm text-muted">{t("nenhumProgramaAplicado")}</p>
              )}
              <div className="flex flex-col gap-2">
                {programsQuery.data?.programs.map((p) => (
                  <Link key={p.id} href={`/personal/programas/${p.id}`}>
                    <div className="flex items-center justify-between rounded-md border border-border px-3 py-2 transition-colors hover:border-accent">
                      <div>
                        <span className="font-semibold">{p.name}</span>
                        <p className="text-xs text-muted">
                          {t("sessoesCount", { count: p.workouts?.length ?? 0 })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <DeleteProgramButton
                          programId={p.id}
                          isTemplate={false}
                          onDeleted={() =>
                            // Fr19 (auditoria 2026-07-31): só invalidava a
                            // chave ESTREITA desta própria tela — a lista
                            // usada por `/personal/alunos` vive numa chave
                            // IRMÃ (`["workout-programs","personal","instance"]`,
                            // desde o F10 desta mesma auditoria), que
                            // invalidação por prefixo não alcançava. Invalida
                            // o prefixo comum, que cobre as duas.
                            queryClient.invalidateQueries({
                              queryKey: ["workout-programs", "personal"],
                            })
                          }
                        />
                        <span className="text-sm text-muted">{t("abrir")}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            </Card>

            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-lg font-bold">{t("evolucao")}</h2>

              {exercisesQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}
              {exercisesQuery.isError && (
                <QueryError error={exercisesQuery.error} onRetry={() => exercisesQuery.refetch()} />
              )}
              {exercisesQuery.isSuccess && exercises.length === 0 && (
                <p className="text-sm text-muted">{t("semSeriesRegistradas")}</p>
              )}

              {exercises.length > 0 && (
                <>
                  <select
                    value={exerciseId}
                    onChange={(e) => setSelectedExerciseId(e.target.value)}
                    className="h-11 rounded-md border border-border bg-surface px-3.5 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  >
                    {exercises.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name} ({ex.muscleGroup})
                      </option>
                    ))}
                  </select>

                  {loadHistoryQuery.isLoading && (
                    <p className="text-sm text-muted">{t("carregandoHistorico")}</p>
                  )}
                  {loadHistoryQuery.isError && (
                    <QueryError error={loadHistoryQuery.error} onRetry={() => loadHistoryQuery.refetch()} />
                  )}
                  {loadHistoryQuery.data && loadHistoryQuery.data.history.length === 0 && (
                    <p className="text-sm text-muted">{t("semSeriesParaExercicio")}</p>
                  )}
                  {loadHistoryQuery.data && loadHistoryQuery.data.history.length > 0 && (
                    <LoadHistoryChart history={loadHistoryQuery.data.history} />
                  )}
                </>
              )}

              {frequencyQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}
              {frequencyQuery.isError && (
                <QueryError error={frequencyQuery.error} onRetry={() => frequencyQuery.refetch()} />
              )}
              {frequencyQuery.data && (
                <>
                  <p className="font-mono-nums text-sm text-muted">
                    {t("treinosUltimos6Meses", { count: frequencyQuery.data.totalWorkouts })}
                  </p>
                  <FrequencyChart months={frequencyQuery.data.months} />
                </>
              )}
            </Card>

            {/* Fase 112: extensão leve pro Personal — mesmos 2 gráficos de
                `/evolucao` do aluno, só que pra ESTE aluno específico. */}
            <Card className="flex flex-col gap-4">
              <h2 className="font-display text-lg font-bold">{t("sessionTrendTitle")}</h2>

              {sessionHistoryQuery.isLoading && <p className="text-sm text-muted">{tc("loading")}</p>}
              {sessionHistoryQuery.isError && (
                <QueryError error={sessionHistoryQuery.error} onRetry={() => sessionHistoryQuery.refetch()} />
              )}
              {sessionHistoryQuery.isSuccess && sessionHistoryQuery.data.sessions.length === 0 && (
                <p className="text-sm text-muted">{t("noSessionHistory")}</p>
              )}
              {sessionHistoryQuery.isSuccess && sessionHistoryQuery.data.sessions.length > 0 && (
                <>
                  <p className="text-xs text-muted">{t("durationTrendLabel")}</p>
                  <SessionTrendChart sessions={sessionHistoryQuery.data.sessions} metric="durationMinutes" />
                  <p className="text-xs text-muted">{t("trainingLoadTrendLabel")}</p>
                  <SessionTrendChart sessions={sessionHistoryQuery.data.sessions} metric="trainingLoad" />
                </>
              )}
            </Card>

            {sessionHistoryQuery.isSuccess && sessionHistoryQuery.data.sessions.length > 0 && (
              <Card className="flex flex-col gap-3">
                <h2 className="font-display text-lg font-bold">{t("effortDistributionTitle")}</h2>
                <EffortDistributionBar distribution={sessionHistoryQuery.data.effortDistribution} />
              </Card>
            )}
          </>
        )}
      </main>
    </>
  );
}

export default function AlunoHubPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <AlunoHubContent />
    </AuthGuard>
  );
}
