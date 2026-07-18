-- CreateEnum
CREATE TYPE "SessionScheme" AS ENUM ('LETTER', 'WEEKDAY');

-- AlterTable
ALTER TABLE "WorkoutProgram" ADD COLUMN     "sessionScheme" "SessionScheme" NOT NULL DEFAULT 'LETTER';
