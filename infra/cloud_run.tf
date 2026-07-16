resource "google_service_account" "backend" {
  project      = var.project_id
  account_id   = "thunderafit-backend"
  display_name = "ThunderaFit backend (Cloud Run runtime)"
}

resource "google_service_account" "frontend" {
  project      = var.project_id
  account_id   = "thunderafit-frontend"
  display_name = "ThunderaFit frontend (Cloud Run runtime)"
}

resource "google_cloud_run_v2_service" "backend" {
  project  = var.project_id
  location = var.region
  name     = "thunderafit-backend"

  # Ingress público, mas SEM invoker allUsers (ver iam.tf) — só o service
  # account do frontend pode chamar. Não é "internal ingress" (não precisa
  # de VPC connector); é autenticação exigida na invocação.
  ingress = "INGRESS_TRAFFIC_ALL"

  # O provider do Google por padrão protege serviços Cloud Run contra
  # terraform destroy (deletion_protection = true) — direto contra o
  # objetivo explícito do fundador de "remover facilmente" o ambiente.
  # Desligado de propósito nos dois serviços.
  deletion_protection = false

  template {
    service_account = google_service_account.backend.email

    # Explícito (não só "no default") porque a API do Cloud Run sempre
    # devolve esse bloco preenchido com 0/0 mesmo sem defini-lo — deixar
    # implícito causa um diff perpétuo no plan (drift real observado no
    # bootstrap). min_instance_count=0 é scale-to-zero, dentro do free
    # tier — NÃO subir isso "pra evitar cold start" sem querer começar a
    # pagar.
    scaling {
      min_instance_count = 0
    }

    containers {
      # Placeholder até o primeiro deploy real via Cloud Build (o trigger em
      # cloudbuild.tf substitui essa imagem). O lifecycle abaixo impede o
      # Terraform de tentar reverter para o placeholder em applies futuros.
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      env {
        name  = "ALLOWED_ORIGIN"
        value = var.allowed_origin
      }
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "JWT_REFRESH_SECRET"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.jwt_refresh_secret.secret_id
            version = "latest"
          }
        }
      }
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.database_url.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  lifecycle {
    # Dois quirks reais do provider/API do Cloud Run confirmados durante o
    # bootstrap, nenhum dos dois reflete uma diferença de infra de verdade
    # (confirmado via `gcloud run services describe` — minScale=0 já está
    # aplicado nos dois serviços):
    #   - `scaling` no nível raiz (fora de `template`) é computed e a API
    #     sempre devolve preenchido mesmo sem eu declarar — gera diff
    #     perpétuo de remoção.
    #   - `template[0].scaling.min_instance_count = 0` (o valor default) não
    #     "gruda" de volta na leitura da API — gera diff perpétuo de adição,
    #     mesmo já estando aplicado.
    ignore_changes = [template[0].containers[0].image, scaling, template[0].scaling]
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloud_run_v2_service" "frontend" {
  project             = var.project_id
  location            = var.region
  name                = "thunderafit-frontend"
  ingress             = "INGRESS_TRAFFIC_ALL"
  deletion_protection = false

  template {
    service_account = google_service_account.frontend.email

    scaling {
      min_instance_count = 0
    }

    containers {
      image = "us-docker.pkg.dev/cloudrun/container/hello"

      env {
        name  = "NODE_ENV"
        value = "production"
      }
      # server-only — nunca prefixado com NEXT_PUBLIC_ (ver route.ts do
      # proxy). A URL do backend é estável entre deploys do mesmo serviço,
      # então isso não precisa mudar depois do bootstrap inicial.
      env {
        name  = "BACKEND_URL"
        value = google_cloud_run_v2_service.backend.uri
      }
    }
  }

  lifecycle {
    # Dois quirks reais do provider/API do Cloud Run confirmados durante o
    # bootstrap, nenhum dos dois reflete uma diferença de infra de verdade
    # (confirmado via `gcloud run services describe` — minScale=0 já está
    # aplicado nos dois serviços):
    #   - `scaling` no nível raiz (fora de `template`) é computed e a API
    #     sempre devolve preenchido mesmo sem eu declarar — gera diff
    #     perpétuo de remoção.
    #   - `template[0].scaling.min_instance_count = 0` (o valor default) não
    #     "gruda" de volta na leitura da API — gera diff perpétuo de adição,
    #     mesmo já estando aplicado.
    ignore_changes = [template[0].containers[0].image, scaling, template[0].scaling]
  }

  depends_on = [google_project_service.apis]
}
