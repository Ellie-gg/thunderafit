-- CreateEnum
CREATE TYPE "WorkoutProgramOrigin" AS ENUM ('PERSONAL', 'SELF');

-- AlterTable
ALTER TABLE "Workout" ALTER COLUMN "personalId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "WorkoutProgram" ADD COLUMN     "origin" "WorkoutProgramOrigin" NOT NULL DEFAULT 'PERSONAL',
ALTER COLUMN "personalId" DROP NOT NULL;
