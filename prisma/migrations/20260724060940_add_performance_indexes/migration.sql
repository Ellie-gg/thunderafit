-- CreateIndex
CREATE INDEX "ClientRelation_alunoId_idx" ON "ClientRelation"("alunoId");

-- CreateIndex
CREATE INDEX "ConnectionRequest_alunoId_createdAt_idx" ON "ConnectionRequest"("alunoId", "createdAt");

-- CreateIndex
CREATE INDEX "ConnectionRequest_professionalId_createdAt_idx" ON "ConnectionRequest"("professionalId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");

-- CreateIndex
CREATE INDEX "SetLog_workoutExerciseId_loggedAt_idx" ON "SetLog"("workoutExerciseId", "loggedAt");

-- CreateIndex
CREATE INDEX "SupportThread_alunoId_updatedAt_idx" ON "SupportThread"("alunoId", "updatedAt");

-- CreateIndex
CREATE INDEX "SupportThread_personalId_updatedAt_idx" ON "SupportThread"("personalId", "updatedAt");

-- CreateIndex
CREATE INDEX "Workout_alunoId_createdAt_idx" ON "Workout"("alunoId", "createdAt");

-- CreateIndex
CREATE INDEX "Workout_personalId_createdAt_idx" ON "Workout"("personalId", "createdAt");

-- CreateIndex
CREATE INDEX "Workout_programId_idx" ON "Workout"("programId");

-- CreateIndex
CREATE INDEX "WorkoutProgram_personalId_createdAt_idx" ON "WorkoutProgram"("personalId", "createdAt");

-- CreateIndex
CREATE INDEX "WorkoutProgram_alunoId_createdAt_idx" ON "WorkoutProgram"("alunoId", "createdAt");

-- CreateIndex
CREATE INDEX "users_role_availableForNewStudents_idx" ON "users"("role", "availableForNewStudents");
