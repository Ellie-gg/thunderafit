-- CreateTable
CREATE TABLE "ClientInvite" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "professionalType" "ProfessionalType" NOT NULL DEFAULT 'PERSONAL',
    "label" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TIMESTAMP(3),
    "consumedByAlunoId" TEXT,

    CONSTRAINT "ClientInvite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientInvite_tokenHash_key" ON "ClientInvite"("tokenHash");

-- CreateIndex
CREATE INDEX "ClientInvite_personalId_idx" ON "ClientInvite"("personalId");

