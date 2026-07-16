import { apiFetch, onAuthExpired, ApiError } from "@/lib/api/client";

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("apiFetch", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("retorna os dados quando a resposta é 200", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, { workouts: [] }));

    const data = await apiFetch<{ workouts: unknown[] }>("/api/workouts");

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/workouts",
      expect.objectContaining({ method: "GET" })
    );
    expect(data).toEqual({ workouts: [] });
  });

  it("lança ApiError com status e mensagem do backend em erro de negócio (403)", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse(403, { error: "Limite de alunos atingido." })
    );

    await expect(apiFetch("/api/relations", { method: "POST", body: { alunoId: "x" } })).rejects.toMatchObject({
      status: 403,
      message: "Limite de alunos atingido.",
    });
  });

  it("em 401, tenta refresh e repete a chamada original com sucesso", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(mockResponse(401, { error: "Token de acesso inválido ou expirado." })) // chamada original
      .mockResolvedValueOnce(mockResponse(200, {})) // /api/auth/refresh
      .mockResolvedValueOnce(mockResponse(200, { workouts: [{ id: "w1" }] })); // retry

    const data = await apiFetch<{ workouts: unknown[] }>("/api/workouts");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/refresh");
    expect(data).toEqual({ workouts: [{ id: "w1" }] });
  });

  it("em 401 quando o refresh falha, dispara onAuthExpired e propaga o erro 401", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock
      .mockResolvedValueOnce(mockResponse(401, { error: "Token de acesso não fornecido." }))
      .mockResolvedValueOnce(mockResponse(401, { error: "Refresh token inválido ou expirado." }));

    const onExpired = jest.fn();
    onAuthExpired(onExpired);

    await expect(apiFetch("/api/workouts")).rejects.toMatchObject({ status: 401 });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("não tenta refresh quando auth:false, mesmo em 401", async () => {
    const fetchMock = global.fetch as jest.Mock;
    fetchMock.mockResolvedValueOnce(mockResponse(401, { error: "Credenciais inválidas." }));

    await expect(
      apiFetch("/api/auth/login", { method: "POST", body: {}, auth: false })
    ).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
