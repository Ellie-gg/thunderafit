-- CreateEnum
CREATE TYPE "DifficultyLevel" AS ENUM ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "difficultyLevel" "DifficultyLevel" NOT NULL DEFAULT 'INTERMEDIARIO';
