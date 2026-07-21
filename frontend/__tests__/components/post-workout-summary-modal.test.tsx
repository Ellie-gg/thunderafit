import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toPng } from "html-to-image";
import { PostWorkoutSummaryModal } from "@/components/post-workout-summary-modal";
import type { WorkoutCompletionSummary } from "@/lib/types";

jest.mock("html-to-image", () => ({
  toPng: jest.fn(),
}));

const mockedToPng = toPng as jest.Mock;

const summary: WorkoutCompletionSummary = {
  workoutId: "w-1",
  workoutName: "Treino B",
  workoutLetter: "B",
  completedAt: "2026-07-21T18:00:00.000Z",
  volumeKg: 4820.5,
  setsLogged: 18,
  comparison: { type: "PERCENT", previousVolumeKg: 4300, percentChange: 12.1 },
  personalRecords: [],
};

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

beforeEach(() => {
  mockedToPng.mockReset();
  mockedToPng.mockResolvedValue(TINY_PNG_DATA_URL);
  // jsdom não implementa fetch para data: URLs — mock global só pra este
  // teste, já que o handler real usa fetch(dataUrl).blob() pra converter a
  // PNG data URL do html-to-image num Blob.
  global.fetch = jest.fn().mockResolvedValue({
    blob: () => Promise.resolve(new Blob(["fake-png-bytes"], { type: "image/png" })),
  }) as unknown as typeof fetch;
  // jsdom não implementa a Object URL API.
  URL.createObjectURL = jest.fn().mockReturnValue("blob:fake-url");
  URL.revokeObjectURL = jest.fn();
  delete (navigator as Partial<Navigator>).share;
  delete (navigator as Partial<Navigator>).canShare;
});

describe("PostWorkoutSummaryModal", () => {
  it("esconde o botão Compartilhar quando navigator.share não existe", () => {
    render(<PostWorkoutSummaryModal summary={summary} onClose={jest.fn()} />);
    expect(screen.queryByRole("button", { name: /compartilhar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar imagem/i })).toBeInTheDocument();
  });

  it("mostra o botão Compartilhar quando navigator.share existe", () => {
    (navigator as Partial<Navigator>).share = jest.fn();
    render(<PostWorkoutSummaryModal summary={summary} onClose={jest.fn()} />);
    expect(screen.getByRole("button", { name: /compartilhar/i })).toBeInTheDocument();
  });

  it("aciona toPng ao clicar em Baixar imagem", async () => {
    const user = userEvent.setup();
    render(<PostWorkoutSummaryModal summary={summary} onClose={jest.fn()} />);

    await user.click(screen.getByRole("button", { name: /baixar imagem/i }));

    await waitFor(() => expect(mockedToPng).toHaveBeenCalledTimes(1));
  });

  it("chama onClose ao clicar em Fechar", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    render(<PostWorkoutSummaryModal summary={summary} onClose={onClose} />);

    await user.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
