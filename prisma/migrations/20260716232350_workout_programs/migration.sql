-- Fase 16 — Programas de Treino.
-- Migration ADITIVA e RETROCOMPATÍVEL: cria WorkoutProgram e liga cada Workout
-- existente a um programa de 1 sessão, SEM perder nenhum Workout/
-- WorkoutExercise/SetLog. Ordem: (1) cria a tabela, (2) adiciona colunas novas
-- em Workout como NULLABLE, (3) faz backfill de 1 programa por Workout, (4) só
-- então aplica NOT NULL + FK em programId. Assim nenhum passo falha em tabela
-- com dados (o erro que o `prisma migrate` avisaria ao gerar NOT NULL direto).

-- 1) Nova tabela de programas.
CREATE TABLE "WorkoutProgram" (
    "id" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "alunoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkoutProgram_pkey" PRIMARY KEY ("id")
);

-- 2) Colunas novas em Workout, ainda NULLABLE para não quebrar linhas existentes.
ALTER TABLE "Workout" ADD COLUMN "lastCompletedAt" TIMESTAMP(3);
ALTER TABLE "Workout" ADD COLUMN "programId" TEXT;

-- 3) Backfill: 1 WorkoutProgram (instância, não template) por Workout existente.
--    Mapeia workout->program via tabela temporária com uuids novos, preservando
--    as datas originais do Workout no programa criado.
CREATE TEMP TABLE _prog_map AS
SELECT w.id AS workout_id, gen_random_uuid()::text AS program_id FROM "Workout" w;

INSERT INTO "WorkoutProgram" ("id", "personalId", "name", "isTemplate", "alunoId", "createdAt", "updatedAt")
SELECT m.program_id, w."personalId", w."name", false, w."alunoId", w."createdAt", w."updatedAt"
FROM "Workout" w
JOIN _prog_map m ON m.workout_id = w.id;

UPDATE "Workout" w SET "programId" = m.program_id
FROM _prog_map m WHERE m.workout_id = w.id;

DROP TABLE _prog_map;

-- 4) Agora que todo Workout tem programId, aplica NOT NULL + FK.
ALTER TABLE "Workout" ALTER COLUMN "programId" SET NOT NULL;
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_programId_fkey" FOREIGN KEY ("programId") REFERENCES "WorkoutProgram"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
