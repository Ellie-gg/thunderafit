import { FastifyRequest, FastifyReply } from "fastify";
import { usersService } from "../services/users.service";

export async function lookupUserHandler(
  request: FastifyRequest<{ Querystring: { email?: string } }>,
  reply: FastifyReply
) {
  const { email } = request.query;

  // Fase 17 (Item 4 — auditoria): lookup por e-mail existe para o profissional
  // encontrar um aluno a vincular. Sem restrição de role, qualquer usuário
  // autenticado (inclusive um ALUNO) poderia enumerar contas por e-mail e
  // obter o id de outro aluno — fechado aqui para PERSONAL/NUTRICIONISTA.
  const role = (request as any).user?.role;
  if (role !== "PERSONAL" && role !== "NUTRICIONISTA") {
    return reply.status(403).send({ error: "Apenas profissionais podem buscar alunos." });
  }

  if (!email) {
    return reply.status(400).send({ error: "email é obrigatório." });
  }

  try {
    const user = await usersService.lookupAlunoByEmail(email);
    return reply.status(200).send({ user });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}
