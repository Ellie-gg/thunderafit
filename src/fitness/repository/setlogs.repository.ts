import prisma from "../../lib/prisma";

export const setlogsRepository = {
  async findWorkoutExerciseById(workoutExerciseId: string) {
    return prisma.workoutExercise.findUnique({ where: { id: workoutExerciseId } });
  },

  async create(workoutExerciseId: string, setNumber: number, repsDone: number, weightKg: number) {
    return prisma.setLog.create({
      data: { workoutExerciseId, setNumber, repsDone, weightKg },
    });
  },

  async findAllByWorkoutExercise(workoutExerciseId: string) {
    return prisma.setLog.findMany({
      where: { workoutExerciseId },
      orderBy: { loggedAt: "asc" },
    });
  },
};
