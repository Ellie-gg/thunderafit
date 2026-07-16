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
  ADMIN: {
    role: "ADMIN",
    label: "Admin",
    tagline: "Painel administrativo.",
    accentVar: "var(--role-admin)",
  },
};

// ADMIN não entra aqui de propósito: não existe auto-cadastro nem seleção
// pública de perfil admin na tela inicial (Fase 12) — só PERSONAL/ALUNO/
// NUTRICIONISTA aparecem como opção de login. ROLE_META.ADMIN existe só
// para o acento de cor ser reaproveitado dentro do próprio painel admin.
export const ROLE_ORDER: Role[] = ["PERSONAL", "ALUNO", "NUTRICIONISTA"];

export function isRole(value: string | null): value is Role {
  return (
    value === "PERSONAL" || value === "ALUNO" || value === "NUTRICIONISTA" || value === "ADMIN"
  );
}
