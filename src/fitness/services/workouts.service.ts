import { Locale } from "@prisma/client";
import { workoutsRepository } from "../repository/workouts.repository";
import { relationsRepository } from "../repository/relations.repository";
import { exercisesRepository } from "../repository/exercises.repository";
import { workoutSummaryService } from "./workout-summary.service";
import { workoutSessionLogRepository } from "../repository/workout-session-log.repository";
import { exerciseTranslationService } from "./exercise-translation.service";
import { alunoPremiumService } from "../../billing/services/aluno-premium.service";
import { assertPersonalCanPrescribe, assertAlunoWorkoutAccessible } from "../../lib/plan-expiry";
import { assertValidName } from "../../lib/validate-name";

// Fase 112: RPE (Percepção Subjetiva de Esforço), escala Borg 0-10 —
// pergunta única e opcional depois do resumo pós-treino (ver
// WorkoutSessionLog.rpe no schema pro racional completo).
const RPE_MIN = 0;
const RPE_MAX = 10;

// Fase 27: observação do Personal sobre a prescrição de um exercício.
const MAX_NOTES_LENGTH = 500;

// M5 (auditoria 2026-08-06): teto de sanidade pra duração de sessão. Uma
// sessão de mais de 24h não existe na prática, e o limite também protege a
// coluna `Int4` do `WorkoutSessionLog` (sem ele, um valor acima de 2^31-1
// estourava no INSERT — verificado contra o Postgres real — DEPOIS de
// `markCompleted` já ter rodado, deixando o treino concluído sem session log,
// com 500 e sem resumo pós-treino).
const MAX_DURATION_SECONDS = 24 * 60 * 60;

/**
 * A4 (auditoria 2026-08-06): janela de deduplicação do `POST /complete`.
 *
 * O endpoint passou a ser escritor de linha durável na Fase 112
 * (`WorkoutSessionLog`) sem nenhum guard de reentrega, então uma 2ª chamada
 * gravava uma **sessão fantasma**: `previousLastCompletedAt` já era o instante
 * da 1ª conclusão, a janela do resumo passava a excluir todas as séries reais,
 * e sobrava uma linha com `volumeKg: 0`/`setsCompleted: 0` — que entra nos
 * gráficos de tendência de `/evolucao` e na distribuição de esforço.
 *
 * Dois caminhos reais levam a isso com o cliente atual: (a) duas abas no mesmo
 * treino — a aba B ainda tem `session` truthy e passa o guard do botão; (b)
 * retry depois de resposta perdida, que é **deliberado** (o fix do Fr1/Fr4
 * preserva a sessão em erro de rede justamente pra não perder a duração).
 *
 * Por que 2 minutos: precisa cobrir com folga um retry humano ou de rede
 * (segundos), e ficar MUITO abaixo do intervalo plausível entre duas sessões
 * legítimas do mesmo treino (o app sugere a próxima LETRA, não repetir a mesma
 * sessão; repetir a mesma no mesmo dia já é incomum, e em menos de 2 min não
 * existe treino real no meio). Não é uma chave de idempotência de verdade —
 * essa exigiria migration e mudança de contrato com o cliente, e está escopada
 * como evolução em `docs/PROXIMAS-FASES-AUDITORIA.md`.
 */
const COMPLETE_DEDUPE_MS = 2 * 60 * 1000;

/**
 * M5 (auditoria 2026-08-06): `durationSeconds` é telemetria OPCIONAL e por
 * isso NUNCA pode derrubar a conclusão do treino — que é a ação central do
 * produto. Antes, um valor negativo respondia 400: se o relógio do aparelho
 * recuasse durante a sessão, o cliente calculava duração negativa, o backend
 * recusava, e o aluno ficava SEM conseguir concluir o treino — o `startedAt`
 * persiste no `localStorage`, então o retry falhava igual, sem fallback pra
 * reenviar sem duração. Isso contradizia a intenção declarada em
 * `completeWorkout` ("Continua opcional (nunca 400 sem ele)... ainda consegue
 * concluir normalmente, só sem duração real registrada").
 *
 * Agora valor inválido é descartado (a conclusão prossegue sem duração) e o
 * anômalo fica observável no log, em vez de virar erro pro usuário.
 */
