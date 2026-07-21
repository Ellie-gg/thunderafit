import { workoutsRepository } from "../repository/workouts.repository";
import { relationsRepository } from "../repository/relations.repository";
import { exercisesRepository } from "../repository/exercises.repository";
import { workoutSummaryService } from "./workout-summary.service";

// Fase 27: observação do Personal sobre a prescrição de um exercício.
const MAX_NOTES_LENGTH = 500;

export const workoutsService = {
  async listWorkoutsForUser(
    userId: string,
    role: "PERSONAL" | "ALUNO" | "NUTRICIONISTA" | "ADMIN",
    adminTarget?: { alunoId?: string; personalId?: string }
  ) {
    if (role === "ADMIN") {
      // Admin não tem treinos próprios — visão ampliada de um aluno ou
      // Personal específico, sem assumir a identidade de nenhum dos dois.
      if (adminTarget?.alunoId) {
        return workoutsRepository.findAllByAluno(adminTarget.alunoId);
      }
      if (adminTarget?.personalId) {
        return workoutsRepository.findAllByPersonal(adminTarget.personalId);
      }
      return [];
    }
    if (role === "ALUNO") {
      return workoutsRepository.findAllByAluno(userId);
    }
    return workoutsRepository.findAllByPersonal(userId);
  },

  async createWorkout(personalId: string, alunoId: string, name: string, letter: string) {
    const relation = await relationsRepository.findByPersonalAndAluno(personalId, alunoId);
    if (!relation) {
      const err = new Error("Aluno não vinculado a este Personal Trainer.");
      (err as any).statusCode = 403;
      throw err;
    }

    return workoutsRepository.create(personalId, alunoId, name, letter);
  },

  async addExercise(
    workoutId: string,
    personalId: string,
    exerciseId: string,
    sets: number,
    repsRange: string,
    restSeconds: number,
    order: number,
    notes?: string | null
  ) {
    const workout = await workoutsRepository.findById(workoutId);
    if (!workout || workout.personalId !== personalId) {
      const err = new Error("Treino não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    const exercise = await exercisesRepository.findById(exerciseId);
    if (!exercise) {
      const err = new Error("Exercício não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    if (notes && notes.length > MAX_NOTES_LENGTH) {
      const err = new Error(`Observações devem ter no máximo ${MAX_NOTES_LENGTH} caracteres.`);
      (err as any).statusCode = 400;
      throw err;
    }

    return workoutsRepository.addExercise(
      workoutId,
      exerciseId,
      sets,
      repsRange,
      restSeconds,
      order,
      notes?.trim() || null
    );
  },

  // Fase 28: reordenar exercícios prescritos (setas ↑/↓ no frontend). Troca a
  // `order` do exercício com a do vizinho imediato na lista já ordenada —
  // sempre uma posição por vez, sem reindexar o treino inteiro.
  async moveExercise(
    workoutId: string,
    personalId: string,
    workoutExerciseId: string,
    direction: "up" | "down"
  ) {
    const workout = await workoutsRepository.findById(workoutId);
    if (!workout || workout.personalId !== personalId) {
      const err = new Error("Treino não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    const result = await workoutsRepository.moveExercise(workoutId, workoutExerciseId, direction);
    if (result === "not_found") {
      const err = new Error("Exercício não encontrado neste treino.");
      (err as any).statusCode = 404;
      throw err;
    }
    if (result === "first" || result === "last") {
      const err = new Error(
        result === "first" ? "Já é o primeiro exercício." : "Já é o último exercício."
      );
      (err as any).statusCode = 400;
      throw err;
    }

    return workoutsRepository.findExercisesOrdered(workoutId);
  },

  async getWorkout(workoutId: string, userId: string, role?: string) {
    const workout = await workoutsRepository.findByIdWithExercises(workoutId);
    if (!workout) {
      const err = new Error("Treino não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    if (role !== "ADMIN" && workout.alunoId !== userId && workout.personalId !== userId) {
      const err = new Error("Você não tem permissão para acessar este treino.");
      (err as any).statusCode = 403;
      throw err;
    }

    return workout;
  },

  // Fase 16: o aluno marca a sessão como concluída. Só o próprio aluno dono da
  // sessão pode concluir (nem Personal, nem admin — concluir é um ato de
  // execução do aluno). Idempotente: só atualiza lastCompletedAt.
  //
  // Fase 35: além de concluir, monta o resumo pós-treino (volume, comparação
  // com a sessão anterior, PRs) — precisa capturar o `lastCompletedAt` ANTIGO
  // antes de sobrescrevê-lo, já que ele é a única fronteira disponível pra
  // separar "séries desta sessão" das de sessões passadas (não existe uma
  // entidade de sessão/conclusão própria no banco).
  async completeWorkout(workoutId: string, userId: string) {
    const workout = await workoutsRepository.findById(workoutId);
    if (!workout) {
      const err = new Error("Treino não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    if (workout.alunoId !== userId) {
      const err = new Error("Apenas o aluno dono da sessão pode concluí-la.");
      (err as any).statusCode = 403;
      throw err;
    }

    const previousLastCompletedAt = workout.lastCompletedAt;
    const completedAt = new Date();

    const summary = await workoutSummaryService.buildCompletionSummary(
      workout,
      previousLastCompletedAt,
      completedAt
    );
    const updatedWorkout = await workoutsRepository.markCompleted(workoutId, completedAt);

    return { workout: updatedWorkout, summary };
  },
};
