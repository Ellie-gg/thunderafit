"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getWorkoutProgram } from "@/lib/api/workouts";
import { sortByScheme, labelFor } from "@/lib/session-scheme";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";

function formatDate(iso: string | null, intlLocale: string, neverCompletedLabel: string): string {
  if (!iso) return neverCompletedLabel;
  return new Date(iso).toLocaleDateString(intlLocale);
}

function ProgramaContent() {
  const t = useTranslations("programaDetail");
  const tCommon = useTranslations("common");
  const intlLocale = useActiveIntlLocale();
  const params = useParams<{ id: string }>();
  const programId = params.id;
  const programQuery = useQuery({
    queryKey: ["workout-program", programId],
    queryFn: () => getWorkoutProgram(programId),
  });

  const program = programQuery.data?.program;
  const scheme = program?.sessionScheme ?? "LETTER";
  const sessions = sortByScheme(program?.workouts ?? [], scheme);

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-4 px-6 py-8">
        {programQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
        {programQuery.isError && (
          <QueryError error={programQuery.error} onRetry={() => programQuery.refetch()} />
        )}

        {program && (
          <>
            <div>
              <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
                {t("programLabel")}
              </span>
              <h1 className="font-display text-2xl font-bold tracking-tight">{program.name}</h1>
              <p className="text-sm text-muted">
                {t("sessionCountSubtitle", { count: sessions.length })}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {sessions.map((s) => (
                <Link key={s.id} href={`/treinos/${s.id}`}>
                  <Card
                    className="flex items-center justify-between transition-colors hover:border-accent"
                    style={s.suggestedNext ? { borderColor: "var(--accent)" } : undefined}
                  >
                    <div>
                      <span className="font-display text-lg font-bold text-accent">
                        {labelFor(scheme, s.letter)}
                      </span>{" "}
                      <span className="font-semibold">{s.name}</span>
                      <p className="text-xs text-muted">
                        {t("lastCompleted", {
                          date: formatDate(s.lastCompletedAt, intlLocale, t("neverCompleted")),
                        })}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      {s.suggestedNext && (
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs font-semibold text-accent">
                          {t("suggested")}
                        </span>
                      )}
                      <span className="text-sm text-muted">{t("open")}</span>
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </>
        )}
      </main>
    </>
  );
}

export default function ProgramaPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <ProgramaContent />
    </AuthGuard>
  );
}
