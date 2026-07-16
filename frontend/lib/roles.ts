import type { Role } from "./types";

export interface RoleMeta {
  role: Role;
  label: string;
  /** Copy da tela inicial (Fase 12, Item 1) — contextualiza o que a pessoa vai fazer. */
  tagline: string;
  accentVar: string;
}

export const ROLE_META: Record<Role, RoleMeta> = {
  PERSONAL: {
    role: "PERSONAL",
    label: "Personal Trainer",
    tagline: "Entre para gerenciar seus alunos e treinos.",
    accentVar: "var(--role-personal)",
  },
  ALUNO: {
    role: "ALUNO",
    label: "Aluno",
    tagline: "Entre para ver seu treino de hoje.",
    accentVar: "var(--role-aluno)",
  },
  NUTRICIONISTA: {
    role: "NUTRICIONISTA",
    label: "Nutricionista",
    tagline: "Entre para gerenciar seus planos alimentares.",
    accentVar: "var(--role-nutricionista)",
  },
};

export const ROLE_ORDER: Role[] = ["PERSONAL", "ALUNO", "NUTRICIONISTA"];

export function isRole(value: string | null): value is Role {
  return value === "PERSONAL" || value === "ALUNO" || value === "NUTRICIONISTA";
}
