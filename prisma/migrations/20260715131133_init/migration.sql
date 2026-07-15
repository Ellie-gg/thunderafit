-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PERSONAL', 'ALUNO');

-- CreateEnum
CREATE TYPE "PlanoAssinatura" AS ENUM ('FREE', 'PAGO');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "refreshTokenHash" TEXT,
    "planoAssinatura" "PlanoAssinatura" NOT NULL DEFAULT 'FREE',
    "limiteAlunos" INTEGER NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
