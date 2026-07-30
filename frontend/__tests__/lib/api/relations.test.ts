import { listRelations } from "@/lib/api/relations";

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
});
