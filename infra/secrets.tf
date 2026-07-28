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

# Fase 83 — Resend (troca do Gmail SMTP da Fase 78, agora que
# thunderafit.com.br está verificado lá). Valor real adicionado à mão via
# `gcloud secrets versions add resend-api-key`, mesmo padrão dos secrets
# acima.
resource "google_secret_manager_secret" "resend_api_key" {
  project   = var.project_id
  secret_id = "resend-api-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

# Fase 87 — Stripe (ativação da monetização). Valores reais (test mode por
# enquanto) adicionados à mão via `gcloud secrets versions add
# stripe-secret-key` / `stripe-webhook-secret`, mesmo padrão dos secrets
# acima — nunca passam pelo plan/state do Terraform.
resource "google_secret_manager_secret" "stripe_secret_key" {
  project   = var.project_id
  secret_id = "stripe-secret-key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}

resource "google_secret_manager_secret" "stripe_webhook_secret" {
  project   = var.project_id
  secret_id = "stripe-webhook-secret"

  replication {
    auto {}
  }

  depends_on = [google_project_service.apis]
}
