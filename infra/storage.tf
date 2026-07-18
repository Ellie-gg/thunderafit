# Fase 32: bucket GCS público (read-only) para vídeo/GIF de exercícios.
# Link do YouTube não usa isso — só vídeo/GIF nativo, que o backend sobe via
# src/lib/storage.ts com Application Default Credentials (service account do
# Cloud Run em produção, sem chave de arquivo no repo).
resource "google_storage_bucket" "exercise_media" {
  project                     = var.project_id
  name                        = "${var.project_id}-exercise-media"
  location                    = var.region
  uniform_bucket_level_access = true

  # Objetos de mídia de exercício são conteúdo de catálogo público (nenhum
  # dado de aluno/anamnese) — igual ao propósito de fotos de exercício em
  # qualquer app de treino. Sem isso, cada mediaUrl exigiria signed URL, o
  # que não compensa pra um asset que já é público por natureza.
  force_destroy = true
}

resource "google_storage_bucket_iam_member" "exercise_media_public_read" {
  bucket = google_storage_bucket.exercise_media.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}

# Só o backend sobe mídia (rota admin autenticada) — o frontend nunca
# escreve direto no bucket.
resource "google_storage_bucket_iam_member" "exercise_media_backend_writer" {
  bucket = google_storage_bucket.exercise_media.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.backend.email}"
}
