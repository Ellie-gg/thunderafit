import { workoutSummaryService } from "../services/workout-summary.service";
import { workoutSummaryRepository } from "../repository/workout-summary.repository";

jest.mock("../repository/workout-summary.repository");

const mockedRepo = workoutSummaryRepository as jest.Mocked<typeof workoutSummaryRepository>;

const WORKOUT = { id: "workout-1", alunoId: "aluno-1", name: "Treino B", letter: "B" };

let setLogCounter = 0;

function log(overrides: Partial<{ weightKg: number; repsDone: number; loggedAt: Date; exerciseId: string; exerciseName: string }> = {}) {
  setLogCounter++;
  return {
    id: `set-log-${setLogCounter}`,
    workoutExerciseId: "workout-exercise-1",
    setNumber: 1,
    weightKg: overrides.weightKg ?? 10,
    repsDone: overrides.repsDone ?? 10,
    loggedAt: overrides.loggedAt ?? new Date("2026-07-21T12:00:00.000Z"),
    workoutExercise: {
      exerciseId: overrides.exerciseId ?? "exercise-1",
      exercise: { name: overrides.exerciseName ?? "Supino Reto" },
    },
  };
}

beforeEach(() => {
  jest.resetAllMocks();
  // Default neutro: a maioria dos testes não está testando streak — só os
  // testes dedicados de streak sobrescrevem isso.
  mockedRepo.findSetLogsForAlunoSince.mockResolvedValue([]);
});

describe("workoutSummaryService.buildCompletionSummary — comparação de volume", () => {
  it("primeira conclusão do Workout (sem lastCompletedAt anterior) → hasHistory false", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([log({ weightKg: 50, repsDone: 10 })]);
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.hasHistory).toBe(false);
    expect(result.previousVolumeKg).toBeNull();
    expect(result.volumeChangePercent).toBeNull();
    expect(result.volumeKg).toBe(500);
    expect(result.setsLogged).toBe(1);
  });

  it("sessão anterior com volume 0 também vira hasHistory false (não divide por zero)", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow
      .mockResolvedValueOnce([log({ weightKg: 50, repsDone: 10 })]) // esta sessão
      .mockResolvedValueOnce([]); // sessão anterior, sem logs
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([]);

    const previous = new Date("2026-07-14T12:00:00.000Z");
    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, previous, completedAt);

    expect(result.hasHistory).toBe(false);
    expect(result.previousVolumeKg).toBe(0);
    expect(result.volumeChangePercent).toBeNull();
  });

  it("volumeChangePercent positivo quando o volume desta sessão é maior que o da anterior", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow
      .mockResolvedValueOnce([log({ weightKg: 60, repsDone: 10 })]) // esta sessão: 600
      .mockResolvedValueOnce([log({ weightKg: 50, repsDone: 10 })]); // anterior: 500
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([{ weightKg: 55 }]);

    const previous = new Date("2026-07-14T12:00:00.000Z");
    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, previous, completedAt);

    expect(result.hasHistory).toBe(true);
    expect(result.volumeChangePercent).toBe(20);
  });

  it("volumeChangePercent negativo quando o volume desta sessão é menor que o da anterior", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow
      .mockResolvedValueOnce([log({ weightKg: 40, repsDone: 10 })]) // esta sessão: 400
      .mockResolvedValueOnce([log({ weightKg: 50, repsDone: 10 })]); // anterior: 500
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([{ weightKg: 55 }]);

    const previous = new Date("2026-07-14T12:00:00.000Z");
    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, previous, completedAt);

    expect(result.hasHistory).toBe(true);
    expect(result.volumeChangePercent).toBe(-20);
  });

  it("passa a janela correta (início/fim) pra buscar os logs desta sessão e da anterior — mesmo Workout apenas", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const previous = new Date("2026-07-21T08:00:00.000Z");
    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    await workoutSummaryService.buildCompletionSummary(WORKOUT, previous, completedAt);

    // janela desta sessão: [previous, completedAt] (previous é mais recente que completedAt - 6h)
    expect(mockedRepo.findSetLogsForWorkoutInWindow).toHaveBeenNthCalledWith(1, "workout-1", previous, completedAt);
    // janela da sessão anterior: [previous - 6h, previous] — SEMPRE do mesmo workoutId,
    // nunca comparando com outro Workout (outra sessão/letra).
    const prevWindowStart = new Date(previous.getTime() - 6 * 60 * 60 * 1000);
    expect(mockedRepo.findSetLogsForWorkoutInWindow).toHaveBeenNthCalledWith(2, "workout-1", prevWindowStart, previous);
  });

  it("usa o teto de 6h quando não há conclusão anterior recente o bastante", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([]);
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValue([]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    const expectedStart = new Date(completedAt.getTime() - 6 * 60 * 60 * 1000);
    expect(mockedRepo.findSetLogsForWorkoutInWindow).toHaveBeenCalledWith("workout-1", expectedStart, completedAt);
  });
});

describe("workoutSummaryService.buildCompletionSummary — duração aproximada", () => {
  it("null quando há 0 ou 1 série (não dá pra medir um intervalo)", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([log({ weightKg: 50 })]);
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.durationMinutes).toBeNull();
  });

  it("calcula a diferença em minutos entre a primeira e a última série desta sessão", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([
      log({ weightKg: 50, loggedAt: new Date("2026-07-21T12:00:00.000Z") }),
      log({ weightKg: 55, loggedAt: new Date("2026-07-21T12:25:00.000Z") }),
    ]);
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValue([]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.durationMinutes).toBe(25);
  });
});

