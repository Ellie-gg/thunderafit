import { FastifyRequest, FastifyReply } from "fastify";
import { dashboardService } from "../services/dashboard.service";
import { resolveRequestLocale } from "../../lib/locale";

function handleError(err: any, reply: FastifyReply) {
  const status = err.statusCode ?? 500;
  return reply.status(status).send({ error: err.message });
}

export async function getAlunoDashboardHandler(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { sub, role } = (request as any).user;
    if (role !== "ALUNO") {
      const err = new Error("Somente Aluno pode acessar este resumo.");
      (err as any).statusCode = 403;
      throw err;
    }
    const summary = await dashboardService.getAlunoSummary(sub, resolveRequestLocale(request));
    return reply.status(200).send(summary);
  } catch (err: any) {
    return handleError(err, reply);
  }
}
