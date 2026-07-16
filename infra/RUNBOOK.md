# Runbook — Operação do ThunderaFit em produção

## Rollback

Cloud Run guarda todas as revisions já implantadas — reverter é instantâneo,
sem rebuild:

```bash
gcloud run revisions list --service=thunderafit-backend --region=us-central1
gcloud run services update-traffic thunderafit-backend \
  --region=us-central1 --to-revisions=<REVISION_ANTERIOR>=100
```

Mesmo comando para `thunderafit-frontend`, trocando o nome do serviço.

**Isso NÃO desfaz uma migration do Prisma.** Se o deploy problemático
incluiu uma migration, o rollback de tráfego sozinho pode deixar código
antigo apontando pra um schema novo incompatível. Por isso as migrations
deste projeto devem ser aditivas/compatíveis-pra-trás por convenção
(expand-then-contract) — nunca um `DROP COLUMN`/`RENAME` na mesma migration
que o deploy que o introduz, sempre em 2 passos separados com um deploy
inteiro no meio.

## Rotacionar um secret (JWT ou DATABASE_URL)

```bash
openssl rand -base64 48 | gcloud secrets versions add jwt-secret --data-file=-
```

Cloud Run está configurado para sempre ler a versão `latest` do secret
(ver `secrets.tf`/`cloud_run.tf`) — não precisa de `terraform apply` pra
rotacionar, só de uma nova revision (redeploy manual ou o próximo push).

**Rotacionar `jwt-secret`/`jwt-refresh-secret` derruba todas as sessões
ativas na hora** — não há período de graça com chave dupla. Aceitável pra
esse tamanho de produto, mas avise os usuários se for uma rotação
planejada, não só uma resposta a incidente.

## Por que o backend não é público

Decisão da fase de deploy: o app guarda dado de saúde (anamnese) — uma URL
de backend aberta seria uma porta de entrada direta pro Postgres/Neon pra
qualquer um que a descobrisse. Só o service account do frontend tem
`roles/run.invoker` no backend (`iam.tf`). Isso significa:

- **Nunca** chame o backend direto do navegador — sempre pelo proxy em
  `frontend/app/api/[...path]/route.ts`.
- Debugar o backend manualmente (curl, Postman) a partir de fora do Cloud
  Run exige se autenticar como o próprio service account do frontend:

  ```bash
  gcloud auth print-identity-token \
    --impersonate-service-account=$(terraform output -raw frontend_service_account) \
    --audiences=$(terraform output -raw backend_url)
  # cole o token retornado como header: Authorization: Bearer <token>
  ```

## Neon: connection string pooled, não a direta

`DATABASE_URL` em produção **precisa** ser a connection string em modo
pooled (PgBouncer) do Neon, não a direta — o Cloud Run escala de zero em
rajadas, e a conexão direta do Neon tem um teto de conexões simultâneas
baixo o bastante pra estourar rápido nesse padrão de tráfego.

## Cold start duplo (Cloud Run + Neon)

Depois de um período ocioso, os dois lados podem estar "frios" ao mesmo
tempo: o Cloud Run precisa subir uma instância nova E o endpoint do Neon
precisa acordar do auto-suspend. A primeira requisição depois de um tempo
parado pode demorar bem mais que o normal — não é bug, é o trade-off de
manter tudo no free tier (nenhum dos dois serviços está com instância
mínima > 0).

## `terraform destroy`

Derruba Cloud Run, Artifact Registry, Cloud Build triggers/connection,
service accounts, IAM bindings e os *containers* dos secrets (sem os
valores, que nunca estiveram no state). **Não toca no Neon** — o banco de
produção sobrevive a um `destroy` acidental por design.
