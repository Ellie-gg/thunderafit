import prisma from "../../lib/prisma";

// Catálogo (~170 exercícios) é near-estático: só muda via CRUD do admin
// (`admin.service.ts`, que chama `invalidateCache()` depois de cada escrita)
// — nunca escrito por nenhum outro caminho HTTP. É lido em TODO request de
// prescrição do Personal e em cada grupo muscular da Montagem Inteligente,
// então cachear o array completo (não filtrado) em memória evita um
// round-trip ao banco por request. TTL espelha o `staleTime` de 5min já
// usado no frontend pro mesmo catálogo (`add-exercise-form.tsx` /
// `generate-workout-modal.tsx`) — mantém os dois em sincronia proposital.
const CACHE_TTL_MS = 5 * 60 * 1000;

type CachedExercise = Awaited<ReturnType<typeof fetchFullCatalog>>[number];

let cache: CachedExercise[] | null = null;
let expiresAt = 0;
// Bump só quando o cache é de fato repreenchido (não em todo invalidateCache
// — invalidar só zera, quem bumpa é o próximo findAll que repopula). Usado
// pelo controller pra montar o ETag de GET /api/exercises.
let version = 0;

async function fetchFullCatalog() {
  return prisma.exercise.findMany({
    // Fase 34: destaque primeiro (curadoria dos ~5 exercícios mais feitos
    // de cada grupo), depois alfabético — centralizado aqui pra qualquer
    // consumidor da lista (ex: seletor de exercício do Personal) já
    // receber a ordem certa sem precisar reordenar no cliente.
    orderBy: [{ isFeatured: "desc" }, { name: "asc" }],
    // `select` explícito: exclui só `createdAt`/`updatedAt`, que nenhum
    // consumidor (seletor de exercício do Personal, Montagem Inteligente,
    // exercise-translation.service) lê. `description` fica: mesmo não
    // sendo usada pelo seletor visual, o teste de i18n do catálogo
    // (`exercise-translation.test.ts`) confere `description` traduzida
    // NESTE MESMO endpoint (GET /api/exercises) — removê-la mudaria o
    // contrato HTTP existente, o que está fora do escopo desta otimização.
    select: {
      id: true,
      name: true,
      muscleGroup: true,
      equipment: true,
      mediaUrl: true,
      mediaType: true,
      description: true,
      difficultyLevel: true,
      isFeatured: true,
    },
  });
}

async function getFullCatalog(): Promise<CachedExercise[]> {
  const now = Date.now();
  if (!cache || now >= expiresAt) {
    cache = await fetchFullCatalog();
    expiresAt = now + CACHE_TTL_MS;
    version++;
  }
  return cache;
}

export const exercisesRepository = {
  async findAll(muscleGroup?: string) {
    const all = await getFullCatalog();
    // `.filter` sobre um array já ordenado preserva a ordem — filtrar em
    // memória aqui é seguro e evita uma query por grupo muscular (a
    // Montagem Inteligente chama `findAll(group)` uma vez por grupo
    // selecionado; ver comentário em workout-generator.service.ts).
    // Os objetos retornados são DTOs read-only compartilhados entre
    // requests — nenhum consumidor pode mutá-los (verificado: workout
    // generator faz `[...candidates].sort()`, uma cópia; exercise-
    // translation.service usa `.map()`, que também não muta o original).
    return muscleGroup ? all.filter((e) => e.muscleGroup === muscleGroup) : all;
  },

  async findById(id: string) {
    return prisma.exercise.findUnique({ where: { id } });
  },

  /** Chamado pelo admin.service.ts após create/update/delete/media de Exercise. */
  invalidateCache() {
    cache = null;
    expiresAt = 0;
  },

  /** Usado pelo controller pra montar o ETag de GET /api/exercises. */
  getCacheVersion() {
    return version;
  },
};
