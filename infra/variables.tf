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

variable "contact_gmail_user" {
  description = <<-EOT
    Fase 78 — "Fale Conosco": conta Gmail usada pra ENVIAR o e-mail via SMTP
    (nodemailer). Precisa de uma App Password gerada nessa mesma conta
    (myaccount.google.com/apppasswords, exige 2FA) — o valor da App Password
    em si NÃO vai aqui, vai em `gcloud secrets versions add
    contact-gmail-app-password` (ver infra/README.md).
  EOT
  type        = string
  default     = ""
}

variable "contact_email_to" {
  description = "Fase 78 — destinatário das mensagens de \"Fale Conosco\". Se vazio, usa contact_gmail_user."
  type        = string
  default     = ""
}

variable "google_client_id" {
  description = <<-EOT
    Fase 77 — Client ID OAuth 2.0 ("Web application") do SSO Google, criado
    em console.cloud.google.com/apis/credentials. NÃO é secreto (por isso é
    uma variável normal, não um Secret Manager secret) — vira GOOGLE_CLIENT_ID
    no backend (verificação do idToken) e NEXT_PUBLIC_GOOGLE_CLIENT_ID no
    build do frontend (inicializa o botão "Entrar com o Google").
  EOT
  type        = string
  default     = ""
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
