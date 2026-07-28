import prisma from "./prisma";

/**
 * Fase 80 (admin remove usuário) / Fase 81 (aluno/Personal remove a própria
 * conta) — extraído pra cá porque as duas fases chamam o MESMO cascade
 * (só muda quem tem permissão de invocar, decidido em cada domínio
 * separadamente). Nenhuma das tabelas abaixo tem FK de verdade pra `User`
 * (colunas soltas, sem `@relation` — só `WorkoutExercise`/`SetLog`/
 * `DietMeal`/`DietFood`/`WorkoutProgramTranslation`/`WorkoutTranslation`/
 * `ConnectionMessage`/`SupportMessage` têm FK real, e essas apontam pra
 * outra tabela do próprio domínio, não pra `User` diretamente) — apagar a
 * linha de `User` sozinha NUNCA falharia por violação de FK, mas deixaria
 * lixo órfão espalhado por quase todo domínio. Por isso o cascade manual
 * abaixo, mesmo padrão já usado em `deleteSelfTemplate` (filhos antes dos
 * pais, tudo numa `$transaction`).
 *
 * Duas categorias de dado tratadas de formas diferentes de propósito:
 * - Dado que só faz sentido COM o usuário (Anamnesis, Notification,
 *   LoginLog, ContactMessage, e qualquer relação de 2 lados onde este
 *   usuário é um dos lados — ClientRelation, ConnectionRequest+Message,
 *   SupportThread+Message): apagado.
 * - `WorkoutProgram`/`Workout` que este usuário criou (`personalId`) mas
 *   que pertencem a OUTRO aluno que continua existindo: `personalId` vira
 *   `null` em vez de apagar — apagar destruiria o histórico de treino de
 *   um aluno que não tem nada a ver com esta remoção. Só é apagado de
 *   verdade quando o PRÓPRIO `alunoId` do programa é o usuário removido.
 * - `AdminAccessLog`/`AdminAuditLog` NUNCA são tocados — são trilha de
 *   auditoria; a referência ficar órfã (sem FK, então sem erro nenhum) é
 *   aceitável e desejável (quer dizer "admin X apagou o usuário Y" continua
 *   legível mesmo depois de Y não existir mais).
 * - `DietPlan` não tem `nutricionistaId` nullable no schema — um plano
 *   cujo nutricionista foi removido é apagado por completo (perde o plano
 *   do aluno associado também), aceito como trade-off explícito desta
 *   fase em vez de migração nova só pra isso.
 */
export async function deleteUserCascade(userId: string) {
  // Timeout maior que o default (5s) — um Personal com muitos alunos/
  // programas pode ter bastante coisa pra apagar em cascata manual.
  await prisma.$transaction(async (tx) => {
    // --- Workout/WorkoutProgram: aluno-owned é apagado, personal-owned (de outro aluno) só perde o dono ---
    const ownedPrograms = await tx.workoutProgram.findMany({
      where: { alunoId: userId },
      select: { id: true },
    });
    const ownedProgramIds = ownedPrograms.map((p) => p.id);
    if (ownedProgramIds.length > 0) {
      const ownedWorkouts = await tx.workout.findMany({
        where: { programId: { in: ownedProgramIds } },
        select: { id: true },
      });
      const ownedWorkoutIds = ownedWorkouts.map((w) => w.id);
      const ownedWorkoutExercises = await tx.workoutExercise.findMany({
        where: { workoutId: { in: ownedWorkoutIds } },
        select: { id: true },
      });
      const ownedWorkoutExerciseIds = ownedWorkoutExercises.map((we) => we.id);
      await tx.setLog.deleteMany({ where: { workoutExerciseId: { in: ownedWorkoutExerciseIds } } });
      await tx.workoutExercise.deleteMany({ where: { workoutId: { in: ownedWorkoutIds } } });
      // Workout/WorkoutProgram translations têm onDelete: Cascade — somem sozinhas.
      await tx.workout.deleteMany({ where: { programId: { in: ownedProgramIds } } });
      await tx.workoutProgram.deleteMany({ where: { id: { in: ownedProgramIds } } });
    }

    const personalPrograms = await tx.workoutProgram.findMany({
      where: { personalId: userId },
      select: { id: true, alunoId: true },
    });
    const toOrphanProgramIds = personalPrograms
      .filter((p) => p.alunoId !== userId)
      .map((p) => p.id);
    if (toOrphanProgramIds.length > 0) {
      await tx.workoutProgram.updateMany({
        where: { id: { in: toOrphanProgramIds } },
        data: { personalId: null },
      });
      await tx.workout.updateMany({
        where: { programId: { in: toOrphanProgramIds } },
        data: { personalId: null },
      });
    }

    // --- DietPlan (qualquer lado) + meals + foods ---
    const dietPlans = await tx.dietPlan.findMany({
      where: { OR: [{ nutricionistaId: userId }, { alunoId: userId }] },
      select: { id: true },
    });
    const dietPlanIds = dietPlans.map((d) => d.id);
    if (dietPlanIds.length > 0) {
      const dietMeals = await tx.dietMeal.findMany({
        where: { dietPlanId: { in: dietPlanIds } },
        select: { id: true },
      });
      const dietMealIds = dietMeals.map((m) => m.id);
      await tx.dietFood.deleteMany({ where: { dietMealId: { in: dietMealIds } } });
      await tx.dietMeal.deleteMany({ where: { dietPlanId: { in: dietPlanIds } } });
      await tx.dietPlan.deleteMany({ where: { id: { in: dietPlanIds } } });
    }

    // --- Anamnesis (só o próprio aluno tem) ---
    await tx.anamnesis.deleteMany({ where: { alunoId: userId } });

    // --- Dúvidas (SupportThread/SupportMessage), qualquer lado ---
    const threads = await tx.supportThread.findMany({
      where: { OR: [{ alunoId: userId }, { personalId: userId }] },
      select: { id: true },
    });
    const threadIds = threads.map((t) => t.id);
    if (threadIds.length > 0) {
      await tx.supportMessage.deleteMany({ where: { threadId: { in: threadIds } } });
      await tx.supportThread.deleteMany({ where: { id: { in: threadIds } } });
    }

    // --- Conversa de contato (ConnectionRequest/ConnectionMessage), qualquer lado ---
    const requests = await tx.connectionRequest.findMany({
      where: { OR: [{ alunoId: userId }, { professionalId: userId }] },
      select: { id: true },
    });
    const requestIds = requests.map((r) => r.id);
    if (requestIds.length > 0) {
      await tx.connectionMessage.deleteMany({ where: { connectionRequestId: { in: requestIds } } });
      await tx.connectionRequest.deleteMany({ where: { id: { in: requestIds } } });
    }

    // --- Vínculo Personal/Nutricionista <-> Aluno, qualquer lado ---
    await tx.clientRelation.deleteMany({
      where: { OR: [{ personalId: userId }, { alunoId: userId }] },
    });

    // --- Dados só do próprio usuário ---
    await tx.notification.deleteMany({ where: { userId } });
    await tx.loginLog.deleteMany({ where: { userId } });
    await tx.contactMessage.deleteMany({ where: { userId } });

    await tx.user.delete({ where: { id: userId } });
  }, { timeout: 20000 });
}
