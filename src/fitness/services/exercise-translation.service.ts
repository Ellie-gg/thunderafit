import { Locale } from "@prisma/client";
import { exerciseTranslationsRepository } from "../repository/exercise-translations.repository";

interface TranslatableExercise {
  id: string;
  name: string;
  muscleGroup: string;
  description: string;
}

/**
 * i18n: resolve o locale ativo sobre exercícios (catálogo avulso ou
 * aninhados dentro de sessão/programa). PT nunca consulta a tabela de
 * tradução — o português já É o dado em `Exercise`, a fonte da verdade.
 * EN/ES buscam em `ExerciseTranslation` e caem pro valor PT já presente no
 * objeto quando a tradução daquele exercício específico ainda não existe —
 * nunca lança erro, nunca retorna campo vazio.
 */
export const exerciseTranslationService = {
  async translateMany<T extends TranslatableExercise>(exercises: T[], locale: Locale): Promise<T[]> {
    if (locale === "PT" || exercises.length === 0) return exercises;

    const translations = await exerciseTranslationsRepository.findManyByExerciseIds(
      exercises.map((e) => e.id),
      locale
    );
    const byExerciseId = new Map(translations.map((t) => [t.exerciseId, t]));

    return exercises.map((ex) => {
      const t = byExerciseId.get(ex.id);
      if (!t) return ex; // sem tradução ainda pra este exercício — fallback PT
      return { ...ex, name: t.name, muscleGroup: t.muscleGroup, description: t.description };
    });
  },

  async translateOne<T extends TranslatableExercise>(exercise: T, locale: Locale): Promise<T> {
    const [translated] = await this.translateMany([exercise], locale);
    return translated;
  },

  /**
   * Aplica tradução a exercícios ANINHADOS (ex: `workout.exercises[].exercise`,
   * vindos de `include: { exercise: true }`). Reusa `translateMany` extraindo
   * só os `Exercise` embutidos, sem tocar no resto da forma do objeto pai.
   */
  async translateNested<P extends { exercise: TranslatableExercise }>(
    items: P[],
    locale: Locale
  ): Promise<P[]> {
    if (locale === "PT" || items.length === 0) return items;
    const translatedExercises = await this.translateMany(
      items.map((i) => i.exercise),
      locale
    );
    return items.map((item, index) => ({ ...item, exercise: translatedExercises[index] }));
  },
};
