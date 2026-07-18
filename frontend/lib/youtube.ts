export function getYoutubeVideoId(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  return match ? match[1] : null;
}

export function toYoutubeEmbedUrl(url: string): string | null {
  const id = getYoutubeVideoId(url);
  // youtube-nocookie.com (Fase 25): mesmo player, mas não seta cookies de
  // rastreamento de terceiros até o clique em play — o domínio principal
  // carrega scripts extras de consentimento/analytics que pesam na primeira
  // renderização do iframe, mesmo estando ocioso.
  return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
}

export function toYoutubeThumbnail(url: string): string | null {
  const id = getYoutubeVideoId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}
