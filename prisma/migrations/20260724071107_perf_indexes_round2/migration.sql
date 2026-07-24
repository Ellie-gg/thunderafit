-- CreateIndex
CREATE INDEX "AdminAccessLog_createdAt_idx" ON "AdminAccessLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminAuditLog_createdAt_idx" ON "AdminAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "LoginLog_createdAt_idx" ON "LoginLog"("createdAt");

-- CreateIndex
CREATE INDEX "SupportMessage_threadId_idx" ON "SupportMessage"("threadId");

-- CreateIndex
CREATE INDEX "SupportThread_status_createdAt_idx" ON "SupportThread"("status", "createdAt");

-- CreateIndex
CREATE INDEX "WorkoutExercise_workoutId_idx" ON "WorkoutExercise"("workoutId");

-- CreateIndex
CREATE INDEX "WorkoutExercise_exerciseId_idx" ON "WorkoutExercise"("exerciseId");

-- CreateIndex
CREATE INDEX "users_createdAt_idx" ON "users"("createdAt");
