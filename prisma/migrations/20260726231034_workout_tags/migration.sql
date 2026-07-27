-- CreateEnum
CREATE TYPE "WorkoutTag" AS ENUM ('FEMININO', 'HIPERTROFIA', 'DEFINICAO', 'EXPRESS');

-- AlterTable
ALTER TABLE "WorkoutProgram" ADD COLUMN     "tags" "WorkoutTag"[] DEFAULT ARRAY[]::"WorkoutTag"[];
