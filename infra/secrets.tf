# Só os *containers* dos secrets vivem aqui — nenhum
# google_secret_manager_secret_version de propósito. Os valores reais (JWT
# secrets, connection string pooled do Neon) NUNCA devem passar pelo plan ou
# pelo state do Terraform; são adicionados à mão via
# `gcloud secrets versions add` (ver infra/README.md). Cloud Run sempre lê
# a versão "latest", então rotacionar um secret não exige terraform apply.

resource "google_secret_manager_secret" "jwt_secret" {
  project   = var.project_id
  secret_id = "jwt-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "jwt_refresh_secret" {
  project   = var.project_id
  secret_id = "jwt-refresh-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "database_url" {
  project   = var.project_id
  secret_id = "database-url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}
