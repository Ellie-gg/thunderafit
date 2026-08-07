"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { getPersonalRecords } from "@/lib/api/progress";
import type { PersonalRecord } from "@/lib/types";
import { Card } from "@/components/ui/card";
import { QueryError } from "@/components/query-error";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";

/**
 * Fase 121 ("meus recordes"): maior carga já levantada por exercício.
 *
 * Antes os PRs eram calculados e **descartados** — apareciam por um instante no
 * resumo pós-treino e nunca mais, então o aluno não tinha onde ver "minhas
 * marcas". O dado sempre esteve no `SetLog`; faltava a leitura e a tela.
 *
 * Agrupa por grupo muscular porque a lista cresce com o tempo (um PR por
 * exercício já registrado) e uma lista plana de dezenas de linhas não é
 * consultável. Ordena por peso decrescente dentro do grupo — a pergunta é
 * "quanto eu levanto disso", não a ordem alfabética.
 *
 * `alunoId` opcional: a mesma tela serve o Personal olhando um aluno vinculado
 * (mesmo padrão dos outros cards de `/evolucao`).
 */
export function PersonalRecordsCard({ alunoId }: { alunoId?: string }) {
  const t = useTranslations("personalRecordsCard");
  const tCommon = useTranslations("common");
  const intlLocale = useActiveIntlLocale();

  const query = useQuery({
    queryKey: ["personal-records", alunoId ?? "self"],
    queryFn: () => getPersonalRecords(alunoId),
  });

  const records = query.data?.records ?? [];
  const porGrupo = new Map<string, PersonalRecord[]>();
  for (const r of records) {
    if (!porGrupo.has(r.muscleGroup)) porGrupo.set(r.muscleGroup, []);
    porGrupo.get(r.muscleGroup)!.push(r);
  }
  for (const lista of porGrupo.values()) lista.sort((a, b) => b.weightKg - a.weightKg);

  return (
    <Card className="flex flex-col gap-3">
      <div>
        <h2 className="font-display text-lg font-bold">{t("title")}</h2>
        <p className="text-xs text-muted">{t("subtitle")}</p>
      </div>

      {query.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}
      {query.isError && <QueryError error={query.error} onRetry={() => query.refetch()} />}

      {/* `isSuccess &&` explícito, não `!records.length`: sem isso um erro de
          rede exibiria "nenhum recorde ainda", afirmando algo falso (classe do
          Fr13 da auditoria 2026-07-31). */}
      {query.isSuccess && records.length === 0 && (
        <p className="text-sm text-muted">{t("empty")}</p>
      )}

      {query.isSuccess &&
        [...porGrupo.entries()].map(([grupo, lista]) => (
          <div key={grupo} className="flex flex-col gap-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              {grupo}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[18rem] text-left text-sm">
                <tbody>
                  {lista.map((r) => (
                    <tr key={r.exerciseId} className="border-b border-border/50">
                      <td className="py-1 pr-3">{r.exerciseName}</td>
                      <td className="py-1 pr-3 whitespace-nowrap font-semibold tabular-nums">
                        {t("weightWithReps", { weight: r.weightKg, reps: r.repsDone })}
                      </td>
                      <td className="py-1 whitespace-nowrap text-xs text-muted tabular-nums">
                        {new Date(r.achievedAt).toLocaleDateString(intlLocale)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
    </Card>
  );
}
