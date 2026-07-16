import type { Role } from "../types";

export function dashboardPathForRole(role: Role): string {
  if (role === "PERSONAL") return "/personal/dashboard";
  if (role === "NUTRICIONISTA") return "/nutricionista/dashboard";
  // "/nimbus" é o path não óbvio do painel admin (Fase 14, Bloco 4) — ver
  // rationale no STATUS.md. Checar ADMIN explicitamente aqui evita que caia
  // no fallback de ALUNO por engano.
  if (role === "ADMIN") return "/nimbus/dashboard";
  return "/dashboard";
}
