import { FastifyRequest, FastifyReply } from "fastify";
import { usersService } from "../services/users.service";

export async function lookupUserHandler(
  request: FastifyRequest<{ Querystring: { email?: string } }>,
  reply: FastifyReply
) {
  const { email } = request.query;

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
