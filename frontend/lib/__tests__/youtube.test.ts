import { getYoutubeVideoId, toYoutubeEmbedUrl } from "@/lib/youtube";

describe("getYoutubeVideoId", () => {
  it("extrai o id de uma URL watch?v=", () => {
    expect(getYoutubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("extrai o id de uma URL youtu.be", () => {
    expect(getYoutubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  // Curadoria 2026-07-31 (Pilates): Shorts não era reconhecido — não é
  // restrição do YouTube, só faltava esta regex.
  it("extrai o id de uma URL de YouTube Shorts", () => {
    expect(getYoutubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("devolve null pra uma URL que não é do YouTube", () => {
    expect(getYoutubeVideoId("https://exemplo.com/video")).toBeNull();
  });
});

describe("toYoutubeEmbedUrl", () => {
  it("monta a URL de embed a partir de um Shorts", () => {
    expect(toYoutubeEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
    );
  });
});
