-- Fase 21 (descoberta de profissionais). Aditiva.

-- Perfil público mínimo no User (opt-in).
ALTER TABLE "users" ADD COLUMN "availableForNewStudents" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "users" ADD COLUMN "location" TEXT;
ALTER TABLE "users" ADD COLUMN "bio" TEXT;

-- Solicitação de vínculo com aprovação manual (status PENDENTE/ACEITA/RECUSADA).
CREATE TYPE "ConnectionRequestStatus" AS ENUM ('PENDENTE', 'ACEITA', 'RECUSADA');

CREATE TABLE "ConnectionRequest" (
    "id" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "professionalId" TEXT NOT NULL,
    "professionalType" "ProfessionalType" NOT NULL DEFAULT 'PERSONAL',
    "status" "ConnectionRequestStatus" NOT NULL DEFAULT 'PENDENTE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConnectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConnectionRequest_alunoId_professionalId_key"
    ON "ConnectionRequest"("alunoId", "professionalId");
