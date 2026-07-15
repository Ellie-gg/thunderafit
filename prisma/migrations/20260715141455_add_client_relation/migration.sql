-- CreateEnum
CREATE TYPE "ProfessionalType" AS ENUM ('PERSONAL', 'NUTRICIONISTA');

-- CreateTable
CREATE TABLE "ClientRelation" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "professionalType" "ProfessionalType" NOT NULL DEFAULT 'PERSONAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClientRelation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientRelation_personalId_alunoId_key" ON "ClientRelation"("personalId", "alunoId");
