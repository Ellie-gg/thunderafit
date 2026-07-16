terraform {
  required_version = ">= 1.5"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 6.0"
    }
  }

  # O bucket de state é criado manualmente (ver infra/README.md) antes do
  # primeiro `terraform init` — passado via -backend-config em vez de
  # hardcoded aqui, para não travar o nome do bucket no código.
  backend "gcs" {}
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Provider separado, só para google_billing_budget (budget.tf) — essa API
# não tem um projeto "dono" óbvio (orçamento vive na billing account, não
# num projeto), então a chamada via ADC cai no quota project default do
# próprio gcloud CLI em vez do projeto real, retornando 403 SERVICE_DISABLED
# mesmo com a API já habilitada em `thunderafit` (erro real do primeiro
# apply). `user_project_override` resolve isso, mas ligado no provider
# principal quebrou toda checagem de outras APIs (exige
# cloudresourcemanager.googleapis.com, que não está na lista de apis.tf) —
# por isso vive isolado num alias, usado só pelo recurso do orçamento.
provider "google" {
  alias   = "billing"
  project = var.project_id
  region  = var.region

  user_project_override = true
  billing_project       = var.project_id
}
