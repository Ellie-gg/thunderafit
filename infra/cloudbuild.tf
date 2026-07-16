# Descoberta real durante o bootstrap: o assistente "Set up Continuous
# Deployment" do Cloud Run NÃO usa o mecanismo cloudbuildv2 (connection +
# repository de 2ª geração) — ele cria triggers no formato clássico/1ª
# geração, com um bloco `github { owner, name, push.branch }` direto,
# sem nenhum recurso de "connection" separado (confirmado via
# `gcloud builds connections list` retornando 0 itens). A autorização do
# GitHub App fica inteiramente do lado do Google, amarrada ao projeto — não
# existe um `installation_id`/token que o Terraform precise referenciar.
#
# Por isso, ao contrário do design original (que assumia cloudbuildv2 +
# import em 2 fases), os dois triggers abaixo são definidos direto no
# formato clássico e importados uma única vez, depois que os dois serviços
# já tiverem sido conectados uma vez via console (ver infra/README.md,
# seção "Conectar o GitHub") — esse passo manual só autoriza o GitHub App
# no projeto; o binding real do trigger é Terraform desde o import em
# diante.
#
# included_files filtra por caminho para que um push que só mexe no
# backend não rebuilde o frontend, e vice-versa (útil num monorepo). Só
# dispara no push em `main` (produção) — `dev` não tem deploy automático.
resource "google_cloudbuild_trigger" "backend" {
  project     = var.project_id
  location    = "global"
  name        = "rmgpgab-thunderafit-backend-us-central1-Ellie-gg-thunderafitsya"
  description = "Build and deploy to Cloud Run service thunderafit-backend on push to \"^main$\""

  github {
    owner = var.github_owner
    name  = var.github_repo
    push {
      branch = "^main$"
    }
  }

  included_files = [
    "src/**",
    "prisma/**",
    "docker/start-backend.sh",
    "package.json",
    "package-lock.json",
    "Dockerfile",
    "tsconfig.json",
  ]

  service_account = "projects/${var.project_id}/serviceAccounts/${data.google_project.current.number}-compute@developer.gserviceaccount.com"

  build {
    step {
      id   = "Build"
      name = "gcr.io/cloud-builders/docker"
      args = [
        "build", "--no-cache", "-t",
        "$_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$_SERVICE_NAME:$COMMIT_SHA",
        ".", "-f", "Dockerfile",
      ]
    }
    step {
      id   = "Push"
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "$_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$_SERVICE_NAME:$COMMIT_SHA",
      ]
    }
    step {
      id         = "Deploy"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk:slim"
      entrypoint = "gcloud"
      args = [
        "run", "services", "update", "$_SERVICE_NAME",
        "--platform=managed",
        "--image=$_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$_SERVICE_NAME:$COMMIT_SHA",
        "--region=$_DEPLOY_REGION",
        "--quiet",
      ]
    }
    images = [
      "$_AR_HOSTNAME/$_AR_PROJECT_ID/$_AR_REPOSITORY/$_SERVICE_NAME:$COMMIT_SHA",
    ]
    options {
      logging             = "CLOUD_LOGGING_ONLY"
      substitution_option = "ALLOW_LOOSE"
    }
    substitutions = {
      _AR_HOSTNAME   = "${var.region}-docker.pkg.dev"
      _AR_PROJECT_ID = var.project_id
      _AR_REPOSITORY = google_artifact_registry_repository.thunderafit.repository_id
      _DEPLOY_REGION = var.region
      _PLATFORM      = "managed"
      _SERVICE_NAME  = google_cloud_run_v2_service.backend.name
    }
  }

  depends_on = [google_project_service.apis]
}

resource "google_cloudbuild_trigger" "frontend" {
  project     = var.project_id
  location    = "global"
  name        = "rmgpgab-thunderafit-frontend-us-central1-Ellie-gg-thunderafihms"
  description = "Build and deploy to Cloud Run service thunderafit-frontend on push to \"^main$\""

  github {
    owner = var.github_owner
    name  = var.github_repo
    push {
      branch = "^main$"
    }
  }

  included_files = ["frontend/**"]

  service_account = "projects/${var.project_id}/serviceAccounts/${data.google_project.current.number}-compute@developer.gserviceaccount.com"

  build {
    step {
      id   = "Build"
      name = "gcr.io/cloud-builders/docker"
      dir  = "frontend"
      args = [
        "build", "-t",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.thunderafit.repository_id}/frontend:$COMMIT_SHA",
        "-f", "Dockerfile", ".",
      ]
    }
    step {
      id   = "Push"
      name = "gcr.io/cloud-builders/docker"
      args = [
        "push",
        "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.thunderafit.repository_id}/frontend:$COMMIT_SHA",
      ]
    }
    step {
      id         = "Deploy"
      name       = "gcr.io/google.com/cloudsdktool/cloud-sdk:slim"
      entrypoint = "gcloud"
      args = [
        "run", "services", "update", google_cloud_run_v2_service.frontend.name,
        "--platform=managed",
        "--image=${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.thunderafit.repository_id}/frontend:$COMMIT_SHA",
        "--region=${var.region}",
        "--quiet",
      ]
    }
    images = [
      "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.thunderafit.repository_id}/frontend:$COMMIT_SHA",
    ]
    options {
      logging             = "CLOUD_LOGGING_ONLY"
      substitution_option = "ALLOW_LOOSE"
    }
  }

  depends_on = [google_project_service.apis]
}
