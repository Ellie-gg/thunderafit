import { cn } from "@/lib/utils";

interface VoltageBarProps {
  total: number;
  filled: number;
  className?: string;
}

/**
 * Elemento de assinatura do design system ThunderaFit: uma barra segmentada
 * que "carrega" como um relâmpago acumulando energia, em vez de uma barra de
 * progresso contínua genérica. Reutilizada em 3 escalas: dashboard (resumo),
 * lista de treinos (por treino) e execução (por exercício).
 */
export function VoltageBar({ total, filled, className }: VoltageBarProps) {
  const segments = Array.from({ length: Math.max(total, 1) }, (_, i) => i < filled);

  return (
    <div className={cn("voltage-bar", className)} role="progressbar" aria-valuenow={filled} aria-valuemax={total}>
      {segments.map((isFilled, i) => (
        <div key={i} className="voltage-segment" data-filled={isFilled} />
      ))}
    </div>
  );
}
