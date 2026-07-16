import type { Role } from "../types";

export function dashboardPathForRole(role: Role): string {
  if (role === "PERSONAL") return "/personal/dashboard";
  if (role === "NUTRICIONISTA") return "/nutricionista/dashboard";
  return "/dashboard";
}
