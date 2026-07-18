import { workoutsRepository } from "../repository/workouts.repository";
import { relationsRepository } from "../repository/relations.repository";
import { exercisesRepository } from "../repository/exercises.repository";

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

    const exercises = await workoutsRepository.findExercisesOrdered(workoutId);
    const index = exercises.findIndex((e) => e.id === workoutExerciseId);
    if (index === -1) {
      const err = new Error("Exercício não encontrado neste treino.");
      (err as any).statusCode = 404;
      throw err;
    }

    const neighborIndex = direction === "up" ? index - 1 : index + 1;
    if (neighborIndex < 0 || neighborIndex >= exercises.length) {
      const err = new Error(
        direction === "up" ? "Já é o primeiro exercício." : "Já é o último exercício."
      );
      (err as any).statusCode = 400;
      throw err;
    }

    const current = exercises[index];
    const neighbor = exercises[neighborIndex];
    await workoutsRepository.swapExerciseOrder(current.id, current.order, neighbor.id, neighbor.order);
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
    return workoutsRepository.markCompleted(workoutId, new Date());
  },
};
