variable "project_id" {
  description = "ID do projeto GCP onde tudo é provisionado."
  type        = string
}

variable "region" {
  description = "Região do Cloud Run / Artifact Registry / Cloud Build."
  type        = string
  default     = "us-central1"
}

variable "github_owner" {
  description = "Dono do repositório GitHub (ex: \"Ellie-gg\")."
  type        = string
}

variable "github_repo" {
  description = "Nome do repositório GitHub."
  type        = string
  default     = "thunderafit"
}

variable "allowed_origin" {
  description = "Origem do frontend — vira ALLOWED_ORIGIN (CORS) no backend."
  type        = string
}

variable "billing_account_id" {
  description = "ID da conta de billing, só necessário para o alerta de orçamento (budget.tf). Deixe em branco para pular."
  type        = string
  default     = ""
}

variable "budget_amount" {
  description = "Teto mensal (na moeda de budget_currency_code) do alerta de orçamento — é só um aviso, não bloqueia gasto."
  type        = number
  default     = 10
}

variable "budget_currency_code" {
  description = <<-EOT
    Moeda do valor em budget_amount — PRECISA bater com a moeda real da
    billing account (`gcloud billing accounts describe <ID>` mostra
    `currencyCode`), senão a API rejeita com um 400 genérico. Confirme antes
    de mudar o default.
  EOT
  type        = string
  default     = "USD"
}
