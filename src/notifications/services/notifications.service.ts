import { notificationsRepository } from "../repository/notifications.repository";

/**
 * Só notificação in-app (sino) nesta fase. Push real (APNs/FCM) fica fora de
 * escopo — dependência de infraestrutura pesada (serviço externo, chaves de
 * plataforma, tratamento de token de device) que não faz sentido antecipar
 * antes de existir um cliente mobile de verdade (Capacitor, roadmap futuro).
 * Quando isso acontecer, este service é o ponto natural de extensão: um
 * `notify()` chamaria tanto `create()` (in-app) quanto um novo dispatcher de
 * push, sem mudar quem chama `notify()` hoje.
 */
export const notificationsService = {
  async notify(userId: string, type: string, message: string) {
    return notificationsRepository.create(userId, type, message);
  },

  async listForUser(userId: string) {
    return notificationsRepository.findAllByUser(userId);
  },

  async unreadCount(userId: string) {
    return notificationsRepository.countUnread(userId);
  },

  async markRead(notificationId: string, userId: string) {
    const notification = await notificationsRepository.findById(notificationId);
    if (!notification || notification.userId !== userId) {
      const err = new Error("Notificação não encontrada.");
      (err as any).statusCode = 404;
      throw err;
    }
    return notificationsRepository.markRead(notificationId);
  },

  async markAllRead(userId: string) {
    await notificationsRepository.markAllRead(userId);
  },
};
