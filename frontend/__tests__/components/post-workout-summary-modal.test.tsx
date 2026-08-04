import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NextIntlClientProvider } from "next-intl";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toPng } from "html-to-image";
import { Capacitor } from "@capacitor/core";
import { Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { PostWorkoutSummaryModal } from "@/components/post-workout-summary-modal";
import { setSessionRpe } from "@/lib/api/workouts";
import ptMessages from "@/messages/pt.json";
import type { WorkoutCompletionSummary } from "@/lib/types";

jest.mock("html-to-image", () => ({
  toPng: jest.fn(),
}));

jest.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: jest.fn() },
}));

jest.mock("@capacitor/filesystem", () => ({
  Filesystem: { writeFile: jest.fn() },
  Directory: { Cache: "CACHE" },
}));

jest.mock("@capacitor/share", () => ({
  Share: { share: jest.fn() },
}));

// Fase 112: RpeQuickPicker (renderizado dentro do modal quando `sessionLogId`
// existe) chama isto via useMutation — mockado pra não bater na rede real.
jest.mock("@/lib/api/workouts", () => ({
  setSessionRpe: jest.fn(),
}));

const mockedToPng = toPng as jest.Mock;
const mockedIsNativePlatform = Capacitor.isNativePlatform as jest.Mock;
const mockedWriteFile = Filesystem.writeFile as jest.Mock;
const mockedShare = Share.share as jest.Mock;
const mockedSetSessionRpe = setSessionRpe as jest.Mock;

const summary: WorkoutCompletionSummary = {
  workoutId: "w-1",
  workoutName: "Treino B",
  workoutLetter: "B",
  completedAt: "2026-07-21T18:00:00.000Z",
  volumeKg: 4820.5,
  setsLogged: 18,
  hasHistory: true,
  previousVolumeKg: 4300,
  volumeChangePercent: 12.1,
  streakDays: 3,
  personalRecords: [],
};

function renderModal(onClose: () => void, summaryOverride: WorkoutCompletionSummary = summary) {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <PostWorkoutSummaryModal
          summary={summaryOverride}
          alunoName="João"
          durationSeconds={754}
          onClose={onClose}
        />
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

const TINY_PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

beforeEach(() => {
  mockedToPng.mockReset();
  mockedToPng.mockResolvedValue(TINY_PNG_DATA_URL);
  mockedIsNativePlatform.mockReset();
  mockedIsNativePlatform.mockReturnValue(false);
  mockedWriteFile.mockReset();
  mockedWriteFile.mockResolvedValue({ uri: "file:///cache/thunderafit-treino-B.png" });
  mockedShare.mockReset();
  mockedShare.mockResolvedValue({});
  mockedSetSessionRpe.mockReset();
  mockedSetSessionRpe.mockResolvedValue({ sessionLog: { id: "log-1", rpe: 6 } });
  // jsdom não implementa fetch para data: URLs — mock global só pra este
  // teste, já que o handler real usa fetch(dataUrl).blob() pra converter a
  // PNG data URL do html-to-image num Blob (caminho web/download).
  global.fetch = jest.fn().mockResolvedValue({
    blob: () => Promise.resolve(new Blob(["fake-png-bytes"], { type: "image/png" })),
  }) as unknown as typeof fetch;
  // jsdom não implementa a Object URL API.
  URL.createObjectURL = jest.fn().mockReturnValue("blob:fake-url");
  URL.revokeObjectURL = jest.fn();
  delete (navigator as Partial<Navigator>).share;
  delete (navigator as Partial<Navigator>).canShare;
});

describe("PostWorkoutSummaryModal — fora do Capacitor (web)", () => {
  it("esconde o botão Compartilhar quando navigator.share não existe", () => {
    renderModal(jest.fn());
    expect(screen.queryByRole("button", { name: /compartilhar/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /baixar imagem/i })).toBeInTheDocument();
  });

  it("mostra o botão Compartilhar quando navigator.share existe", () => {
    (navigator as Partial<Navigator>).share = jest.fn();
    renderModal(jest.fn());
    expect(screen.getByRole("button", { name: /compartilhar/i })).toBeInTheDocument();
  });

  it("aciona toPng ao clicar em Baixar imagem", async () => {
    const user = userEvent.setup();
    renderModal(jest.fn());

    await user.click(screen.getByRole("button", { name: /baixar imagem/i }));

    await waitFor(() => expect(mockedToPng).toHaveBeenCalledTimes(1));
  });

  it("chama onClose ao clicar em Fechar", async () => {
    const onClose = jest.fn();
    const user = userEvent.setup();
    renderModal(onClose);

    await user.click(screen.getByRole("button", { name: /fechar/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe("PostWorkoutSummaryModal — dentro do Capacitor (nativo)", () => {
  beforeEach(() => {
    mockedIsNativePlatform.mockReturnValue(true);
  });

  it("mostra o botão Compartilhar mesmo sem Web Share API, por estar no Capacitor", () => {
    renderModal(jest.fn());
    expect(screen.getByRole("button", { name: /compartilhar/i })).toBeInTheDocument();
  });

  it("grava o PNG via Filesystem e abre o share sheet nativo com o arquivo", async () => {
    const user = userEvent.setup();
    renderModal(jest.fn());

    await user.click(screen.getByRole("button", { name: /compartilhar/i }));

    await waitFor(() => expect(mockedWriteFile).toHaveBeenCalledTimes(1));
    expect(mockedWriteFile.mock.calls[0][0]).toMatchObject({ directory: "CACHE" });
    await waitFor(() =>
      expect(mockedShare).toHaveBeenCalledWith({
        files: ["file:///cache/thunderafit-treino-B.png"],
        dialogTitle: "Compartilhar treino",
      })
    );
  });

  it("cai pro download quando o share nativo falha, mostrando aviso amigável", async () => {
    mockedShare.mockRejectedValue(new Error("falha nativa"));
    const user = userEvent.setup();
    renderModal(jest.fn());

    await user.click(screen.getByRole("button", { name: /compartilhar/i }));

    await waitFor(() =>
      expect(screen.getByText(/Não foi possível compartilhar direto/)).toBeInTheDocument()
    );
    // handleDownload também roda toPng — soma 2 chamadas (a original + o fallback).
    expect(mockedToPng).toHaveBeenCalledTimes(2);
  });
});

describe("PostWorkoutSummaryModal — RPE opcional (Fase 112)", () => {
  it("não mostra a pergunta de RPE quando o summary não tem sessionLogId (client antigo)", () => {
    renderModal(jest.fn());
    expect(screen.queryByText(/Quão difícil foi esse treino/i)).not.toBeInTheDocument();
  });

  it("mostra a pergunta de RPE e grava a resposta ao clicar num nível", async () => {
    const user = userEvent.setup();
    renderModal(jest.fn(), { ...summary, sessionLogId: "log-1" });

    expect(screen.getByText(/Quão difícil foi esse treino/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Moderado/i }));

    await waitFor(() => expect(mockedSetSessionRpe).toHaveBeenCalledWith("log-1", 6));
    expect(await screen.findByText(/Registrado, obrigado/i)).toBeInTheDocument();
  });
});
