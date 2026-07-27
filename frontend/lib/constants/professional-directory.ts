// Fase 75: lista fixa de UFs + especialidades, duplicada do backend
// (src/connections/constants.ts) — mesmo padrão já usado pra WorkoutTag
// entre prisma/schema.prisma e frontend/lib/types.ts.
export const BR_STATES = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO",
  "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI",
  "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO",
] as const;
export type BrState = (typeof BR_STATES)[number];

export const SPECIALTIES = [
  "HIPERTROFIA",
  "EMAGRECIMENTO",
  "FORCA_POWERLIFTING",
  "FUNCIONAL",
  "REABILITACAO",
  "TERCEIRA_IDADE",
  "GESTANTES",
  "CROSSFIT",
  "CORRIDA_CARDIO",
  "NUTRICAO_ESPORTIVA",
] as const;
export type Specialty = (typeof SPECIALTIES)[number];
