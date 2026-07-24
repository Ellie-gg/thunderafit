import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { ExerciseExecutionCard } from "@/components/exercise-execution-card";
import { createSetLog } from "@/lib/api/workouts";
import { ApiError } from "@/lib/api/client";
import ptMessages from "@/messages/pt.json";
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
  notes: null,
  exercise: {
    id: "ex-1",
    name: "Supino Reto",
    muscleGroup: "Peito",
    equipment: "Barra",
    mediaUrl: null,
    mediaType: "YOUTUBE",
    description: "Deite-se no banco...",
    difficultyLevel: "INTERMEDIARIO",
    isFeatured: false,
    createdAt: "",
    updatedAt: "",
  },
  setLogs: [],
};

function renderCard(workoutExercise: WorkoutExercise, sessionBoundary: string | null = null) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <QueryClientProvider client={queryClient}>
        <ExerciseExecutionCard
          workoutId="w-1"
          workoutExercise={workoutExercise}
          sessionBoundary={sessionBoundary}
        />
      </QueryClientProvider>
    </NextIntlClientProvider>
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

  it("limita reps a 2 dígitos e pula o foco pro campo de carga (Fase 38)", async () => {
    const user = userEvent.setup();
    renderCard(baseWorkoutExercise);

    const [repsInput, weightInput] = screen.getAllByRole("spinbutton");
    await user.type(repsInput, "100");

    expect(repsInput).toHaveValue(10);
    expect(weightInput).toHaveFocus();
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

describe("ExerciseExecutionCard — corte de sessão por Workout.lastCompletedAt (Fase 40)", () => {
  // Bug real corrigido: o mesmo Workout/WorkoutExercise é reaberto toda
  // semana (nunca recriado), e `setLogs` sempre trouxe o histórico INTEIRO
  // — sem o corte por `sessionBoundary`, depois da 1ª semana completa o
  // formulário ficava escondido pra sempre (setLogs.length já batia o
  // `sets` prescrito com séries de semanas passadas).
  const previousCycleLogs = [
    { id: "l1", workoutExerciseId: "we-1", setNumber: 1, repsDone: 10, weightKg: 60, loggedAt: "2026-07-10T12:00:00.000Z" },
    { id: "l2", workoutExerciseId: "we-1", setNumber: 2, repsDone: 9, weightKg: 60, loggedAt: "2026-07-10T12:05:00.000Z" },
    { id: "l3", workoutExerciseId: "we-1", setNumber: 3, repsDone: 8, weightKg: 65, loggedAt: "2026-07-10T12:10:00.000Z" },
  ];
  const boundary = "2026-07-10T12:30:00.000Z"; // lastCompletedAt da semana passada

  it("séries de um ciclo anterior (antes do boundary) NÃO contam pra esta sessão — formulário continua visível", () => {
    const workoutExercise: WorkoutExercise = { ...baseWorkoutExercise, setLogs: previousCycleLogs };
    renderCard(workoutExercise, boundary);

    expect(screen.getByText("0/3 séries")).toBeInTheDocument();
    expect(screen.getByText("Reps (série 1)")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /registrar/i })).toBeInTheDocument();
  });

  it("sem sessionBoundary (1ª vez), o histórico inteiro conta normalmente (comportamento antigo preservado)", () => {
    const workoutExercise: WorkoutExercise = { ...baseWorkoutExercise, setLogs: previousCycleLogs };
    renderCard(workoutExercise, null);

    expect(screen.getByText("3/3 séries")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /registrar/i })).not.toBeInTheDocument();
  });

  it("séries logadas DEPOIS do boundary contam normalmente pra esta sessão", () => {
    const workoutExercise: WorkoutExercise = {
      ...baseWorkoutExercise,
      setLogs: [
        ...previousCycleLogs,
        { id: "l4", workoutExerciseId: "we-1", setNumber: 1, repsDone: 12, weightKg: 62.5, loggedAt: "2026-07-17T12:00:00.000Z" },
      ],
    };
    renderCard(workoutExercise, boundary);

    expect(screen.getByText("1/3 séries")).toBeInTheDocument();
    expect(screen.getByText("Reps (série 2)")).toBeInTheDocument();
  });

  it("mostra a referência 'Última vez' com o valor do ciclo anterior pro mesmo número de série", () => {
    const workoutExercise: WorkoutExercise = { ...baseWorkoutExercise, setLogs: previousCycleLogs };
    renderCard(workoutExercise, boundary);

    expect(screen.getByText("Última vez: 10 reps × 60kg")).toBeInTheDocument();
  });

  it("não mostra referência quando não há registro anterior pra esse número de série", () => {
    renderCard(baseWorkoutExercise, boundary);
    expect(screen.queryByText(/Última vez/)).not.toBeInTheDocument();
  });
});

describe("ExerciseExecutionCard — mídia do exercício (Fase 32)", () => {
  it("renderiza um <video> nativo quando mediaType é VIDEO", () => {
    const withVideo: WorkoutExercise = {
      ...baseWorkoutExercise,
      exercise: {
        ...baseWorkoutExercise.exercise!,
        mediaType: "VIDEO",
        mediaUrl: "https://storage.googleapis.com/bucket/exercises/supino.mp4",
      },
    };
    const { container } = renderCard(withVideo);
    const video = container.querySelector("video");
    expect(video).toBeInTheDocument();
    expect(video).toHaveAttribute("src", "https://storage.googleapis.com/bucket/exercises/supino.mp4");
  });

  it("renderiza um <img> quando mediaType é GIF", () => {
    const withGif: WorkoutExercise = {
      ...baseWorkoutExercise,
      exercise: {
        ...baseWorkoutExercise.exercise!,
        mediaType: "GIF",
        mediaUrl: "https://storage.googleapis.com/bucket/exercises/supino.gif",
      },
    };
    renderCard(withGif);
    const img = screen.getByAltText("Demonstração de Supino Reto");
    expect(img).toHaveAttribute("src", "https://storage.googleapis.com/bucket/exercises/supino.gif");
  });

  it("mantém o comportamento de link do YouTube quando mediaType é YOUTUBE e a URL não é embedável", () => {
    const withSearchUrl: WorkoutExercise = {
      ...baseWorkoutExercise,
      exercise: {
        ...baseWorkoutExercise.exercise!,
        mediaType: "YOUTUBE",
        mediaUrl: "https://www.youtube.com/results?search_query=supino",
      },
    };
    renderCard(withSearchUrl);
    expect(screen.getByText("▶ Ver vídeo de demonstração no YouTube")).toBeInTheDocument();
  });
});
