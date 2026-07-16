# Alerta de orçamento — não bloqueia gasto nenhum, só avisa. Rede de
# segurança barata para o objetivo explícito de manter isso essencialmente
# gratuito. Opcional: pule definindo billing_account_id = "" (default).
data "google_project" "current" {
  project_id = var.project_id
}

resource "google_billing_budget" "monthly" {
  count    = var.billing_account_id != "" ? 1 : 0
  provider = google.billing

  billing_account = var.billing_account_id
  display_name    = "ThunderaFit — orçamento mensal"

  budget_filter {
    # A API de orçamento exige o NÚMERO do projeto aqui, não o project ID
    # (erro real: "400 invalid argument" usando "projects/thunderafit").
    projects = ["projects/${data.google_project.current.number}"]
  }

  amount {
    specified_amount {
      # PRECISA bater com a moeda real da billing account, ou a API rejeita
      # com um genérico "400 invalid argument" sem indicar o campo (erro
      # real: billing account em BRL, tentativa com "USD" fixo falhava
      # tanto no provider quanto via `gcloud` puro — não era bug do
      # Terraform).
      currency_code = var.budget_currency_code
      units         = tostring(var.budget_amount)
    }
  }

  threshold_rules {
    threshold_percent = 0.5
  }
  threshold_rules {
    threshold_percent = 1.0
  }

  # Sem all_updates_rule/canal de notificação customizado de propósito — os
  # alertas já vão por e-mail para quem tem papel de Billing Account
  # Admin/User por padrão, sem precisar provisionar um tópico Pub/Sub só
  # pra isso.
}
