import { Locale } from "@prisma/client";
import prisma from "../../lib/prisma";

// Fase 55: i18n do NOME de programa/sessão (WorkoutProgram/Workout) — mesmo
// espírito de exercise-translations.repository.ts, mas SEM cache em memória:
// diferente do catálogo de exercícios (near-estático, só populado por script
// fora de banda), estes são poucos registros (curadoria manual do admin) e
// escritos via HTTP de verdade (tela de admin) — mais simples e seguro
// consultar direto do banco do que gerenciar invalidação de cache aqui.
export const programTranslationsRepository = {
  async findManyProgramTranslationsByIds(workoutProgramIds: string[], locale: Locale) {
    if (workoutProgramIds.length === 0) return [];
    return prisma.workoutProgramTranslation.findMany({
      where: { workoutProgramId: { in: workoutProgramIds }, locale },
    });
  },

  async findProgramTranslations(workoutProgramId: string) {
    return prisma.workoutProgramTranslation.findMany({ where: { workoutProgramId } });
  },

  // Fase 59: `description` opcional — chamadores que só traduzem o nome
  // (comportamento anterior) continuam funcionando sem passar o 3º argumento;
  // quando omitido, o UPDATE não toca na descrição já salva (undefined !==
  // "limpar", é "não mandou").
  async upsertProgramTranslation(workoutProgramId: string, locale: Locale, name: string, description?: string | null) {
    return prisma.workoutProgramTranslation.upsert({
      where: { workoutProgramId_locale: { workoutProgramId, locale } },
      create: { workoutProgramId, locale, name, description: description ?? null },
      update: description !== undefined ? { name, description } : { name },
    });
  },

  async findManyWorkoutTranslationsByIds(workoutIds: string[], locale: Locale) {
    if (workoutIds.length === 0) return [];
    return prisma.workoutTranslation.findMany({
      where: { workoutId: { in: workoutIds }, locale },
    });
  },

  async findWorkoutTranslations(workoutId: string) {
    return prisma.workoutTranslation.findMany({ where: { workoutId } });
  },

  async upsertWorkoutTranslation(workoutId: string, locale: Locale, name: string) {
    return prisma.workoutTranslation.upsert({
      where: { workoutId_locale: { workoutId, locale } },
      create: { workoutId, locale, name },
      update: { name },
    });
  },
};
