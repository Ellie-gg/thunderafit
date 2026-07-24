-- AlterTable
ALTER TABLE "ClientRelation" ADD COLUMN     "paymentReminderDueDate" TIMESTAMP(3),
ADD COLUMN     "paymentReminderRecurring" BOOLEAN NOT NULL DEFAULT false;
