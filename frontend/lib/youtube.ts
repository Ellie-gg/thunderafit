export function toYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:v=|youtu\.be\/)([\w-]{11})/);
  if (!match) return null;
  return `https://www.youtube.com/embed/${match[1]}`;
}
