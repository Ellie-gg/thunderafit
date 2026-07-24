import { Locale, ExerciseTranslation } from "@prisma/client";
import prisma from "../../lib/prisma";

// Traduções (~171 exercícios × 2 locales = ~342 linhas no total) são
// near-estáticas: só escritas pelo script de população fora de banda (ver
// `upsert` abaixo — nunca via HTTP). Cacheia o conjunto INTEIRO de linhas
// por locale em memória (não por combinação de exerciseIds pedidos), com o
// mesmo TTL do catálogo (`exercises.repository.ts`) por simetria. Isso
// também beneficia as chamadas de tradução de exercícios ANINHADOS
// (workout/program detail), que passam pela mesma `findManyByExerciseIds`.
const CACHE_TTL_MS = 5 * 60 * 1000;

interface LocaleCacheEntry {
  data: ExerciseTranslation[];
  expiresAt: number;
}

const cache = new Map<Locale, LocaleCacheEntry>();

async function getLocaleRows(locale: Locale): Promise<ExerciseTranslation[]> {
  const now = Date.now();
  const entry = cache.get(locale);
  if (entry && now < entry.expiresAt) return entry.data;

  const data = await prisma.exerciseTranslation.findMany({ where: { locale } });
  cache.set(locale, { data, expiresAt: now + CACHE_TTL_MS });
  return data;
}

export const exerciseTranslationsRepository = {
  async findManyByExerciseIds(exerciseIds: string[], locale: Locale) {
    const rows = await getLocaleRows(locale);
    const idSet = new Set(exerciseIds);
    // Filtra em memória sobre o conjunto completo já cacheado do locale —
    // evita reconsultar o banco pra cada combinação diferente de exerciseIds
    // (catálogo inteiro vs. exercícios de uma sessão específica).
    return rows.filter((r) => idSet.has(r.exerciseId));
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

  /** Defensivo: nada escreve traduções via HTTP hoje, mas fica pronto caso passe a escrever. */
  invalidateCache() {
    cache.clear();
  },
};
