import { listRelations, createRelation, lookupAlunoByEmail } from "@/lib/api/relations";

function mockResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("lib/api/relations", () => {
  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it("listRelations chama GET /api/relations", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200, { relations: [] }));
    await listRelations();
    expect(global.fetch).toHaveBeenCalledWith("/api/relations", expect.objectContaining({ method: "GET" }));
  });

  it("createRelation envia alunoId no corpo via POST", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(201, { relation: {} }));
    await createRelation("aluno-123");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/relations",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ alunoId: "aluno-123" }) })
    );
  });

  it("lookupAlunoByEmail codifica o e-mail na query string", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse(200, { user: { id: "1", email: "a+b@x.com", role: "ALUNO" } })
    );
    await lookupAlunoByEmail("a+b@x.com");
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/users/lookup?email=a%2Bb%40x.com",
      expect.objectContaining({ method: "GET" })
    );
  });
});
