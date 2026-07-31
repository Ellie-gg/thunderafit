"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { listWorkoutPrograms } from "@/lib/api/workouts";
import { getAlunoDashboardSummary } from "@/lib/api/dashboard";
import { getWeeklySummary } from "@/lib/api/progress";
import { listMyPersonals } from "@/lib/api/support";
import { useAuthStore } from "@/lib/store/auth-store";
import { labelFor } from "@/lib/session-scheme";
import { firstNameOrEmailPrefix } from "@/lib/utils";
import { buildWhatsAppShareUrl } from "@/lib/whatsapp";
import type { WorkoutProgram } from "@/lib/types";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { VoltageBar } from "@/components/voltage-bar";
import { WeeklyVoltageBar } from "@/components/weekly-voltage-bar";
import { WeeklyStats } from "@/components/weekly-stats";
import { QueryError } from "@/components/query-error";
import { PremiumUpsellCard } from "@/components/premium-upsell-card";

// Fase 33.4: tempo estimado da sessão — heurística client-side (sem schema
// novo), ~40s de execução por série + o descanso prescrito entre elas. É uma
// ESTIMATIVA pro aluno decidir se começa agora, não uma medição real.
const ESTIMATED_SECONDS_PER_SET = 40;

function estimateSessionMinutes(exercises: Array<{ sets: number; restSeconds: number }>): number {
  const totalSeconds = exercises.reduce(
    (acc, ex) => acc + ex.sets * (ESTIMATED_SECONDS_PER_SET + ex.restSeconds),
    0
  );
  return Math.max(1, Math.round(totalSeconds / 60));
}

// Fase 36: mesmo card de "próxima sessão" serve os dois blocos do dashboard
// ("Prescrito pelo seu Personal" e "Meus treinos") — só muda qual programa
// (já carregado com detalhe via getWorkoutProgram) é passado.
function NextSessionCard({ program }: { program: WorkoutProgram }) {
  const t = useTranslations("alunoDashboard");
  const sessions = program.workouts ?? [];
  const nextSession = sessions.find((s) => s.suggestedNext) ?? sessions[0];
  if (!nextSession) return null;

  const nextExercises = nextSession.exercises ?? [];
  const totalSets = nextExercises.reduce((acc, ex) => acc + ex.sets, 0);
  const doneSets = nextExercises.reduce((acc, ex) => acc + (ex.setLogs?.length ?? 0), 0);
  const estimatedMinutes = nextExercises.length > 0 ? estimateSessionMinutes(nextExercises) : 0;

  return (
    <Card className="flex flex-col gap-4 border-accent/40">
      <div className="flex items-center justify-between gap-2">
        <Link
          href={`/programas/${program.id}`}
          className="truncate text-xs font-semibold uppercase tracking-wide text-accent-secondary hover:underline"
        >
          {program.name} →
        </Link>
        <span className="shrink-0 font-mono-nums text-xs text-muted">
          {t("setsCount", { done: doneSets, total: totalSets })}
        </span>
      </div>
      {/* Fase 61: letra grande do dia/treino + nome da sessão do dia (antes o
          h2 repetia "letra — nome do programa"; agora o nome do PROGRAMA vira
          o link acima, e aqui só entra letra + nome do treino do dia). */}
      <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
        <span className="font-display text-4xl font-black leading-none sm:text-5xl">
          {labelFor(program.sessionScheme, nextSession.letter)}
        </span>
        <span className="font-display text-lg font-bold text-foreground/85">{nextSession.name}</span>
      </div>
      <p className="text-xs text-muted">
        {t("exerciseCount", { count: nextExercises.length })}
        {estimatedMinutes > 0 && t("estimatedMinutesSuffix", { minutes: estimatedMinutes })}
      </p>
      <VoltageBar total={totalSets} filled={doneSets} role="ALUNO" />
      <Button asChild>
        <Link href={`/treinos/${nextSession.id}`}>{t("startWorkout")}</Link>
      </Button>
    </Card>
  );
}

