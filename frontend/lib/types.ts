export type Role = "PERSONAL" | "ALUNO" | "NUTRICIONISTA";

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

export interface LoggedExercise {
  id: string;
  name: string;
  muscleGroup: string;
}

export interface LoadHistoryPoint {
  date: string;
  maxWeightKg: number;
}

export interface LoadHistoryResponse {
  exerciseId: string;
  history: LoadHistoryPoint[];
  percentChangeVsPrevious: number | null;
}

export interface FrequencyMonth {
  month: string;
  workoutCount: number;
}

export interface FrequencyResponse {
  period: string;
  months: FrequencyMonth[];
  totalWorkouts: number;
}

export interface Anamnesis {
  alunoId: string;
  fullName: string | null;
  birthDate: string | null;
  heightCm: number | null;
  weightKg: number | null;
  goals: string | null;
  healthConditions: string | null;
  medications: string | null;
  activityLevel: string | null;
  pastExperience: string | null;
  trainingPreferences: string | null;
  injuries: string | null;
  createdAt: string;
  updatedAt: string;
}

export type AnamnesisInput = Partial<
  Omit<Anamnesis, "alunoId" | "createdAt" | "updatedAt">
>;

export type SupportThreadStatus = "ABERTO" | "RESPONDIDO";

export interface SupportMessage {
  id: string;
  threadId: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface SupportThread {
  id: string;
  alunoId: string;
  personalId: string;
  subject: string;
  status: SupportThreadStatus;
  createdAt: string;
  updatedAt: string;
  messages: SupportMessage[];
}

export interface PersonalOption {
  id: string;
  email: string;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  read: boolean;
  createdAt: string;
}

export interface Food {
  id: string;
  name: string;
  portionDescription: string;
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcal: number;
}

export interface Macros {
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcal: number;
}

export interface DietPlan {
  id: string;
  nutricionistaId: string;
  alunoId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export interface DietFoodItem {
  id: string;
  foodId: string;
  foodName: string;
  portionDescription: string;
  quantity: number;
  macros: Macros;
}

export interface DietMealDetail {
  id: string;
  name: string;
  time: string;
  order: number;
  foods: DietFoodItem[];
  macros: Macros;
}

export interface DietPlanDetail extends DietPlan {
  meals: DietMealDetail[];
  totalMacros: Macros;
}
