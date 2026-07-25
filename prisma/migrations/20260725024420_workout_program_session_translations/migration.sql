-- CreateTable
CREATE TABLE "WorkoutProgramTranslation" (
    "id" TEXT NOT NULL,
    "workoutProgramId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutProgramTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkoutTranslation" (
    "id" TEXT NOT NULL,
    "workoutId" TEXT NOT NULL,
    "locale" "Locale" NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutTranslation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutProgramTranslation_workoutProgramId_locale_key" ON "WorkoutProgramTranslation"("workoutProgramId", "locale");

-- CreateIndex
CREATE UNIQUE INDEX "WorkoutTranslation_workoutId_locale_key" ON "WorkoutTranslation"("workoutId", "locale");

-- AddForeignKey
ALTER TABLE "WorkoutProgramTranslation" ADD CONSTRAINT "WorkoutProgramTranslation_workoutProgramId_fkey" FOREIGN KEY ("workoutProgramId") REFERENCES "WorkoutProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkoutTranslation" ADD CONSTRAINT "WorkoutTranslation_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
