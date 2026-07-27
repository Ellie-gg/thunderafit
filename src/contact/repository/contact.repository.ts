import prisma from "../../lib/prisma";
import { Role } from "@prisma/client";

export const contactRepository = {
  create(data: { userId: string; role: Role; title: string; message: string }) {
    return prisma.contactMessage.create({ data });
  },

  markEmailSent(id: string) {
    return prisma.contactMessage.update({ where: { id }, data: { emailSentAt: new Date() } });
  },
};
