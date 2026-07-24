import prisma from "../../lib/prisma";

export const progressRepository = {
  /**
   * Consulta ClientRelation direto via Prisma (mesmo padrão do módulo
   * anamnesis) — evita importar o repository de outro domínio (`/src/fitness`),
   * mantendo os domínios desacoplados.
   *
   * Bugs potenciais considerados antes de escrever esta função:
   * - usar `findFirst` em vez da chave composta esconderia duplicatas —
   *   `@@unique([personalId, alunoId])` no schema já garante no máximo 1 linha,
   *   então `findUnique` é seguro e mais explícito sobre essa garantia.
   * - o campo se chama `personalId` mesmo para vínculo de NUTRICIONISTA (é o
   *   nome genérico usado desde a Fase 11) — não renomear o parâmetro aqui
   *   pra não divergir do restante do schema/domínio.
   * - validação de presença (alunoId/personalId vazios) fica no controller,
   *   não aqui — mesmo padrão do anamnesisRepository.findRelation.
   */
  async findRelation(personalId: string, alunoId: string) {
    return prisma.clientRelation.findUnique({
      where: { personalId_alunoId: { personalId, alunoId } },
    });
  },

  /**
   * Perf (triagem 2026-07-24): getLoadHistory antes buscava TODAS as séries
   * históricas do exercício só para reduzir isso em JS a 1 ponto por dia (o
   * pico) — cresce sem limite conforme o tempo de casa do aluno. Agregação
   * por dia feita direto no Postgres via `$queryRaw` (mesmo padrão de
   * `admin.repository.ts#newUsersLast30Days` e
   * `workout-summary.repository.ts#findMaxHistoricalWeightsForExercises`):
   * devolve só 1 linha por dia com o pico, nunca as séries individuais.
   *
   * Timezone: `loggedAt` é `TIMESTAMP(3)` (sem timezone, ver schema.prisma).
   * `date_trunc('day', ...)` sobre um tipo SEM timezone não aplica nenhum
   * deslocamento de fuso (isso só aconteceria se a coluna fosse
   * `timestamptz`, sujeita ao `TimeZone` da sessão) — o truncamento age
   * direto sobre os componentes de data/hora armazenados. Como esses
   * componentes já são gravados/lidos como UTC (mesma convenção usada em
   * todo o domínio, ver `dayKey` em progress.service.ts), o dia resultante
   * aqui é idêntico ao que `toISOString().slice(0,10)` produzia antes — sem
   * risco de divergência de fuso entre Postgres e JS.
   */
  async findMaxWeightByDayForExercise(
    alunoId: string,
    exerciseId: string
  ): Promise<Array<{ day: Date; maxWeightKg: number }>> {
    const rows = await prisma.$queryRaw<Array<{ day: Date; maxWeightKg: number }>>`
      SELECT date_trunc('day', sl."loggedAt") AS day, MAX(sl."weightKg") AS "maxWeightKg"
      FROM "SetLog" sl
      JOIN "WorkoutExercise" we ON sl."workoutExerciseId" = we.id
      JOIN "Workout" w ON we."workoutId" = w.id
      WHERE we."exerciseId" = ${exerciseId} AND w."alunoId" = ${alunoId}
      GROUP BY day
      ORDER BY day ASC
    `;
    // MAX(weightKg) sobre uma coluna Float/double precision pode vir do driver
    // como algo não estritamente `number` (mesmo cuidado de
    // findMaxHistoricalWeightsForExercises em workout-summary.repository.ts)
    // — Number(...) normaliza antes de devolver.
    return rows.map((r) => ({ day: r.day, maxWeightKg: Number(r.maxWeightKg) }));
  },

  async findSetLogsSince(alunoId: string, since: Date) {
    return prisma.setLog.findMany({
      where: {
        workoutExercise: { workout: { alunoId } },
        loggedAt: { gte: since },
      },
      // Perf (triagem 2026-07-24): select explícito — getFrequency só lê
      // loggedAt + workoutExercise.workoutId; getWeeklySummary só lê
      // loggedAt/weightKg/repsDone. Nenhum consumidor precisa de
      // id/setNumber/workoutExerciseId (nem do restante de WorkoutExercise
      // além do workoutId), que antes vinham inteiros no payload.
      select: {
        loggedAt: true,
        weightKg: true,
        repsDone: true,
        workoutExercise: { select: { workoutId: true } },
      },
      orderBy: { loggedAt: "asc" },
    });
  },

  async findLoggedExercisesForAluno(alunoId: string) {
    return prisma.workoutExercise.findMany({
      where: {
        workout: { alunoId },
        setLogs: { some: {} },
      },
      include: { exercise: true },
      distinct: ["exerciseId"],
    });
  },
};
