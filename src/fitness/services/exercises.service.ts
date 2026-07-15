import { exercisesRepository } from "../repository/exercises.repository";

export const exercisesService = {
  async listExercises() {
    return exercisesRepository.findAll();
  },
};
