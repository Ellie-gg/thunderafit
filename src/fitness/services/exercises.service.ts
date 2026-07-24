import { Locale } from "@prisma/client";
import { exercisesRepository } from "../repository/exercises.repository";
import { exerciseTranslationService } from "./exercise-translation.service";

export const exercisesService = {
  /**
   * i18n: catálogo PÚBLICO (usado pelo Personal prescrevendo, pela Montagem
   * Inteligente, etc.) — retorna nome/categoria/descrição no locale ativo,
   * com fallback pro PT. `/nimbus/exercicios` (CRUD do admin) NÃO passa por
   * aqui — o admin sempre edita o dado canônico em português.
   */
  async listExercises(muscleGroup: string | undefined, locale: Locale) {
    const exercises = await exercisesRepository.findAll(muscleGroup);
    return exerciseTranslationService.translateMany(exercises, locale);
  },
};
