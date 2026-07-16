resource "google_artifact_registry_repository" "thunderafit" {
  project       = var.project_id
  location      = var.region
  repository_id = "thunderafit"
  format        = "DOCKER"
  description   = "Imagens Docker do backend e frontend do ThunderaFit."

  # Sem isso, cada push acumula uma imagem nova para sempre — free tier do
  # Artifact Registry é pequeno (flagrado como risco real na fase de design).
  cleanup_policies {
    id     = "keep-last-10"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-older-than-30d"
    action = "DELETE"
    condition {
      older_than = "2592000s" # 30 dias
    }
  }

  depends_on = [google_project_service.apis]
}
