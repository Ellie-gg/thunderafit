export type Role = "PERSONAL" | "ALUNO";

export interface User {
  id: string;
  email: string;
  role: Role;
  planoAssinatura: "FREE" | "PAGO";
  limiteAlunos: number;
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  mediaUrl: string | null;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface SetLog {
  id: string;
  workoutExerciseId: string;
  setNumber: number;
  repsDone: number;
  weightKg: number;
  loggedAt: string;
}

export interface WorkoutExercise {
  id: string;
  workoutId: string;
  exerciseId: string;
  sets: number;
  repsRange: string;
  restSeconds: number;
  order: number;
  exercise?: Exercise;
  setLogs?: SetLog[];
}

export interface Workout {
  id: string;
  personalId: string;
  alunoId: string;
  name: string;
  letter: string;
  createdAt: string;
  updatedAt: string;
  exercises?: WorkoutExercise[];
}
