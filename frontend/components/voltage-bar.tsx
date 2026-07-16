import { cn } from "@/lib/utils";
import type { Role } from "@/lib/types";

interface VoltageBarProps {
  total: number;
  filled: number;
  className?: string;
  /** Fase 12 (Item 2): tinge os segmentos preenchidos com o acento do papel
   * em vez do dourado padrão — sutil, só nesta barra, não repinta o app. */
  role?: Role;
}

const ROLE_ACCENT_VAR: Record<Role, string> = {
  PERSONAL: "var(--role-personal)",
  ALUNO: "var(--role-aluno)",
  NUTRICIONISTA: "var(--role-nutricionista)",
};

/**
 * Elemento de assinatura do design system ThunderaFit: uma barra segmentada
 * que "carrega" como um relâmpago acumulando energia, em vez de uma barra de
 * progresso contínua genérica. Reutilizada em 3 escalas: dashboard (resumo),
 * lista de treinos (por treino) e execução (por exercício).
 */
export function VoltageBar({ total, filled, className, role }: VoltageBarProps) {
  const segments = Array.from({ length: Math.max(total, 1) }, (_, i) => i < filled);
  const style = role ? ({ "--voltage-accent": ROLE_ACCENT_VAR[role] } as React.CSSProperties) : undefined;

  return (
    <div
      className={cn("voltage-bar", className)}
      style={style}
      role="progressbar"
      aria-valuenow={filled}
      aria-valuemax={total}
    >
      {segments.map((isFilled, i) => (
        <div key={i} className="voltage-segment" data-filled={isFilled} />
      ))}
    </div>
  );
}
