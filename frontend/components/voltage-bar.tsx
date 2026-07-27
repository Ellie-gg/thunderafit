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
  ADMIN: "var(--role-admin)",
};

// Fase 65: teto defensivo — em todo uso real (séries, exercícios), `total`
// nunca passa de ~20; mas `limiteAlunos` do plano Plus é 1_000_000
// ("ilimitado"), e sem teto isso tentava montar 1 milhão de `<div>`,
// travando a tela. Acima do teto, cada segmento passa a valer mais de uma
// unidade — a proporção preenchida continua correta, só a granularidade
// visual muda.
const MAX_SEGMENTS = 100;

/**
 * Elemento de assinatura do design system ThunderaFit: uma barra segmentada
 * que "carrega" como um relâmpago acumulando energia, em vez de uma barra de
 * progresso contínua genérica. Reutilizada em 3 escalas: dashboard (resumo),
 * lista de treinos (por treino) e execução (por exercício).
 */
export function VoltageBar({ total, filled, className, role }: VoltageBarProps) {
  const segmentCount = Math.min(Math.max(total, 1), MAX_SEGMENTS);
  const filledSegments = Math.round((filled / Math.max(total, 1)) * segmentCount);
  const segments = Array.from({ length: segmentCount }, (_, i) => i < filledSegments);
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
