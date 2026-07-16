# Infraestrutura (Terraform) — ThunderaFit

Provisiona tudo que roda em produção no Google Cloud: Cloud Run (backend +
frontend), Artifact Registry, Cloud Build (deploy automático no push em
`main`), Secret Manager e um alerta de orçamento. O Postgres (Neon) fica
**fora** do Terraform de propósito — ver [Contexto](#contexto-e-decisões)
abaixo.

Ferramentas necessárias: `gcloud` CLI e `terraform` (>= 1.5). Nenhum dos
dois exige WSL — rodam igual em Git Bash/PowerShell no Windows; use o que
for mais conveniente. WSL só importaria se algum dia for rodar o próprio
app Node dentro dele, e isso já está resolvido como não-suportado (ver
`dev.sh`, que detecta e bloqueia WSL por causa de módulos nativos
compilados para Windows).

## Contexto e decisões

- **Neon não é gerenciado por Terraform.** Criado uma vez à mão, a
  connection string (**pooled**, modo PgBouncer — não a direta) vai pro
  Secret Manager por fora. Isso é deliberado: significa que um
  `terraform destroy` nunca consegue derrubar o banco de produção junto
  com o resto.
- **Nenhum valor de secret passa pelo Terraform.** `secrets.tf` só cria os
  *containers* (nome, replicação); os valores reais são adicionados via
  `gcloud secrets versions add`, nunca em `.tf`/`.tfvars`/state.
- **Backend não é público.** Só o service account do frontend pode
  invocá-lo (`roles/run.invoker`) — ver `iam.tf`. O proxy em
  `frontend/app/api/[...path]/route.ts` anexa um token de identidade do
  Google automaticamente quando detecta que está rodando no Cloud Run.
- **Deploy é 100% via Cloud Build**, sem GitHub Actions/YAML nenhum — o
  gatilho (`cloudbuild.tf`) dispara só em push para `main`.

## Passo a passo (do zero)

### 1. Projeto GCP + billing

Se ainda não existir um projeto:

```bash
gcloud projects create thunderafit-prod
gcloud billing projects link thunderafit-prod --billing-account=<BILLING_ACCOUNT_ID>
gcloud config set project thunderafit-prod
```

### 2. Bucket do state do Terraform

Criado à mão, uma única vez — não vale a pena um módulo de bootstrap
separado pra isso:

```bash
gcloud storage buckets create gs://thunderafit-tfstate \
  --location=us-central1 --uniform-bucket-level-access
gcloud storage buckets update gs://thunderafit-tfstate --versioning
```

(versioning protege o state contra corrupção/sobrescrita acidental — cada
apply gera uma nova versão do objeto em vez de perder a anterior.)

### 3. Conectar o GitHub (passo manual e único)

O jeito mais simples é usar o próprio assistente do Cloud Run — ele já
cria a conexão, o repositório e o gatilho de uma vez:

1. Console → Cloud Run → **Set up Continuous Deployment** → escolha o
   repositório GitHub (autoriza o GitHub App na hora, se ainda não estiver
   autorizado) → selecione o Dockerfile e a branch `main`.
2. Repita para os dois serviços (backend com `Dockerfile` na raiz,
   frontend com `frontend/Dockerfile` e contexto `frontend/`).
3. Depois de criado pelo assistente, anote os valores reais e importe pro
   Terraform (para que `terraform apply`/`destroy` passem a gerenciá-los
   também):

   ```bash
   cd infra
   terraform import google_cloudbuildv2_connection.github \
     projects/<PROJECT_ID>/locations/<REGION>/connections/github-connection
   terraform import google_cloudbuildv2_repository.thunderafit \
     projects/<PROJECT_ID>/locations/<REGION>/connections/github-connection/repositories/thunderafit
   terraform import google_cloudbuild_trigger.backend <TRIGGER_ID_BACKEND>
   terraform import google_cloudbuild_trigger.frontend <TRIGGER_ID_FRONTEND>
   ```
4. Preencha `github_app_installation_id`/`github_oauth_token_secret_version`
   em `terraform.tfvars` com os valores que aparecem na tela da connection
   (Console → Cloud Build → Repositories → github-connection) e rode
   `terraform plan` — não deveria dar diff se os valores baterem com o que
   o assistente criou.

### 4. `terraform apply`

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars
# preencha project_id, github_owner, allowed_origin, etc.

terraform init -backend-config="bucket=thunderafit-tfstate"
terraform plan
terraform apply
```

Isso cria: APIs habilitadas, Artifact Registry, os dois Cloud Run services
(com uma imagem placeholder até o primeiro build real do Cloud Build
rodar), os service accounts, os bindings de IAM, e os 3 secrets vazios.

### 5. Preencher os secrets de verdade

```bash
openssl rand -base64 48 | gcloud secrets versions add jwt-secret --data-file=-
openssl rand -base64 48 | gcloud secrets versions add jwt-refresh-secret --data-file=-

# Connection string POOLED do Neon (painel do Neon → Connection Details →
# "Pooled connection" — NÃO a direct connection):
echo -n "postgresql://...pooler.../..." | gcloud secrets versions add database-url --data-file=-
```

### 6. Primeiro deploy real

Um push em `main` (ou clicar "Run" manualmente no trigger recém-criado,
no console do Cloud Build) dispara o build+deploy de verdade, substituindo
a imagem placeholder. As migrations rodam sozinhas na subida do container
(`docker/start-backend.sh`).

## Verificação pós-deploy

```bash
# Frontend responde
curl -I https://$(terraform output -raw frontend_url)/login

# Backend NÃO deve responder sem autenticação (confirma que não é público)
curl -i https://$(terraform output -raw backend_url)/health
# esperado: 403

# Confirma que cada trigger só dispara para o serviço certo — dê um push
# só em src/** e confira no console do Cloud Build que só o trigger do
# backend rodou (o do frontend não).
```

Ver `RUNBOOK.md` para rollback e operação do dia a dia.
