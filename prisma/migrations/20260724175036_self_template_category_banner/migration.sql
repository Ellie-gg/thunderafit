-- CreateEnum
CREATE TYPE "SelfTemplateCategory" AS ENUM ('GERAL', 'HOME', 'PREMIUM');

-- AlterTable
ALTER TABLE "WorkoutProgram" ADD COLUMN     "bannerImageUrl" TEXT,
ADD COLUMN     "category" "SelfTemplateCategory" NOT NULL DEFAULT 'GERAL';
