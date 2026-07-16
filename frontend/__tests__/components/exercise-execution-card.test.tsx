import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ExerciseExecutionCard } from "@/components/exercise-execution-card";
import { createSetLog } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import type { WorkoutExercise } from "@/lib/types";

jest.mock("@/lib/api/workouts", () => ({
  createSetLog: jest.fn(),
}));

const mockedCreateSetLog = createSetLog as jest.Mock;

const baseWorkoutExercise: WorkoutExercise = {
  id: "we-1",
  workoutId: "w-1",
  exerciseId: "ex-1",
  sets: 3,
  repsRange: "8-12",
  restSeconds: 60,
  order: 1,
  exercise: {
    id: "ex-1",
    name: "Supino Reto",
    muscleGroup: "Peito",
    equipment: "Barra",
    mediaUrl: null,
    description: "Deite-se no banco...",
    createdAt: "",
    updatedAt: "",
  },
  setLogs: [],
};

function renderCard(workoutExercise: WorkoutExercise) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <ExerciseExecutionCard workoutId="w-1" workoutExercise={workoutExercise} />
    </QueryClientProvider>
  );
}

beforeEach(() => {
  mockedCreateSetLog.mockReset();
});

describe("ExerciseExecutionCard — formulário de registro de série", () => {
  it("mostra 0/3 séries e o rótulo da próxima série a registrar", () => {
    renderCard(baseWorkoutExercise);
    expect(screen.getByText("0/3 séries")).toBeInTheDocument();
    expect(screen.getByText("Reps (série 1)")).toBeInTheDocument();
  });

  it("envia setNumber/repsDone/weightKg corretos e invalida a query em sucesso", async () => {
    mockedCreateSetLog.mockResolvedValue({
      setLog: { id: "log-1", workoutExerciseId: "we-1", setNumber: 1, repsDone: 10, weightKg: 60, loggedAt: "" },
    });
    const user = userEvent.setup();
    renderCard(baseWorkoutExercise);

    const [repsInput, weightInput] = screen.getAllByRole("spinbutton");
    await user.type(repsInput, "10");
    await user.type(weightInput, "60");
    await user.click(screen.getByRole("button", { name: /registrar/i }));

    await waitFor(() =>
      expect(mockedCreateSetLog).toHaveBeenCalledWith("w-1", "we-1", {
        setNumber: 1,
        repsDone: 10,
        weightKg: 60,
      })
    );
  });

  it("mostra a mensagem de erro da API quando o registro falha", async () => {
    mockedCreateSetLog.mockRejectedValue(new ApiError(400, "Exercício não pertence ao treino informado."));
    const user = userEvent.setup();
    renderCard(baseWorkoutExercise);

    const [repsInput, weightInput] = screen.getAllByRole("spinbutton");
    await user.type(repsInput, "10");
    await user.type(weightInput, "60");
    await user.click(screen.getByRole("button", { name: /registrar/i }));

    expect(
      await screen.findByText("Exercício não pertence ao treino informado.")
    ).toBeInTheDocument();
  });

  it("esconde o formulário quando todas as séries já foram registradas", () => {
    const complete: WorkoutExercise = {
      ...baseWorkoutExercise,
      setLogs: [
        { id: "l1", workoutExerciseId: "we-1", setNumber: 1, repsDone: 10, weightKg: 60, loggedAt: "" },
        { id: "l2", workoutExerciseId: "we-1", setNumber: 2, repsDone: 9, weightKg: 60, loggedAt: "" },
        { id: "l3", workoutExerciseId: "we-1", setNumber: 3, repsDone: 8, weightKg: 65, loggedAt: "" },
      ],
    };
    renderCard(complete);
    expect(screen.getByText("3/3 séries")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /registrar/i })).not.toBeInTheDocument();
  });
});