describe("workoutSummaryService.buildCompletionSummary — PRs", () => {
  it("múltiplos PRs numa sessão são todos retornados (corte de exibição fica pro frontend)", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([
      log({ weightKg: 82.5, exerciseId: "supino", exerciseName: "Supino Reto" }),
      log({ weightKg: 60, exerciseId: "remada", exerciseName: "Remada Curvada" }),
      log({ weightKg: 40, exerciseId: "rosca", exerciseName: "Rosca Direta" }),
    ]);
    mockedRepo.findHistoricalSetLogsForExercise
      .mockResolvedValueOnce([{ weightKg: 80 }]) // supino: PR (82.5 > 80)
      .mockResolvedValueOnce([{ weightKg: 65 }]) // remada: não é PR (60 < 65)
      .mockResolvedValueOnce([{ weightKg: 35 }]); // rosca: PR (40 > 35)

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.personalRecords).toHaveLength(2);
    expect(result.personalRecords.map((pr) => pr.exerciseId).sort()).toEqual(["rosca", "supino"].sort());
  });

  it("nenhum PR quando nenhum exercício supera o histórico", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([log({ weightKg: 50, exerciseId: "supino" })]);
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([{ weightKg: 55 }]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.personalRecords).toEqual([]);
  });

  it("exercício sem NENHUM histórico não conta como PR (evita spam em exercício novo do programa)", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([log({ weightKg: 20, exerciseId: "exercicio-novo" })]);
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.personalRecords).toEqual([]);
  });

  it("busca o histórico de PR com a fronteira no início da janela desta sessão (estritamente anterior)", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow
      .mockResolvedValueOnce([log({ weightKg: 20, exerciseId: "supino" })]) // esta sessão
      .mockResolvedValueOnce([]); // sessão anterior
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([]);

    const previous = new Date("2026-07-21T08:00:00.000Z");
    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    await workoutSummaryService.buildCompletionSummary(WORKOUT, previous, completedAt);

    expect(mockedRepo.findHistoricalSetLogsForExercise).toHaveBeenCalledWith("aluno-1", "supino", previous);
  });
});

describe("workoutSummaryService.buildCompletionSummary — streak de dias", () => {
  it("0 quando não há nenhuma série logada nos últimos 90 dias", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([]);
    mockedRepo.findSetLogsForAlunoSince.mockResolvedValueOnce([]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.streakDays).toBe(0);
  });

  it("conta dias consecutivos até hoje (inclusive) quando há atividade hoje e ontem", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([]);
    mockedRepo.findSetLogsForAlunoSince.mockResolvedValueOnce([
      { loggedAt: new Date("2026-07-21T09:00:00.000Z") }, // hoje
      { loggedAt: new Date("2026-07-20T09:00:00.000Z") }, // ontem
    ]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.streakDays).toBe(2);
  });

  it("continua contando a partir de ontem quando hoje ainda não tem série (não zera por o dia não ter acabado)", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([]);
    mockedRepo.findSetLogsForAlunoSince.mockResolvedValueOnce([
      { loggedAt: new Date("2026-07-20T09:00:00.000Z") }, // ontem
      { loggedAt: new Date("2026-07-19T09:00:00.000Z") }, // anteontem
    ]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.streakDays).toBe(2);
  });

  it("0 quando a única atividade foi anteontem e nada ontem/hoje", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([]);
    mockedRepo.findSetLogsForAlunoSince.mockResolvedValueOnce([
      { loggedAt: new Date("2026-07-19T09:00:00.000Z") },
    ]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.streakDays).toBe(0);
  });
});

describe("workoutSummaryService.detectPersonalRecord", () => {
  it("não é PR na primeira vez que o aluno registra o exercício (sem histórico)", async () => {
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([]);

    const result = await workoutSummaryService.detectPersonalRecord(
      "aluno-1",
      "exercicio-novo",
      50,
      new Date("2026-07-21T12:30:00.000Z")
    );

    expect(result).toEqual({ isPersonalRecord: false, previousBest: null });
  });

  it("é PR quando o peso supera o maior peso histórico", async () => {
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([{ weightKg: 70 }, { weightKg: 65 }]);

    const result = await workoutSummaryService.detectPersonalRecord(
      "aluno-1",
      "supino",
      75,
      new Date("2026-07-21T12:30:00.000Z")
    );

    expect(result).toEqual({ isPersonalRecord: true, previousBest: 70 });
  });

  it("não é PR quando o peso é igual ou menor que o histórico", async () => {
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([{ weightKg: 70 }]);

    const result = await workoutSummaryService.detectPersonalRecord(
      "aluno-1",
      "supino",
      70,
      new Date("2026-07-21T12:30:00.000Z")
    );

    expect(result).toEqual({ isPersonalRecord: false, previousBest: 70 });
  });

  it("reps não entram na comparação — só o peso importa", async () => {
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([{ weightKg: 60 }]);

    const result = await workoutSummaryService.detectPersonalRecord(
      "aluno-1",
      "supino",
      65,
      new Date("2026-07-21T12:30:00.000Z")
    );

    expect(result.isPersonalRecord).toBe(true);
  });
});
