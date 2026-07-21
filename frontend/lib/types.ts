export type Role = "PERSONAL" | "ALUNO" | "NUTRICIONISTA" | "ADMIN";

export interface User {
  id: string;
  email: string;
  role: Role;
  planoAssinatura: "FREE" | "PAGO";
  limiteAlunos: number;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export type DifficultyLevel = "INICIANTE" | "INTERMEDIARIO" | "AVANCADO";

// Fase 32: tipo da mídia do exercício — YOUTUBE é o default (compatibilidade
// com o catálogo já existente); VIDEO/GIF são arquivos nativos hospedados
// no bucket GCS (mediaUrl aponta pra storage.googleapis.com nesses casos).
export type ExerciseMediaType = "YOUTUBE" | "VIDEO" | "GIF";

export interface Exercise {
  id: string;
  name: string;
  muscleGroup: string;
  equipment: string;
  mediaUrl: string | null;
  mediaType: ExerciseMediaType;
  description: string;
  difficultyLevel: DifficultyLevel;
  // Fase 34: os ~5 exercícios mais feitos de cada grupo muscular (curadoria
  // manual, editável em /nimbus/exercicios) — aparecem primeiro dentro do
  // grupo e ganham destaque visual sutil na tela de prescrição.
  isFeatured: boolean;
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
  notes: string | null;
  exercise?: Exercise;
  setLogs?: SetLog[];
}

export interface Workout {
  id: string;
  programId: string;
  personalId: string;
  alunoId: string | null;
  name: string;
  letter: string;
  lastCompletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  exercises?: WorkoutExercise[];
  /** Presente na visão de programa do aluno (GET /api/workout-programs/:id). */
  suggestedNext?: boolean;
}

// Fase 35/36: resumo pós-treino — devolvido junto da resposta de conclusão de
// sessão, usado tanto pra recapitulação motivacional quanto pro card
// exportável como imagem (mesmo componente, dois usos). `hasHistory` distingue
// "sem sessão anterior deste mesmo treino pra comparar" de uma comparação
// percentual de verdade (evita mostrar 0%/∞% sem sentido).
export interface WorkoutSummaryPR {
  exerciseId: string;
  exerciseName: string;
  weightKg: number;
  previousBestKg: number;
}

export interface WorkoutCompletionSummary {
  workoutId: string;
  workoutName: string;
  workoutLetter: string;
  completedAt: string;
  // Aproximada (última série − primeira série desta sessão); null com 0/1 série.
  durationMinutes: number | null;
  volumeKg: number;
  setsLogged: number;
  hasHistory: boolean;
  previousVolumeKg: number | null;
  volumeChangePercent: number | null;
  streakDays: number;
  personalRecords: WorkoutSummaryPR[];
}

export type SessionScheme = "LETTER" | "WEEKDAY";

export interface WorkoutProgram {
  id: string;
  personalId: string;
  name: string;
  isTemplate: boolean;
  alunoId: string | null;
  sessionScheme: SessionScheme;
  createdAt: string;
  updatedAt: string;
  workouts?: Workout[];
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

// Fase 33.4: resumo pra barra de voltagem semanal + métricas rápidas do
// dashboard do aluno.
export interface WeeklySummaryDay {
  date: string;
  active: boolean;
}

export interface WeeklySummaryResponse {
  days: WeeklySummaryDay[];
  volumeKg: number;
  streakDays: number;
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
  // Fase 17 (Item 6): distingue Personal de Nutricionista na escolha do
  // destinatário da dúvida.
  professionalType: "PERSONAL" | "NUTRICIONISTA";
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
  isActive: boolean;
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

export interface AdminOverview {
  usersByRole: Record<string, number>;
  newUsersByDay: Array<{ day: string; count: number }>;
  professionalsAtFreemiumLimit: number;
  totalProfessionals: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: Role;
  planoAssinatura: "FREE" | "PAGO";
  limiteAlunos: number;
  lastLoginAt: string | null;
  createdAt: string;
  isOrphanAluno?: boolean;
}

export interface AdminUsersResponse {
  users: AdminUser[];
  total: number;
  page: number;
  pageSize: number;
}

export interface AdminLoginLogEntry {
  id: string;
  userId: string;
  email: string;
  ipAddress: string | null;
  createdAt: string;
}

export interface AdminSupportSlaThread {
  id: string;
  subject: string;
  alunoId: string;
  personalId: string;
  openedAt: string;
  hoursOpen: number;
}

export interface AdminAccessLogEntry {
  id: string;
  adminId: string;
  resourceType: string;
  alunoId: string;
  createdAt: string;
}

// Fase 33: trilha de ações administrativas sensíveis (hoje só mudança de
// role) — tabela separada de AdminAccessLog (ver prisma/schema.prisma).
export interface AdminAuditLogEntry {
  id: string;
  adminId: string;
  action: string;
  targetUserId: string;
  details: string;
  createdAt: string;
}

export interface AdminExerciseInput {
  name: string;
  muscleGroup: string;
  equipment: string;
  description: string;
  difficultyLevel: DifficultyLevel;
  confirmSimilarName?: boolean;
  isFeatured?: boolean;
}

/** Resposta de criar/editar exercício: ou salvou, ou avisou de nome parecido (sem salvar). */
export type AdminExerciseMutationResult =
  | { exercise: Exercise; warning?: undefined }
  | { warning: "similar_name"; similarNames: string[]; exercise?: undefined };
