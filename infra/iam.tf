# Frontend é público — qualquer um pode invocar (é a única porta de entrada
# real do produto).
resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# Backend NÃO é público (decisão da Fase de deploy: dados de saúde/anamnese
# não podem ficar atrás de uma URL anônima) — só o service account do
# frontend pode invocá-lo. O proxy em frontend/app/api/[...path]/route.ts
# anexa o token de identidade correspondente quando roda no Cloud Run.
resource "google_cloud_run_v2_service_iam_member" "backend_frontend_only" {
  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${google_service_account.frontend.email}"
}

# Cada service account só acessa os secrets que o próprio serviço precisa
# (o frontend não precisa de nenhum destes três).
resource "google_secret_manager_secret_iam_member" "backend_jwt_secret" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.jwt_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "backend_jwt_refresh_secret" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.jwt_refresh_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}

resource "google_secret_manager_secret_iam_member" "backend_database_url" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.database_url.secret_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.backend.email}"
}
