/**
 * Fase 35: marca vetorial do raio, substituindo o emoji ⚡ usado hoje em
 * `app-header.tsx` — necessário porque a captura de tela do card pós-treino
 * (via `html-to-image`) rasteriza emoji de forma inconsistente entre
 * navegadores/webviews, enquanto um SVG inline sempre renderiza igual.
 */
export function BoltMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="var(--accent)"
      className={className}
      aria-hidden
    >
      <path d="M13 2 3 14h7l-1 8 11-14h-7l1-6Z" />
    </svg>
  );
}
