import { Locale } from "@prisma/client";
import prisma from "../../lib/prisma";

export const exerciseTranslationsRepository = {
  async findManyByExerciseIds(exerciseIds: string[], locale: Locale) {
    return prisma.exerciseTranslation.findMany({
      where: { exerciseId: { in: exerciseIds }, locale },
    });
  },

  async findByExerciseAndLocale(exerciseId: string, locale: Locale) {
    return prisma.exerciseTranslation.findUnique({
      where: { exerciseId_locale: { exerciseId, locale } },
    });
  },

  /** Upsert usado só pelo script de população de traduções (nunca via HTTP). */
  async upsert(
    exerciseId: string,
    locale: Locale,
    data: { name: string; muscleGroup: string; description: string }
  ) {
    return prisma.exerciseTranslation.upsert({
      where: { exerciseId_locale: { exerciseId, locale } },
      create: { exerciseId, locale, ...data },
      update: data,
    });
  },
};