// Fase 55: quando o programa "Meu treino pessoal" aplicado tem banner, o
// bloco "Meus treinos" mostra só o banner (mesmo overlay padronizado de
// self-template-carousel.tsx) em vez do card de sugestão de sessão — abre
// direto o programa (/programas/:id), onde o aluno escolhe o dia.
function SelfProgramBannerCard({ program }: { program: WorkoutProgram }) {
  return (
    <Link
      href={`/programas/${program.id}`}
      className="relative block aspect-video w-full overflow-hidden rounded-xl border border-border"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={program.bannerImageUrl!}
        alt={program.name}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-r from-black/75 via-black/20 to-transparent" />
      <div className="absolute inset-0 flex items-center px-4">
        <h3 className="font-display text-left text-sm font-black uppercase leading-[1.1] tracking-tight text-white [text-wrap:balance] [text-shadow:0_2px_8px_rgb(0_0_0_/_0.5)]">
          {program.name}
        </h3>
      </div>
    </Link>
  );
}

function buildPersonalInviteText(t: ReturnType<typeof useTranslations>) {
  // Fase 24 (Parte 2): /register não existe mais — o cadastro acontece
  // dentro do fluxo unificado de e-mail em /login (mesma base do convite já
  // usado em VincularAlunoForm, Fase 12 — só muda a direção: aqui é o aluno
  // convidando um Personal, não o contrário).
  const loginUrl = typeof window !== "undefined" ? `${window.location.origin}/login` : "/login";
  return t("inviteText", { loginUrl });
}

// Fase 36: convite quando o aluno ainda não tem nenhum Personal vinculado —
// Fase 65: ganhou um ícone no título pra bater com o card irmão "Começar
// agora" do novo empty-state de primeiro acesso — mesmo tratamento visual
// nos dois lugares onde aparece. Fase 86: trocou "copiar convite" por um
// link direto pro WhatsApp (`wa.me`, mensagem pré-preenchida) — a pessoa não
// precisa mais copiar e colar em lugar nenhum, só escolhe o contato.
function InvitePersonalCard() {
  const t = useTranslations("alunoDashboard");

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl" aria-hidden>
          🧑‍💼
        </span>
        <h2 className="font-display text-lg font-bold">{t("noPersonalTitle")}</h2>
      </div>
      <p className="text-sm text-muted">{t("noPersonalDescription")}</p>
      <Button type="button" variant="secondary" asChild>
        <a href={buildWhatsAppShareUrl(buildPersonalInviteText(t))} target="_blank" rel="noopener noreferrer">
          {t("sendWhatsAppInvite")}
        </a>
      </Button>
    </Card>
  );
}

// Fase 65: tela de primeiro acesso (ou "zerado" — sem programa nenhum e sem
// Personal vinculado) — antes eram 3 mensagens soltas e sobrepostas (o card
// de topo "noProgramsYet" + o fallback de Bloco 1 + o fallback de Bloco 2,
// que podiam aparecer os 3 juntos). Substituídas por um único par de cards
// de ação clara: "Começar agora" (escolher um treino pronto, sem precisar de
// Personal) OU "Tem seu próprio Personal?" (convite, já existia). Escopo
// confirmado com o fundador: só troca quando o aluno não tem NADA ainda —
// com Personal vinculado ou plano de dieta já ativo, o resto da tela
// continua como sempre.
function FirstTimeEmptyState() {
  const t = useTranslations("alunoDashboard");

  return (
    <>
      <Card className="flex flex-col gap-3 border-accent/40">
        <div className="flex items-center gap-2">
          <span className="text-xl" aria-hidden>
            🚀
          </span>
          <h2 className="font-display text-lg font-bold">{t("firstTimeStartTitle")}</h2>
        </div>
        <p className="text-sm text-muted">{t("firstTimeStartDescription")}</p>
        <Button asChild>
          <Link href="/meu-treino-pessoal">{t("firstTimeStartButton")}</Link>
        </Button>
      </Card>

      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-border" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">{t("or")}</span>
        <span className="h-px flex-1 bg-border" aria-hidden />
      </div>

      <InvitePersonalCard />
    </>
  );
}

