import { Locale } from "@prisma/client";
import { programTranslationsRepository } from "../repository/program-translations.repository";

interface TranslatableProgram {
  id: string;
  name: string;
}

interface TranslatableWorkout {
  id: string;
  name: string;
}

/**
 * Fase 55: traduz o NOME de `WorkoutProgram`/`Workout` — mesmo contrato de
 * exercise-translation.service.ts (PT nunca consulta tradução, fallback pro
 * nome canônico quando a tradução daquele registro específico ainda não
 * existe, nunca lança erro/campo vazio).
 */
export const programTranslationService = {
  async translatePrograms<T extends TranslatableProgram>(programs: T[], locale: Locale): Promise<T[]> {
    if (locale === "PT" || programs.length === 0) return programs;
    const translations = await programTranslationsRepository.findManyProgramTranslationsByIds(
      programs.map((p) => p.id),
      locale
    );
    const byId = new Map(translations.map((t) => [t.workoutProgramId, t]));
    return programs.map((p) => {
      const t = byId.get(p.id);
      return t ? { ...p, name: t.name } : p;
    });
  },

  async translateWorkouts<T extends TranslatableWorkout>(workouts: T[], locale: Locale): Promise<T[]> {
    if (locale === "PT" || workouts.length === 0) return workouts;
    const translations = await programTranslationsRepository.findManyWorkoutTranslationsByIds(
      workouts.map((w) => w.id),
      locale
    );
    const byId = new Map(translations.map((t) => [t.workoutId, t]));
    return workouts.map((w) => {
      const t = byId.get(w.id);
      return t ? { ...w, name: t.name } : w;
    });
  },
};
