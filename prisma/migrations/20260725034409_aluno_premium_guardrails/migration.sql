-- CreateEnum
CREATE TYPE "AlunoPremiumStatus" AS ENUM ('NONE', 'TRIAL', 'ACTIVE', 'CANCELED');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "alunoPremiumExpiresAt" TIMESTAMP(3),
ADD COLUMN     "alunoPremiumStatus" "AlunoPremiumStatus" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "alunoTrialUsedAt" TIMESTAMP(3),
ADD COLUMN     "stripeAlunoSubscriptionId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeAlunoSubscriptionId_key" ON "users"("stripeAlunoSubscriptionId");
