-- CreateTable
CREATE TABLE "ConnectionMessage" (
    "id" TEXT NOT NULL,
    "connectionRequestId" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConnectionMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConnectionMessage_connectionRequestId_createdAt_idx" ON "ConnectionMessage"("connectionRequestId", "createdAt");

-- AddForeignKey
ALTER TABLE "ConnectionMessage" ADD CONSTRAINT "ConnectionMessage_connectionRequestId_fkey" FOREIGN KEY ("connectionRequestId") REFERENCES "ConnectionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
