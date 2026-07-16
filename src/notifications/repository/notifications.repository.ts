import prisma from "../../lib/prisma";

export const notificationsRepository = {
  async create(userId: string, type: string, message: string) {
    return prisma.notification.create({ data: { userId, type, message } });
  },

  async findAllByUser(userId: string) {
    return prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
  },

  async countUnread(userId: string) {
    return prisma.notification.count({ where: { userId, read: false } });
  },

  async findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  },

  async markRead(id: string) {
    return prisma.notification.update({ where: { id }, data: { read: true } });
  },

  async markAllRead(userId: string) {
    return prisma.notification.updateMany({ where: { userId, read: false }, data: { read: true } });
  },
};