function sanitizeDurationSeconds(raw: number | null | undefined): number | null {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "number" || !Number.isFinite(raw) || raw < 0 || raw > MAX_DURATION_SECONDS) {
    console.warn(`durationSeconds descartado por estar fora da faixa aceitável: ${String(raw)}`);
    return null;
  }
  return Math.round(raw);
}

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

/**
 * Fase 85 — Aluno Premium edita o PRÓPRIO treino (origin: SELF). Sessão de
 * um programa SELF nunca tem personalId (nulo em lockstep, ver comentário no
 * schema) — checar os dois juntos (não só alunoId) é a mesma defesa
 * explícita já usada em workout-programs.service.ts (origin + dono, nunca só
 * um dos dois).
 */
function assertOwnSelfWorkout(workout: { personalId: string | null; alunoId: string | null } | null, alunoId: string) {
  if (!workout || workout.personalId !== null || workout.alunoId !== alunoId) {
    throw httpError("Treino não encontrado.", 404);
  }
}

// F4 (auditoria 2026-07-31): nada validava `sets`/`restSeconds`/`order`
// numericamente — só o tamanho de `notes`. Negativos/zero passavam direto
// pro Prisma e quebravam a UI de execução de forma sutil (contador
// "0/-3", `VoltageBar` com total negativo, `allSetsDone` nunca fica true).
// C10 (auditoria 2026-07-31): exportada pra ser reaproveitada por
// `admin.service.ts#addExerciseToSelfSession` — mesma validação, mesmo
// achado (negativos/zero sem checagem), domínio diferente (templates
// SELF/catálogo geridos pelo admin, não prescrição do Personal).
export function assertValidExercisePrescription(sets: number, restSeconds: number, order: number, repsRange: string) {
  if (!Number.isInteger(sets) || sets < 1) {
    throw httpError("sets deve ser um número inteiro maior ou igual a 1.", 400);
  }
  if (!Number.isInteger(restSeconds) || restSeconds < 0) {
    throw httpError("restSeconds deve ser um número inteiro maior ou igual a 0.", 400);
  }
  if (!Number.isInteger(order) || order < 0) {
    throw httpError("order deve ser um número inteiro maior ou igual a 0.", 400);
  }
  if (!repsRange?.trim()) {
    throw httpError("repsRange é obrigatório.", 400);
  }
}

async function assertAlunoPremiumAccess(alunoId: string) {
  const entitlement = await alunoPremiumService.getEntitlement(alunoId);
  if (!entitlement.hasAccess) {
    const err = httpError(
      "Editar seu treino pessoal é um recurso do Aluno Premium. Assine ou inicie o teste grátis de 7 dias.",
      402
    ) as any;
    err.code = "PREMIUM_REQUIRED";
    throw err;
  }
}

