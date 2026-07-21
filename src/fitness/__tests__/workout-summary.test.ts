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
});

describe("workoutSummaryService.buildCompletionSummary", () => {
  it("primeira conclusão do Workout (sem lastCompletedAt anterior) → FIRST_TIME", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([log({ weightKg: 50, repsDone: 10 })]);
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([]);

    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, null, completedAt);

    expect(result.comparison).toEqual({ type: "FIRST_TIME", previousVolumeKg: null, percentChange: null });
    expect(result.volumeKg).toBe(500);
    expect(result.setsLogged).toBe(1);
  });

  it("sessão anterior com volume 0 também vira FIRST_TIME (não divide por zero)", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow
      .mockResolvedValueOnce([log({ weightKg: 50, repsDone: 10 })]) // esta sessão
      .mockResolvedValueOnce([]); // sessão anterior, sem logs
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([]);

    const previous = new Date("2026-07-14T12:00:00.000Z");
    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, previous, completedAt);

    expect(result.comparison).toEqual({ type: "FIRST_TIME", previousVolumeKg: 0, percentChange: null });
  });

  it("percentChange positivo quando o volume desta sessão é maior que o da anterior", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow
      .mockResolvedValueOnce([log({ weightKg: 60, repsDone: 10 })]) // esta sessão: 600
      .mockResolvedValueOnce([log({ weightKg: 50, repsDone: 10 })]); // anterior: 500
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([{ weightKg: 55 }]);

    const previous = new Date("2026-07-14T12:00:00.000Z");
    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, previous, completedAt);

    expect(result.comparison.type).toBe("PERCENT");
    expect((result.comparison as any).percentChange).toBe(20);
  });

  it("percentChange negativo quando o volume desta sessão é menor que o da anterior", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow
      .mockResolvedValueOnce([log({ weightKg: 40, repsDone: 10 })]) // esta sessão: 400
      .mockResolvedValueOnce([log({ weightKg: 50, repsDone: 10 })]); // anterior: 500
    mockedRepo.findHistoricalSetLogsForExercise.mockResolvedValueOnce([{ weightKg: 55 }]);

    const previous = new Date("2026-07-14T12:00:00.000Z");
    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    const result = await workoutSummaryService.buildCompletionSummary(WORKOUT, previous, completedAt);

    expect(result.comparison.type).toBe("PERCENT");
    expect((result.comparison as any).percentChange).toBe(-20);
  });

  it("passa a janela correta (início/fim) pra buscar os logs desta sessão e da anterior", async () => {
    mockedRepo.findSetLogsForWorkoutInWindow.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const previous = new Date("2026-07-21T08:00:00.000Z");
    const completedAt = new Date("2026-07-21T12:30:00.000Z");
    await workoutSummaryService.buildCompletionSummary(WORKOUT, previous, completedAt);

    // janela desta sessão: [previous, completedAt] (previous é mais recente que completedAt - 6h)
    expect(mockedRepo.findSetLogsForWorkoutInWindow).toHaveBeenNthCalledWith(1, "workout-1", previous, completedAt);
    // janela da sessão anterior: [previous - 6h, previous]
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
