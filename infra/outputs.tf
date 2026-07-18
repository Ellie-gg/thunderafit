output "backend_url" {
  description = "URL do Cloud Run do backend (privado — só o frontend pode invocar)."
  value       = google_cloud_run_v2_service.backend.uri
}

output "frontend_url" {
  description = "URL pública do Cloud Run do frontend."
  value       = google_cloud_run_v2_service.frontend.uri
}

output "artifact_registry_repository" {
  description = "Nome do repositório Docker no Artifact Registry."
  value       = google_artifact_registry_repository.thunderafit.repository_id
}

output "backend_service_account" {
  description = "E-mail do service account de runtime do backend."
  value       = google_service_account.backend.email
}

output "frontend_service_account" {
  description = "E-mail do service account de runtime do frontend."
  value       = google_service_account.frontend.email
}

output "exercise_media_bucket" {
  description = "Nome do bucket GCS de mídia de exercícios (vídeo/GIF, Fase 32)."
  value       = google_storage_bucket.exercise_media.name
}
