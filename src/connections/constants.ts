// Fase 75: lista fixa de UFs (estruturado, não texto livre) — reaproveitada
// tanto na validação do backend quanto no seletor do frontend (duplicada lá,
// mesmo padrão já usado pra WorkoutTag entre prisma/schema.prisma e
// frontend/lib/types.ts).
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
export type SpecialtyValue = (typeof SPECIALTIES)[number];

export function isValidBrState(value: string): value is BrState {
  return (BR_STATES as readonly string[]).includes(value);
}

export function isValidSpecialty(value: string): value is SpecialtyValue {
  return (SPECIALTIES as readonly string[]).includes(value);
}
