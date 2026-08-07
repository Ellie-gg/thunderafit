import { Role } from "@prisma/client";
import { bodyRepository } from "../repository/body.repository";

function httpError(message: string, statusCode: number) {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

// Tetos de sanidade. Não são regra clínica — só barram digitação claramente
// errada (vírgula no lugar do ponto, campo trocado) antes de virar um ponto
// absurdo no gráfico. Mesma filosofia de `MAX_DURATION_SECONDS` na Fase 119:
// validar o impossível, não opinar sobre o plausível.
const MIN_WEIGHT_KG = 20;
const MAX_WEIGHT_KG = 400;
const MIN_WAIST_CM = 30;
const MAX_WAIST_CM = 250;
const MAX_BODY_FAT_PCT = 75;

/** Quantas medições a tela carrega — a série é pra gráfico, não pra auditoria. */
const DEFAULT_TAKE = 60;
const MAX_TAKE = 200;

function parseNumber(value: unknown, campo: string, { min, max }: { min: number; max: number }): number {
  const n = typeof value === "string" ? Number(value.replace(",", ".")) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw httpError(`${campo} deve ser um número.`, 400);
  }
  if (n < min || n > max) {
    throw httpError(`${campo} deve estar entre ${min} e ${max}.`, 400);
  }
  // 1 decimal: é a precisão real de balança/fita, e evita 72.34999999 no gráfico.
  return Math.round(n * 10) / 10;
}

function parseOptional(
  value: unknown,
  campo: string,
  faixa: { min: number; max: number }
): number | null {
  if (value === undefined || value === null || value === "") return null;
  return parseNumber(value, campo, faixa);
}

export interface BodyMeasurementInput {
  measuredAt?: string;
  weightKg?: unknown;
  waistCm?: unknown;
  bodyFatPercent?: unknown;
}

/**
 * Fase 121: histórico de medições corporais.
 *
 * Existe porque `Anamnesis` é `alunoId @unique` — um snapshot sobrescrito, sem
 * série temporal. O app media progressão de CARGA com riqueza e não tinha nada
 * da progressão CORPORAL.
 *
 * Autorização espelha a Anamnesis (`src/anamnesis/services/anamnesis.service.ts`)
 * na LEITURA: o aluno lê a própria, o profissional lê a de um aluno vinculado.
 * Na ESCRITA vai além dela de propósito — decisão do fundador nesta fase: o
 * Personal também REGISTRA, porque a avaliação presencial (fita métrica,
 * adipômetro) é feita por ele, e obrigar o aluno a digitar o que o profissional
 * mediu é fricção sem motivo.
 */
export const bodyService = {
  /**
   * Resolve de QUEM são as medições e se `requesterId` pode vê-las. Devolve o
   * `alunoId` efetivo — mesmo formato de `assertAluno` do domínio progress, pra
   * não inventar um segundo jeito de fazer a mesma coisa.
   */
  async resolveAlunoId(
    requesterId: string,
    role: Role,
    alunoIdParam?: string
  ): Promise<string> {
    if (role === "ALUNO") {
      // Ignora `alunoId` da query de propósito: um aluno nunca lê medição de
      // outro, nem por engano de cliente.
      return requesterId;
    }
    if (!alunoIdParam) {
      throw httpError("alunoId é obrigatório para este perfil.", 400);
    }
    if (role === "ADMIN") return alunoIdParam;

    const relation = await bodyRepository.findRelation(requesterId, alunoIdParam);
    if (!relation) {
      throw httpError("Aluno não vinculado a este profissional.", 403);
    }
    return alunoIdParam;
  },

  async list(requesterId: string, role: Role, alunoIdParam: string | undefined, take?: number) {
    const alunoId = await this.resolveAlunoId(requesterId, role, alunoIdParam);
    const limite = Number.isFinite(take) && (take as number) > 0 ? Math.min(take as number, MAX_TAKE) : DEFAULT_TAKE;
    const rows = await bodyRepository.listForAluno(alunoId, limite);
    return {
      measurements: rows.map((m) => ({
        id: m.id,
        measuredAt: m.measuredAt.toISOString(),
        weightKg: m.weightKg,
        waistCm: m.waistCm,
        bodyFatPercent: m.bodyFatPercent,
        recordedByRole: m.recordedByRole,
      })),
    };
  },

  async create(
    requesterId: string,
    role: Role,
    alunoIdParam: string | undefined,
    input: BodyMeasurementInput
  ) {
    const alunoId = await this.resolveAlunoId(requesterId, role, alunoIdParam);

    const weightKg = parseNumber(input.weightKg, "Peso (kg)", {
      min: MIN_WEIGHT_KG,
      max: MAX_WEIGHT_KG,
    });
    const waistCm = parseOptional(input.waistCm, "Cintura (cm)", {
      min: MIN_WAIST_CM,
      max: MAX_WAIST_CM,
    });
    const bodyFatPercent = parseOptional(input.bodyFatPercent, "Gordura (%)", {
      min: 1,
      max: MAX_BODY_FAT_PCT,
    });

    // Data ausente = agora. Data no FUTURO é recusada (medição é registro de
    // algo que aconteceu); retroativa é permitida, é o caso de uso normal de
    // quem lança a avaliação de ontem.
    const measuredAt = input.measuredAt ? new Date(input.measuredAt) : new Date();
    if (Number.isNaN(measuredAt.getTime())) {
      throw httpError("Data da medição inválida.", 400);
    }
    if (measuredAt.getTime() > Date.now() + 60_000) {
      throw httpError("Data da medição não pode ser no futuro.", 400);
    }

    const created = await bodyRepository.create({
      alunoId,
      measuredAt,
      weightKg,
      waistCm,
      bodyFatPercent,
      recordedByRole: role,
      recordedByUserId: requesterId,
    });
    return {
      measurement: {
        id: created.id,
        measuredAt: created.measuredAt.toISOString(),
        weightKg: created.weightKg,
        waistCm: created.waistCm,
        bodyFatPercent: created.bodyFatPercent,
        recordedByRole: created.recordedByRole,
      },
    };
  },

  /**
   * Exclui uma medição. Quem pode: o próprio aluno (é dado dele), ou um
   * profissional vinculado ao aluno da medição. 404 genérico quando não achou
   * OU não tem acesso — nunca confirma que o id existe.
   */
  async remove(requesterId: string, role: Role, measurementId: string) {
    const m = await bodyRepository.findById(measurementId);
    if (!m) throw httpError("Medição não encontrada.", 404);

    if (role === "ALUNO") {
      if (m.alunoId !== requesterId) throw httpError("Medição não encontrada.", 404);
    } else if (role !== "ADMIN") {
      const relation = await bodyRepository.findRelation(requesterId, m.alunoId);
      if (!relation) throw httpError("Medição não encontrada.", 404);
    }

    await bodyRepository.delete(measurementId);
    return { ok: true as const };
  },
};
