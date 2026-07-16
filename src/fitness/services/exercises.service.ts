import { exercisesRepository } from "../repository/exercises.repository";

export const exercisesService = {
  async listExercises(muscleGroup?: string) {
    return exercisesRepository.findAll(muscleGroup);
  },
};
