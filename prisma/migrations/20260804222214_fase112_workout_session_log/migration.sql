-- CreateTable
CREATE TABLE "WorkoutSessionLog" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "alunoId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "durationSeconds" INTEGER,
    "volumeKg" DOUBLE PRECISION NOT NULL,
    "setsCompleted" INTEGER NOT NULL,
    "rpe" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkoutSessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WorkoutSessionLog_alunoId_completedAt_idx" ON "WorkoutSessionLog"("alunoId", "completedAt");

-- CreateIndex
CREATE INDEX "WorkoutSessionLog_workoutId_completedAt_idx" ON "WorkoutSessionLog"("workoutId", "completedAt");

-- AddForeignKey
ALTER TABLE "WorkoutSessionLog" ADD CONSTRAINT "WorkoutSessionLog_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
