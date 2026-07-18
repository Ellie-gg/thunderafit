import prisma from "../../lib/prisma";
import { SessionScheme } from "@prisma/client";

// Fase 26: ordem "de calendário/sequência" de cada esquema — usada pra validar
// chaves aceitas, calcular o limite de sessões e ordenar sessões
// corretamente (a ordem alfabética de LETTER coincide por acaso; a de WEEKDAY
// NÃO coincide, ex: "QUARTA" < "SEGUNDA" alfabeticamente).
export const LETTER_ORDER = ["A", "B", "C", "D", "E"];
export const WEEKDAY_ORDER = [
  "SEGUNDA",
  "TERCA",
  "QUARTA",
  "QUINTA",
  "SEXTA",
  "SABADO",
  "DOMINGO",
];

export function orderFor(scheme: SessionScheme): string[] {
  return scheme === "WEEKDAY" ? WEEKDAY_ORDER : LETTER_ORDER;
}

export const workoutProgramsRepository = {
  async createProgram(
    personalId: string,
    name: string,
    isTemplate: boolean,
    alunoId: string | null,
    sessionScheme: SessionScheme = "LETTER"
  ) {
    return prisma.workoutProgram.create({
      data: { personalId, name, isTemplate, alunoId, sessionScheme },
    });
  },

  async findProgramById(id: string) {
    return prisma.workoutProgram.findUnique({ where: { id } });
  },

  /** Programa com suas sessões (+ exercícios). setLogs incluídos para a visão do aluno. */
  async findProgramWithSessions(id: string) {
    return prisma.workoutProgram.findUnique({
      where: { id },
      include: {
        workouts: {
          orderBy: { letter: "asc" },
          include: {
            exercises: {
              orderBy: { order: "asc" },
              include: {
                exercise: true,
                setLogs: { orderBy: { loggedAt: "asc" } },
              },
            },
          },
        },
      },
    });
  },

  async countSessions(programId: string) {
    return prisma.workout.count({ where: { programId } });
  },

  async addSession(
    programId: string,
    personalId: string,
    alunoId: string | null,
    name: string,
    letter: string
  ) {
    return prisma.workout.create({
      data: { programId, personalId, alunoId, name, letter },
    });
  },

  /**
   * Lista programas do Personal. `type`:
   *  - "template": só templates (isTemplate=true)
   *  - "instance": só instâncias aplicadas a alunos (isTemplate=false)
   *  - undefined: todos
   */
  async listByPersonal(personalId: string, type?: "template" | "instance") {
    const where: { personalId: string; isTemplate?: boolean } = { personalId };
    if (type === "template") where.isTemplate = true;
    if (type === "instance") where.isTemplate = false;
    return prisma.workoutProgram.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { workouts: { select: { id: true, letter: true, name: true } } },
    });
  },

  async listByAluno(alunoId: string) {
    return prisma.workoutProgram.findMany({
      where: { alunoId, isTemplate: false },
      orderBy: { createdAt: "desc" },
      include: { workouts: { select: { id: true, letter: true, name: true, lastCompletedAt: true } } },
    });
  },

  /**
   * Aplica (COPIA) um programa a um aluno: cria um novo WorkoutProgram
   * (isTemplate=false, alunoId preenchido) e replica sessões + exercícios como
   * cópias independentes. NÃO copia setLogs (execução pertence ao aluno, um
   * template não tem). Cópia, não referência — editar o template depois não
   * afeta esta instância (decisão documentada, Fase 16). Tudo numa transação.
   */
  async applyToAluno(sourceProgramId: string, personalId: string, alunoId: string) {
    const source = await prisma.workoutProgram.findUnique({
      where: { id: sourceProgramId },
      include: { workouts: { include: { exercises: true } } },
    });
    if (!source) return null;

    return prisma.$transaction(async (tx) => {
      const copy = await tx.workoutProgram.create({
        data: {
          personalId,
          alunoId,
          name: source.name,
          isTemplate: false,
          sessionScheme: source.sessionScheme,
        },
      });
      for (const w of source.workouts) {
        const newWorkout = await tx.workout.create({
          data: {
            programId: copy.id,
            personalId,
            alunoId,
            name: w.name,
            letter: w.letter,
          },
        });
        if (w.exercises.length > 0) {
          await tx.workoutExercise.createMany({
            data: w.exercises.map((e) => ({
              workoutId: newWorkout.id,
              exerciseId: e.exerciseId,
              sets: e.sets,
              repsRange: e.repsRange,
              restSeconds: e.restSeconds,
              order: e.order,
            })),
          });
        }
      }
      return tx.workoutProgram.findUnique({
        where: { id: copy.id },
        include: { workouts: { include: { exercises: true } } },
      });
    });
  },
};
