-- CreateEnum
CREATE TYPE "ExerciseMediaType" AS ENUM ('YOUTUBE', 'VIDEO', 'GIF');

-- AlterTable
ALTER TABLE "Exercise" ADD COLUMN     "mediaType" "ExerciseMediaType" NOT NULL DEFAULT 'YOUTUBE';
