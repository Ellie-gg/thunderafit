import { FastifyRequest, FastifyReply } from "fastify";
import { notificationsService } from "../services/notifications.service";

export async function listNotificationsHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).user.sub;
  const notifications = await notificationsService.listForUser(userId);
  return reply.status(200).send({ notifications });
}

export async function unreadCountHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).user.sub;
  const count = await notificationsService.unreadCount(userId);
  return reply.status(200).send({ count });
}

export async function markReadHandler(
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply
) {
  const userId = (request as any).user.sub;
  const { id } = request.params;
  try {
    const notification = await notificationsService.markRead(id, userId);
    return reply.status(200).send({ notification });
  } catch (err: any) {
    const status = (err as any).statusCode ?? 500;
    return reply.status(status).send({ error: err.message });
  }
}

export async function markAllReadHandler(request: FastifyRequest, reply: FastifyReply) {
  const userId = (request as any).user.sub;
  await notificationsService.markAllRead(userId);
  return reply.status(200).send({ ok: true });
}
