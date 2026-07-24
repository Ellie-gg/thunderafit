import { DifficultyLevel } from "@prisma/client";
import { exercisesRepository } from "../repository/exercises.repository";

export type WorkoutGoal = "hipertrofia" | "forca" | "resistencia";
export type ExperienceLevel = "iniciante" | "intermediario" | "avancado";

export interface GeneratedExercise {
  exerciseId: string;
  exerciseName: string;
  muscleGroup: string;
  sets: number;
  repsRange: string;
  restSeconds: number;
  order: number;
}

const VALID_GOALS: WorkoutGoal[] = ["hipertrofia", "forca", "resistencia"];
const VALID_LEVELS: ExperienceLevel[] = ["iniciante", "intermediario", "avancado"];

// Motor de regras determinístico (sem LLM externa, propositalmente): cada
// objetivo já mapeia pra uma prescrição fixa de séries/reps/descanso. Faixas
// como "3-4 séries" viram um único número determinístico (o piso da faixa) —
// o Personal ainda revisa e pode ajustar cada linha antes de salvar.
const GOAL_PRESETS: Record<WorkoutGoal, { sets: number; repsRange: string; restSeconds: number }> = {
  hipertrofia: { sets: 3, repsRange: "8-12", restSeconds: 60 },
  forca: { sets: 4, repsRange: "4-6", restSeconds: 120 },
  resistencia: { sets: 3, repsRange: "15-20", restSeconds: 45 },
};

// "2-3 pro grupo principal, 2 pro secundário" (spec original): o catálogo não
// tem conceito de principal/secundário, então a ORDEM em que o Personal
// seleciona os grupos decide — o primeiro é o principal.
const PRIMARY_GROUP_EXERCISE_COUNT = 3;
const SECONDARY_GROUP_EXERCISE_COUNT = 2;

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function levelToDifficulty(level: ExperienceLevel): DifficultyLevel {
  return level.toUpperCase() as DifficultyLevel;
}

export const workoutGeneratorService = {
  /**
   * Gera um RASCUNHO (nada é persistido aqui) de exercícios pra uma sessão,
   * a partir de grupos musculares + objetivo. `level` não filtra o catálogo
   * de forma rígida — a maioria dos ~170 exercícios cadastrados usa o
   * `difficultyLevel` padrão (INTERMEDIARIO, não curado por nível), e um
   * filtro estrito esvaziaria grupos musculares inteiros pra quem pedir
   * iniciante/avançado. Em vez disso, `level` só REORDENA os candidatos
   * (o nível pedido aparece primeiro), preservando a ordem de destaque/nome
   * já usada em `exercisesRepository.findAll` como desempate.
   */
  async generateDraft(
    muscleGroups: string[],
    goal: WorkoutGoal,
    level: ExperienceLevel
  ): Promise<GeneratedExercise[]> {
    if (!Array.isArray(muscleGroups) || muscleGroups.length === 0) {
      throw httpError("Selecione ao menos um grupo muscular.", 400);
    }
    if (!VALID_GOALS.includes(goal)) {
      throw httpError("goal deve ser hipertrofia, forca ou resistencia.", 400);
    }
    if (!VALID_LEVELS.includes(level)) {
      throw httpError("level deve ser iniciante, intermediario ou avancado.", 400);
    }

    const preset = GOAL_PRESETS[goal];
    const preferredDifficulty = levelToDifficulty(level);
    const draft: GeneratedExercise[] = [];
    let order = 1;

    // `exercisesRepository.findAll` é cache-backed (in-memory, TTL 5min —
    // ver exercises.repository.ts): a 1ª chamada deste loop popula o cache
    // do catálogo inteiro, as demais (por grupo, e entre requests dentro do
    // TTL) só filtram em memória. Ou seja, este loop já NÃO bate no banco
    // uma vez por grupo — não "otimize" trocando por uma query com
    // `muscleGroup IN (...)` sem saber disso.
    for (let i = 0; i < muscleGroups.length; i++) {
      const group = muscleGroups[i];
      const count = i === 0 ? PRIMARY_GROUP_EXERCISE_COUNT : SECONDARY_GROUP_EXERCISE_COUNT;

      const candidates = await exercisesRepository.findAll(group);
      // Sort estável: só reordena por preferência de nível, preservando o
      // desempate (destaque > nome) que já vem de findAll.
      const ordered = [...candidates].sort((a, b) => {
        const aMatches = a.difficultyLevel === preferredDifficulty ? 0 : 1;
        const bMatches = b.difficultyLevel === preferredDifficulty ? 0 : 1;
        return aMatches - bMatches;
      });

      for (const exercise of ordered.slice(0, count)) {
        draft.push({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          muscleGroup: exercise.muscleGroup,
          sets: preset.sets,
          repsRange: preset.repsRange,
          restSeconds: preset.restSeconds,
          order: order++,
        });
      }
    }

    return draft;
  },
};