function DashboardContent() {
  const t = useTranslations("alunoDashboard");
  const user = useAuthStore((s) => s.user);

  const programsQuery = useQuery({
    queryKey: ["workout-programs", "aluno"],
    queryFn: () => listWorkoutPrograms(),
  });

  const allPrograms = programsQuery.data?.programs ?? [];

  // Fase 96 (triagem de perf 2026-07-29): antes eram 3 waterfalls de rede
  // separados (lista → detalhe do programa do Personal, lista → detalhe do
  // programa próprio, lista → detalhe do plano de dieta ativo) — cada
  // detalhe só disparava depois que a respectiva lista resolvia e revelava
  // o id. Um único endpoint agregador resolve os 3 de uma vez, em paralelo
  // com `programsQuery`/`myPersonalsQuery` (que continuam existindo à parte,
  // pra contagem/empty-state e pro vínculo de Personal, respectivamente).
  const summaryQuery = useQuery({
    queryKey: ["aluno-dashboard-summary"],
    queryFn: getAlunoDashboardSummary,
  });
  const personalProgram = summaryQuery.data?.personalProgram ?? null;
  const selfProgram = summaryQuery.data?.selfProgram ?? null;
  const dietPlan = summaryQuery.data?.dietPlan ?? null;
  // "Tem Nutricionista" — `dietPlan` só é null quando a lista de planos do
  // aluno está vazia (ver dashboard.service.ts), então é equivalente a "tem
  // pelo menos 1 plano" sem precisar da lista inteira aqui.
  const hasNutricionista = dietPlan !== null;

  const weeklySummaryQuery = useQuery({
    queryKey: ["weekly-summary"],
    queryFn: () => getWeeklySummary(),
  });
  const weeklySummary = weeklySummaryQuery.data;

  // Fase 36: "tem Personal vinculado" não pode mais ser inferido de "tem
  // programa" (um programa origin: SELF não implica Personal nenhum, ao
  // contrário do que valia antes da Fase 34.5) — usa o vínculo real
  // (ClientRelation), já exposto pro aluno via /api/support/my-personals.
  const myPersonalsQuery = useQuery({ queryKey: ["my-personals"], queryFn: listMyPersonals });
  const hasPersonalRelation =
    myPersonalsQuery.isSuccess &&
    myPersonalsQuery.data.personals.some((p) => p.professionalType === "PERSONAL");

  const hasAnythingYet = allPrograms.length > 0 || hasNutricionista;
  // Fase 65: só entra no empty-state de primeiro acesso quando as 3 queries
  // que decidem "tem algo?" já resolveram (Fase 96: summaryQuery entra no
  // lugar de dietPlansQuery) — antes disso, nem mostra o esqueleto antigo
  // nem o novo, só o "Carregando..." abaixo.
  const isFirstTime =
    programsQuery.isSuccess &&
    myPersonalsQuery.isSuccess &&
    summaryQuery.isSuccess &&
    !hasAnythingYet &&
    !hasPersonalRelation;

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("greeting", { name: firstNameOrEmailPrefix(user) })}
          </h1>
          <p className="text-sm text-muted">{isFirstTime ? t("firstTimeSubtitle") : t("subtitle")}</p>
        </div>

        {programsQuery.isLoading && <p className="text-sm text-muted">{t("loadingWorkouts")}</p>}

        {programsQuery.isError && (
          <QueryError error={programsQuery.error} onRetry={() => programsQuery.refetch()} />
        )}

        {/* Fr13 (auditoria 2026-07-31): sem isto, uma falha aqui deixava o
            aluno achando que o Personal "apagou" o treino prescrito — Bloco
            1 e o convite ficam ambos escondidos quando `myPersonalsQuery`
            falha (nenhum dos dois sabe se há vínculo ou não). */}
        {myPersonalsQuery.isError && (
          <QueryError error={myPersonalsQuery.error} onRetry={() => myPersonalsQuery.refetch()} />
        )}

        {isFirstTime ? (
          <FirstTimeEmptyState />
        ) : (
          <>
            {/* Bloco 1 (Fase 36): treinos prescritos por um Personal de verdade.
                Fase 88: só renderiza quando o aluno REALMENTE tem um Personal
                vinculado — antes, sem vínculo nenhum, o cabeçalho "Prescrito
                pelo seu Personal" aparecia mesmo assim só pra abrigar o
                convite (InvitePersonalCard), prometendo uma seção de
                prescrição que não existia. Sem vínculo, o convite agora entra
                como card secundário depois do Bloco 2 (ver abaixo), sem essa
                moldura enganosa. */}
            {programsQuery.isSuccess && hasPersonalRelation && (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("personalPrescribedLabel")}
                </span>
                {personalProgram ? (
                  <NextSessionCard program={personalProgram} />
                ) : summaryQuery.isLoading ? null : (
                  <Card>
                    <p className="text-sm text-muted">{t("noPersonalPrescription")}</p>
                  </Card>
                )}
              </div>
            )}

            {/* Bloco 2 (Fase 36): templates "Meu treino pessoal" (Fase 34.5) já aplicados. */}
            {programsQuery.isSuccess && (
              <div className="flex flex-col gap-3">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {t("myWorkoutsLabel")}
                </span>
                {selfProgram ? (
                  selfProgram.bannerImageUrl ? (
                    <SelfProgramBannerCard program={selfProgram} />
                  ) : (
                    <NextSessionCard program={selfProgram} />
                  )
                ) : summaryQuery.isLoading ? null : (
                  <Card className="flex flex-col gap-2">
                    <p className="text-sm text-muted">{t("selfWorkoutsEmpty")}</p>
                    <Button asChild variant="secondary">
                      <Link href="/meu-treino-pessoal">{t("viewAvailableWorkouts")}</Link>
                    </Button>
                  </Card>
                )}
              </div>
            )}

            {/* Fase 88: convite pro Personal como card secundário, fora de
                qualquer bloco rotulado "prescrito" — só quando não há
                vínculo nenhum ainda. */}
            {!hasPersonalRelation && myPersonalsQuery.isSuccess && <InvitePersonalCard />}
          </>
        )}

        {/* Fase 85: upsell do Aluno Premium — FORA do ternário acima de
            propósito: aparece tanto no primeiro acesso (FirstTimeEmptyState)
            quanto no dashboard normal, já que "montar meu treino" é uma
            opção relevante em qualquer estado. Some sozinho quando o aluno
            já tem acesso (a própria PremiumUpsellCard decide). */}
        <PremiumUpsellCard />

        {weeklySummary && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {t("last7Days")}
            </span>
            <WeeklyVoltageBar days={weeklySummary.days} />
          </div>
        )}

        {/* Fr13: sem isto, a barra de "Últimos 7 dias" e o card de sequência
            simplesmente somem em silêncio — o aluno interpreta como perda de
            histórico, não como falha de rede passageira. */}
        {weeklySummaryQuery.isError && (
          <QueryError
            error={weeklySummaryQuery.error}
            onRetry={() => weeklySummaryQuery.refetch()}
          />
        )}

        {allPrograms.length > 0 && (
          <Link href="/programas" className="text-sm font-semibold text-accent-secondary hover:underline">
            {t("viewAllPrograms")}
          </Link>
        )}

        {summaryQuery.isError && (
          <QueryError error={summaryQuery.error} onRetry={() => summaryQuery.refetch()} />
        )}

        {dietPlan && (
          <Card className="flex flex-col gap-4 border-accent-secondary/40">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {t("todayDietPlan")}
              </span>
              <span className="font-mono-nums text-xs text-muted">
                {t("kcalLabel", { kcal: dietPlan.totalMacros.kcal })}
              </span>
            </div>
            <h2 className="font-display text-xl font-bold">{dietPlan.name}</h2>
            <div className="grid grid-cols-3 gap-2 font-mono-nums text-xs text-muted">
              <span>{t("proteinLabel", { value: dietPlan.totalMacros.proteinG })}</span>
              <span>{t("carbsLabel", { value: dietPlan.totalMacros.carbsG })}</span>
              <span>{t("fatLabel", { value: dietPlan.totalMacros.fatG })}</span>
            </div>
            <Button asChild variant="secondary">
              <Link href={`/dieta/${dietPlan.id}`}>{t("viewFullPlan")}</Link>
            </Button>
          </Card>
        )}

        {weeklySummary && (
          <WeeklyStats setsThisWeek={weeklySummary.setsThisWeek} streakDays={weeklySummary.streakDays} />
        )}

        {/* Atalhos visíveis também aqui (não só no AppHeader) — no celular,
            os links de texto do header ficam escondidos por falta de espaço.
            Fase 33.4: 3 ícones de peso visual igual (em vez de links de texto
            soltos), em violeta — claramente secundários ao hero. */}
        <div className="grid grid-cols-3 gap-2 border-t border-border pt-4 sm:hidden">
          {[
            { href: "/evolucao", icon: "📈", label: t("shortcutEvolution") },
            { href: "/anamnese", icon: "📋", label: t("shortcutAnamnesis") },
            { href: "/duvidas", icon: "💬", label: t("shortcutQuestions") },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 rounded-md py-2 text-center"
              style={{ color: "var(--role-nutricionista)" }}
            >
              <span className="text-xl" aria-hidden>
                {item.icon}
              </span>
              <span className="text-xs font-semibold">{item.label}</span>
            </Link>
          ))}
        </div>
      </main>
    </>
  );
}

export default function DashboardPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <DashboardContent />
    </AuthGuard>
  );
}
