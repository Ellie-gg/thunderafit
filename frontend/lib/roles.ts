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

// Papéis oferecidos como porta de entrada (boxes da tela inicial + roles
// aceitos em /register). Fase 18 (Item 3): NUTRICIONISTA foi REMOVIDO da UI
// temporariamente — o módulo de Nutrição segue intacto no backend e as telas
// /nutricionista/** continuam existindo, mas o cadastro/seleção pública não
// expõe mais essa opção (modelo de negócio do Nutricionista ainda em
// definição). Quem JÁ tem role NUTRICIONISTA no banco continua logando e
// sendo redirecionado normalmente (ver dashboardPathForRole + ROLE_META, que
// mantêm a entrada de Nutricionista de propósito). ADMIN nunca esteve aqui
// (sem auto-cadastro). Para reexpor o Nutricionista no futuro, basta
// readicioná-lo a esta lista.
export const ROLE_ORDER: Role[] = ["PERSONAL", "ALUNO"];

export function isRole(value: string | null): value is Role {
  return (
    value === "PERSONAL" || value === "ALUNO" || value === "NUTRICIONISTA" || value === "ADMIN"
  );
}
