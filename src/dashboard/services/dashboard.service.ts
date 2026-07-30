import { Locale } from "@prisma/client";
import { workoutProgramsService } from "../../fitness/services/workout-programs.service";
import { dietPlansService } from "../../nutrition/services/diet-plans.service";

/**
 * Perf (triagem 2026-07-29, item de alto impacto): o dashboard do aluno
 * fazia um waterfall real de rede — a lista de programas (e a de planos de
 * dieta) precisava resolver ANTES do frontend saber qual id buscar em
 * detalhe (programa do Personal, programa próprio, plano de dieta ativo),
 * cada um sua própria ida-e-volta HTTP sequencial. Este domínio não possui
 * dado próprio — só COMPÕE, num único round trip, exatamente as mesmas
 * chamadas de serviço que os 3 endpoints já existentes fazem
 * (`workoutProgramsService.listForAluno/getProgram`,
 * `dietPlansService.listPlansForUser/getDietPlan`), preservando 100% da
 * mesma lógica de autorização/posse de cada um — nenhuma query nova foi
 * escrita, só a orquestração migrou do cliente pro servidor. `["workout-
 * programs","aluno"]` no frontend continua existindo à parte (mostra a
 * lista inteira e alimenta o empty-state/contagem), agora rodando em
 * PARALELO com esta chamada em vez de bloqueá-la.
 */
export const dashboardService = {
  async getAlunoSummary(alunoId: string, locale: Locale) {
    const [allPrograms, dietPlans] = await Promise.all([
      workoutProgramsService.listForAluno(alunoId),
      dietPlansService.listPlansForUser(alunoId, "ALUNO"),
    ]);

    const personalProgramId = allPrograms.find((p) => p.origin === "PERSONAL")?.id;
    const selfProgramId = allPrograms.find((p) => p.origin === "SELF")?.id;
    const activeDietPlanId = (dietPlans.find((p) => p.isActive) ?? dietPlans[0])?.id;

    const [personalProgram, selfProgram, dietPlan] = await Promise.all([
      personalProgramId
        ? workoutProgramsService.getProgram(personalProgramId, alunoId, "ALUNO", locale)
        : null,
      selfProgramId ? workoutProgramsService.getProgram(selfProgramId, alunoId, "ALUNO", locale) : null,
      activeDietPlanId ? dietPlansService.getDietPlan(activeDietPlanId, alunoId, "ALUNO") : null,
    ]);

    return { personalProgram, selfProgram, dietPlan };
  },
};
