import { render, screen } from "@testing-library/react";
import { PostWorkoutSummaryCard } from "@/components/post-workout-summary-card";
import type { WorkoutCompletionSummary } from "@/lib/types";

const baseSummary: WorkoutCompletionSummary = {
  workoutId: "w-1",
  workoutName: "Peito e Tríceps",
  workoutLetter: "B",
  completedAt: "2026-07-21T18:00:00.000Z",
  durationMinutes: 45,
  volumeKg: 4820.5,
  setsLogged: 18,
  hasHistory: true,
  previousVolumeKg: 4300,
  volumeChangePercent: 12.1,
  streakDays: 3,
  personalRecords: [],
};

describe("PostWorkoutSummaryCard", () => {
  it("mostra a contagem de séries como número principal e o rótulo do treino", () => {
    render(<PostWorkoutSummaryCard summary={baseSummary} />);
    expect(screen.getByText("Treino B")).toBeInTheDocument();
    expect(screen.getByText("Peito e Tríceps")).toBeInTheDocument();
    expect(screen.getByText("Séries registradas")).toBeInTheDocument();
    expect(screen.getByText("18")).toBeInTheDocument();
  });

  it("mostra as 3 métricas secundárias: duração, peso levantado hoje e dias seguidos", () => {
    render(<PostWorkoutSummaryCard summary={baseSummary} />);
    expect(screen.getByText("Duração")).toBeInTheDocument();
    expect(screen.getByText("45 min")).toBeInTheDocument();
    expect(screen.getByText("Peso levantado Hoje")).toBeInTheDocument();
    expect(screen.getByText(/4\.820,5 kg/)).toBeInTheDocument();
    expect(screen.getByText("Dias seguidos")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("mostra travessão na duração quando não há série suficiente pra medir intervalo", () => {
    const summary: WorkoutCompletionSummary = { ...baseSummary, durationMinutes: null };
    render(<PostWorkoutSummaryCard summary={summary} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("mostra comparação percentual positiva com seta pra cima", () => {
    render(<PostWorkoutSummaryCard summary={baseSummary} />);
    expect(screen.getByText(/▲ 12.1% de peso vs\. treino anterior/)).toBeInTheDocument();
  });

  it("mostra comparação percentual negativa com seta pra baixo e valor absoluto", () => {
    const summary: WorkoutCompletionSummary = {
      ...baseSummary,
      previousVolumeKg: 5000,
      volumeChangePercent: -8.5,
    };
    render(<PostWorkoutSummaryCard summary={summary} />);
    expect(screen.getByText(/▼ 8.5% de peso vs\. treino anterior/)).toBeInTheDocument();
  });

  it("mostra copy de 'primeira vez' quando não há sessão anterior pra comparar", () => {
    const summary: WorkoutCompletionSummary = {
      ...baseSummary,
      hasHistory: false,
      previousVolumeKg: null,
      volumeChangePercent: null,
    };
    render(<PostWorkoutSummaryCard summary={summary} />);
    expect(screen.getByText(/Primeiro treino de Peito e Tríceps registrado/)).toBeInTheDocument();
  });

  it("não renderiza selos quando não há PRs", () => {
    render(<PostWorkoutSummaryCard summary={baseSummary} />);
    expect(screen.queryByText(/🏆/)).not.toBeInTheDocument();
  });

  it("mostra até 2 selos de PR sem overflow quando há exatamente 2", () => {
    const summary: WorkoutCompletionSummary = {
      ...baseSummary,
      personalRecords: [
        { exerciseId: "e1", exerciseName: "Supino Reto", weightKg: 82.5, previousBestKg: 80 },
        { exerciseId: "e2", exerciseName: "Remada Curvada", weightKg: 60, previousBestKg: 55 },
      ],
    };
    render(<PostWorkoutSummaryCard summary={summary} />);
    expect(screen.getByText(/Supino Reto 82.5kg/)).toBeInTheDocument();
    expect(screen.getByText(/Remada Curvada 60kg/)).toBeInTheDocument();
    expect(screen.queryByText(/recorde/)).not.toBeInTheDocument();
  });

  it("corta em 2 selos + overflow '+N recordes' quando há mais de 2 PRs", () => {
    const summary: WorkoutCompletionSummary = {
      ...baseSummary,
      personalRecords: [
        { exerciseId: "e1", exerciseName: "Supino Reto", weightKg: 82.5, previousBestKg: 80 },
        { exerciseId: "e2", exerciseName: "Remada Curvada", weightKg: 60, previousBestKg: 55 },
        { exerciseId: "e3", exerciseName: "Rosca Direta", weightKg: 20, previousBestKg: 18 },
      ],
    };
    render(<PostWorkoutSummaryCard summary={summary} />);
    expect(screen.getByText(/Supino Reto 82.5kg/)).toBeInTheDocument();
    expect(screen.getByText(/Remada Curvada 60kg/)).toBeInTheDocument();
    expect(screen.queryByText(/Rosca Direta/)).not.toBeInTheDocument();
    expect(screen.getByText("+1 recorde")).toBeInTheDocument();
  });
});
