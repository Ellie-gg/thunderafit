locals {
  required_apis = [
    "run.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "secretmanager.googleapis.com",
    "iam.googleapis.com",
    "billingbudgets.googleapis.com",
    "storage.googleapis.com",
  ]
}

resource "google_project_service" "apis" {
  for_each = toset(local.required_apis)

  project = var.project_id
  service = each.value

  # terraform destroy não deve desligar APIs do projeto (poderia afetar
  # outras coisas rodando nele) — só paramos de gerenciá-las.
  disable_on_destroy         = false
  disable_dependent_services = false
}