export const workoutsService = {
  async listWorkoutsForUser(
    userId: string,
    role: "PERSONAL" | "ALUNO" | "NUTRICIONISTA" | "ADMIN",
    adminTarget?: { alunoId?: string; personalId?: string },
    pagination?: { skip: number; take: number }
  ) {
    if (role === "ADMIN") {
      // Admin não tem treinos próprios — visão ampliada de um aluno ou
      // Personal específico, sem assumir a identidade de nenhum dos dois.
      if (adminTarget?.alunoId) {
        return workoutsRepository.findAllByAluno(adminTarget.alunoId, pagination);
      }
      if (adminTarget?.personalId) {
        return workoutsRepository.findAllByPersonal(adminTarget.personalId, pagination);
      }
      return [];
    }
    if (role === "ALUNO") {
      return workoutsRepository.findAllByAluno(userId, pagination);
    }
    return workoutsRepository.findAllByPersonal(userId, pagination);
  },

  async createWorkout(personalId: string, alunoId: string, name: string, letter: string) {
    const relation = await relationsRepository.findByPersonalAndAluno(personalId, alunoId);
    if (!relation) {
      const err = new Error("Aluno não vinculado a este Personal Trainer.");
      (err as any).statusCode = 403;
      throw err;
    }
    // Fase 103: prescrever um treino novo expande o que o aluno recebe —
    // bloqueado quando o Personal está acima do limite do plano além da
    // carência (ver plan-expiry.ts). Checado DEPOIS da existência do
    // vínculo (mensagem de 403 mais específica primeiro).
    await assertPersonalCanPrescribe(personalId);

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
    assertValidExercisePrescription(sets, restSeconds, order, repsRange);

    const workout = await workoutsRepository.findById(workoutId);
    if (!workout || workout.personalId !== personalId) {
      const err = new Error("Treino não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    // Fase 103: adicionar exercício expande a prescrição — mesmo gate de
    // createWorkout acima. moveExercise/deleteExercise abaixo NÃO passam por
    // aqui (reorganizar/remover nunca é bloqueado, mesma filosofia já usada
    // pelo Aluno Premium).
    await assertPersonalCanPrescribe(personalId);

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

  // Fase 65: mesma checagem de posse de moveExercise/addExercise — só o
  // Personal dono do treino pode remover um exercício prescrito.
  async deleteExercise(workoutId: string, personalId: string, workoutExerciseId: string) {
    const workout = await workoutsRepository.findById(workoutId);
    if (!workout || workout.personalId !== personalId) {
      const err = new Error("Treino não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }

    const result = await workoutsRepository.deleteExercise(workoutId, workoutExerciseId);
    if (result === "not_found") {
      const err = new Error("Exercício não encontrado neste treino.");
      (err as any).statusCode = 404;
      throw err;
    }

    return workoutsRepository.findExercisesOrdered(workoutId);
  },

  /**
   * Renomear a sessão ("treino do dia") — nunca existia (achado reportado
   * pelo fundador: nome só era definido na criação). Sem gate de billing:
   * mesma classificação de `moveExercise`/`deleteExercise` (edita/reorganiza,
   * não expande a prescrição).
   */
  async renameWorkout(workoutId: string, personalId: string, name: string) {
    const cleanName = assertValidName(name, "Nome da sessão");
    const workout = await workoutsRepository.findById(workoutId);
    if (!workout || workout.personalId !== personalId) {
      const err = new Error("Treino não encontrado.");
      (err as any).statusCode = 404;
      throw err;
    }
    return workoutsRepository.updateName(workoutId, cleanName);
  },

  // --- Fase 85: Aluno Premium edita o próprio treino (origin: SELF) ---
  // Mesmas regras de `addExercise`/`moveExercise`/`deleteExercise` acima
  // (nunca duplicadas — chamam os MESMOS métodos do repository), só trocando
  // a checagem de posse (SELF + alunoId, não personalId) e acrescentando o
  // gate de Aluno Premium (a própria feature paga).

  async addSelfExercise(
    workoutId: string,
    alunoId: string,
    exerciseId: string,
    sets: number,
    repsRange: string,
    restSeconds: number,
    order: number,
    notes?: string | null
  ) {
    assertValidExercisePrescription(sets, restSeconds, order, repsRange);

    const workout = await workoutsRepository.findById(workoutId);
    assertOwnSelfWorkout(workout, alunoId);
    await assertAlunoPremiumAccess(alunoId);

    const exercise = await exercisesRepository.findById(exerciseId);
    if (!exercise) throw httpError("Exercício não encontrado.", 404);
    if (notes && notes.length > MAX_NOTES_LENGTH) {
      throw httpError(`Observações devem ter no máximo ${MAX_NOTES_LENGTH} caracteres.`, 400);
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

  async moveSelfExercise(workoutId: string, alunoId: string, workoutExerciseId: string, direction: "up" | "down") {
    const workout = await workoutsRepository.findById(workoutId);
    assertOwnSelfWorkout(workout, alunoId);
    await assertAlunoPremiumAccess(alunoId);

    const result = await workoutsRepository.moveExercise(workoutId, workoutExerciseId, direction);
    if (result === "not_found") throw httpError("Exercício não encontrado neste treino.", 404);
    if (result === "first" || result === "last") {
      throw httpError(result === "first" ? "Já é o primeiro exercício." : "Já é o último exercício.", 400);
    }

    return workoutsRepository.findExercisesOrdered(workoutId);
  },

  async deleteSelfExercise(workoutId: string, alunoId: string, workoutExerciseId: string) {
    const workout = await workoutsRepository.findById(workoutId);
    assertOwnSelfWorkout(workout, alunoId);
    await assertAlunoPremiumAccess(alunoId);

    const result = await workoutsRepository.deleteExercise(workoutId, workoutExerciseId);
    if (result === "not_found") throw httpError("Exercício não encontrado neste treino.", 404);

    return workoutsRepository.findExercisesOrdered(workoutId);
  },

  async renameSelfWorkout(workoutId: string, alunoId: string, name: string) {
    const cleanName = assertValidName(name, "Nome da sessão");
    const workout = await workoutsRepository.findById(workoutId);
    assertOwnSelfWorkout(workout, alunoId);
    await assertAlunoPremiumAccess(alunoId);
    return workoutsRepository.updateName(workoutId, cleanName);
  },

  async getWorkout(workoutId: string, userId: string, role: string | undefined, locale: Locale) {
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
    // Achado real (auditoria 2026-07-31, X7): ver comentário equivalente em
    // workout-programs.service.ts#getProgram — o Personal desvinculado
    // perde a leitura deste treino/histórico específico; o histórico do
    // aluno em si nunca é apagado, só a visão do ex-Personal.
    if (workout.personalId === userId && workout.alunoId) {
      const relation = await relationsRepository.findByPersonalAndAluno(workout.personalId, workout.alunoId);
      if (!relation) {
        const err = new Error("Você não tem mais vínculo com este aluno.");
        (err as any).statusCode = 403;
        throw err;
      }
    }
    // Fase 103: só bloqueia a VISÃO DO ALUNO (workout.alunoId === userId) —
    // o próprio Personal (ou admin) continua conseguindo ver o treino que
    // prescreveu mesmo acima do limite (precisa disso pra decidir quem
    // desvincular). `workout.personalId` (não `userId`) é sempre o dono
    // certo a checar, mesmo quando quem está pedindo é o aluno.
    if (workout.alunoId === userId) {
      await assertAlunoWorkoutAccessible(workout.personalId, userId);
    }

    // i18n: tela de execução — a de maior uso do app — mostra nome E
    // descrição do exercício; sem isso, nome/categoria traduzidos ficariam
    // colados a uma descrição só em português.
    return {
      ...workout,
      exercises: await exerciseTranslationService.translateNested(workout.exercises, locale),
    };
  },

  // Fase 16: o aluno marca a sessão como concluída. Só o próprio aluno dono da
  // sessão pode concluir (nem Personal, nem admin — concluir é um ato de
  // execução do aluno).
  //
  // Idempotente dentro de `COMPLETE_DEDUPE_MS` (A4, corrigido na Fase 119).
  // Uma reentrega devolve o `sessionLogId` já existente e o resumo
  // reconstruído com a janela da chamada original, sem criar linha nova em
  // `WorkoutSessionLog` e sem mover `lastCompletedAt` de novo. Fora da janela,
  // duas conclusões são tratadas como duas sessões de verdade — de propósito.
  // Ver o comentário da constante pro racional dos 2 minutos e pra por que
  // isto não é uma chave de idempotência completa.
  //
  // Fase 35: além de concluir, monta o resumo pós-treino (volume, comparação
  // com a sessão anterior, PRs) — precisa capturar o `lastCompletedAt` ANTIGO
  // antes de sobrescrevê-lo, já que ele é a fronteira usada pra separar
  // "séries desta sessão" das de sessões passadas. (A Fase 112 acrescentou o
  // `WorkoutSessionLog` como registro durável de conclusão, mas
  // `workout-summary.service.ts` continua inferindo a janela pelo
  // `lastCompletedAt` + `SESSION_WINDOW_MS` de 6h — a substituição anunciada
  // no schema ainda não aconteceu.)
  // Fase 112: `durationSeconds` opcional — já era calculado 100% no cliente
  // (cronômetro real desde a Fase 89) e nunca chegava aqui; agora é
  // persistido em WorkoutSessionLog junto do resto do resumo, fundação de
  // dado pro dashboard histórico. Continua opcional (nunca 400 sem ele) —
  // um client mais antigo, ou uma sessão sem cronômetro por algum motivo,
  // ainda consegue concluir normalmente, só sem duração real registrada.
  async completeWorkout(workoutId: string, userId: string, durationSeconds?: number | null) {
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
    // Fase 103: mesmo gate de getWorkout acima — aqui sempre é o aluno (a
    // checagem de posse logo acima já garante isso), então não precisa
    // repetir a condição `workout.alunoId === userId`.
    await assertAlunoWorkoutAccessible(workout.personalId, userId);

    // M5: sanitiza em vez de rejeitar — ver `sanitizeDurationSeconds`.
    const normalizedDuration = sanitizeDurationSeconds(durationSeconds);

    // A4 (auditoria 2026-08-06): guard de reentrega. Ver `COMPLETE_DEDUPE_MS`.
    const [ultimaConclusao, penultimaConclusao] =
      await workoutSessionLogRepository.findTwoMostRecentForWorkout(workoutId, userId);
    if (ultimaConclusao && Date.now() - ultimaConclusao.completedAt.getTime() < COMPLETE_DEDUPE_MS) {
      // Reentrega: NÃO cria linha nova e NÃO move `lastCompletedAt` de novo (é
      // mover a fronteira que destrói a janela do resumo). Reconstrói o resumo
      // com a janela que a chamada ORIGINAL usou, pra o cliente ver os números
      // reais em vez de uma sessão vazia.
      const summary = await workoutSummaryService.buildCompletionSummary(
        workout,
        penultimaConclusao?.completedAt ?? null,
        ultimaConclusao.completedAt
      );
      return {
        workout,
        summary: { ...summary, sessionLogId: ultimaConclusao.id },
      };
    }

    const previousLastCompletedAt = workout.lastCompletedAt;
    const completedAt = new Date();

    const summary = await workoutSummaryService.buildCompletionSummary(
      workout,
      previousLastCompletedAt,
      completedAt
    );
    const updatedWorkout = await workoutsRepository.markCompleted(workoutId, completedAt);

    const sessionLog = await workoutSessionLogRepository.create({
      workoutId,
      alunoId: userId,
      startedAt: normalizedDuration !== null ? new Date(completedAt.getTime() - normalizedDuration * 1000) : null,
      completedAt,
      durationSeconds: normalizedDuration,
      volumeKg: summary.volumeKg,
      setsCompleted: summary.setsLogged,
    });

    return { workout: updatedWorkout, summary: { ...summary, sessionLogId: sessionLog.id } };
  },

  // Fase 112: preenchimento OPCIONAL do RPE (Percepção Subjetiva de Esforço,
  // 0-10) depois do resumo pós-treino — nunca bloqueia a conclusão em si
  // (`completeWorkout` acima já terminou antes desta chamada existir), pensado
  // especificamente pro caminho de auto-encerramento por inatividade (onde
  // não há ninguém presente pra responder na hora).
  async setSessionRpe(sessionLogId: string, alunoId: string, rpe: number) {
    if (!Number.isInteger(rpe) || rpe < RPE_MIN || rpe > RPE_MAX) {
      throw httpError(`rpe deve ser um número inteiro entre ${RPE_MIN} e ${RPE_MAX}.`, 400);
    }
    const sessionLog = await workoutSessionLogRepository.findById(sessionLogId);
    if (!sessionLog || sessionLog.alunoId !== alunoId) {
      throw httpError("Sessão não encontrada.", 404);
    }
    return workoutSessionLogRepository.setRpe(sessionLogId, rpe);
  },
};
