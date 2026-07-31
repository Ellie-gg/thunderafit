# Billing (Stripe) — setup e validação com conta viva

## Status atual (Fase 87) — MODO TESTE 100% validado em produção

O fluxo completo já foi testado de ponta a ponta em produção (Cloud Run), em **modo
teste** do Stripe: Checkout hospedado → cartão `4242 4242 4242 4242` → webhook
processou e o Personal virou BASE de verdade (limite de alunos aumentou) → botão
"Gerenciar/cancelar assinatura" abriu o Portal do Cliente do Stripe corretamente.
Faltou só testar o cancelamento em si (webhook `customer.subscription.deleted`), mas
o código desse caminho já é coberto pelos testes automatizados (`billing.test.ts`).

**Infra provisionada (Terraform, já commitado e aplicado):**
- 2 secrets no Secret Manager: `stripe-secret-key`, `stripe-webhook-secret` (valores de
  TESTE já adicionados via `gcloud secrets versions add`).
- 4 Price IDs de TESTE como env vars não-secretas no Cloud Run do backend (ver
  `infra/terraform.tfvars`, gitignored — os valores reais ficam só lá e no state).
- IAM: `thunderafit-backend@...` tem `roles/secretmanager.secretAccessor` nos 2
  secrets novos (`infra/iam.tf`).

**Produtos/preços criados no Dashboard do Stripe (test mode):**
| Produto | Preço mensal | Preço trimestral (20% off) |
|---|---|---|
| ThunderaFit Base | R$ 14,99 | R$ 35,98 |
| ThunderaFit Plus | R$ 29,90 | R$ 71,76 |

**Webhook de teste configurado** apontando pra
`https://thunderafit-frontend-vy6oiie6rq-uc.a.run.app/api/billing/webhook`, escutando
`checkout.session.completed`, `checkout.session.async_payment_succeeded`,
`customer.subscription.updated`, `customer.subscription.deleted`, **e
`invoice.payment_failed`** (adicionado na Fase 103 — o handler já existe no código desde
essa fase, mas o checklist abaixo e a configuração real do webhook tinham ficado pra
trás, então o aviso proativo de falha de pagamento nunca chegava a disparar de verdade
— achado da auditoria 2026-07-31, corrigido aqui só na documentação; **confirme que o
webhook de TESTE também escuta este evento no Dashboard do Stripe**, já que ele foi
configurado antes da Fase 103 existir).

**Armadilha real encontrada nesta fase** (documentada pra não repetir o susto): depois
de um `terraform apply` que dá erro de permissão (IAM faltando) no meio da atualização
do Cloud Run, a revisão nova pode ficar "criada mas não saudável" e o serviço continua
servindo a revisão ANTIGA (sem os env vars novos) — o app quebra com "config de billing
ausente" mesmo com o Terraform dizendo "no changes" depois. A correção nesses casos é
forçar uma revisão nova de propósito:
```
gcloud run services update thunderafit-backend --region=us-central1 --project=thunderafit --update-labels=redeploy=<qualquer-valor-novo>
```
Nesta fase, a 1ª tentativa dessa forçada falhou por um motivo DIFERENTE e sem relação
com Stripe: timeout de advisory lock do Postgres (`P1002`) no `prisma migrate deploy`
que roda no boot do container — o Neon (serverless, hiberna quando ocioso) demorou
mais que o timeout do healthcheck pra "acordar". A 2ª tentativa (poucos minutos depois)
funcionou normal. Se acontecer numa próxima ativação: não é bug, só rodar de novo.

## O que falta pra virar cobrança de verdade (checklist de ativação)

Nada disto foi feito ainda — é o roteiro pra quando você decidir ativar produção real.
**Modo teste e modo live no Stripe são universos totalmente separados**: produtos,
preços, chaves e webhooks de teste NÃO existem no modo live — tudo isso precisa ser
recriado do zero lá.

1. No Dashboard do Stripe, **saia do modo teste** ("Alternar para conta de produção"/
   ativar sua conta pra processar pagamento real — a Stripe pode pedir dados
   bancários/verificação de identidade nesse ponto; pode levar de minutos a alguns
   dias, fora do nosso controle).
2. Recriar os **mesmos 2 produtos, 4 preços** (Seção "Produtos/preços" acima) — agora
   em modo LIVE. Os Price IDs vão ser DIFERENTES dos de teste.
3. Recriar o **webhook** em modo LIVE, mesma URL
   (`https://thunderafit-frontend-vy6oiie6rq-uc.a.run.app/api/billing/webhook`), com os
   **mesmos 5 eventos** (`checkout.session.completed`,
   `checkout.session.async_payment_succeeded`, `customer.subscription.updated`,
   `customer.subscription.deleted`, **`invoice.payment_failed`** — não esquecer este
   último, ver nota na seção de status acima). Vai gerar um `whsec_...` novo (diferente
   do de teste).
4. Pegar a **chave secreta live** (`sk_live_...`) em Desenvolvedores → Chaves de API
   (com o toggle de modo teste DESLIGADO).
5. Substituir os 2 secrets no Secret Manager pelos valores live:
   ```
   gcloud secrets versions add stripe-secret-key --data-file=- --project=thunderafit
   gcloud secrets versions add stripe-webhook-secret --data-file=- --project=thunderafit
   ```
   (cola o valor via stdin, não como argumento de linha de comando, pra não vazar no
   histórico do shell — ver exemplos com `echo -n "..." | gcloud secrets versions add ...`
   usados nesta mesma fase).
6. Atualizar os 4 Price IDs em `infra/terraform.tfvars` (arquivo local, gitignored) com
   os novos IDs live, e rodar `terraform plan`/`apply` em `infra/` — isso já força uma
   revisão nova do Cloud Run com os Price IDs certos.
7. Forçar uma revisão nova pra garantir que os secrets NOVOS (não só os Price IDs) sejam
   lidos — mesmo comando `gcloud run services update ... --update-labels=...` do
   checklist acima, caso o `terraform apply` do passo 6 não tenha mudado nada no
   template do Cloud Run (ele só muda se os Price IDs realmente mudarem de valor).
8. Testar 1 assinatura real com um cartão de verdade seu (valor baixo, ex: Base
   mensal) antes de anunciar a ativação — cancelar logo depois pelo Portal.
9. Só depois de confirmar o fluxo real: anunciar a monetização como ativa.

O código de billing está completo e testado com **cripto real do Stripe** (o webhook
rejeita assinatura inválida e aceita válida; upgrade→BASE/PLUS→4º aluno e
downgrade→FREE+3 provados server-side), e o fluxo real em modo teste já foi validado
em produção (ver seção de status acima).

## 0. Estrutura de 3 degraus (evolução do antigo FREE/PAGO de 2 estados)
- **Free**: 3 alunos (como hoje), sem acesso ao diretório de descoberta.
- **Base**: 20 alunos + pode ativar disponibilidade no diretório de profissionais.
- **Plus**: alunos ilimitados + aparece com destaque/prioridade no diretório.

Os valores em R$ abaixo são os definidos pelo fundador na Fase 87 — o código não
hardcoda preço nenhum (só os 4 Price IDs via env), então ajustes futuros de preço só
exigem criar um novo Price no Stripe e trocar a env var, sem deploy de código.

## 1. Preços (referência — já criados em modo teste, ver checklist de ativação acima
para recriar em modo live)
2 produtos ("ThunderaFit Base" e "ThunderaFit Plus"), cada um com 2 preços recorrentes
(BRL) — 4 preços no total. Fase 87: **sem opção anual** — só mensal e trimestral (20%
off em ambos os degraus):
- Base mensal: **R$ 14,99/mês** → `STRIPE_PRICE_ID_BASE_MONTHLY`
- Base trimestral: **R$ 35,98/trimestre** (20% off, equivale a R$ 11,99/mês) →
  `STRIPE_PRICE_ID_BASE_QUARTERLY`
- Plus mensal: **R$ 29,90/mês** → `STRIPE_PRICE_ID_PLUS_MONTHLY`
- Plus trimestral: **R$ 71,76/trimestre** (20% off, equivale a R$ 23,92/mês) →
  `STRIPE_PRICE_ID_PLUS_QUARTERLY`

Aluno Premium (entitlement separado de `planoAssinatura`, ver `src/billing/stripe.ts`)
também mudou na Fase 87: 7 dias grátis, depois **R$ 9,99/mês**, trimestral com 20% off
(antes era R$ 9,90/mês e 30% off) — o checkout do Aluno Premium ainda não está
conectado ao Stripe (fora de escopo desta fase).

## 2. Variáveis de ambiente (nunca commitar valores reais)
No `.env` local e no Secret Manager de produção (já feito para modo teste, ver status
acima):
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # do `stripe listen` ou do endpoint no Dashboard
STRIPE_PRICE_ID_BASE_MONTHLY=price_...
STRIPE_PRICE_ID_BASE_QUARTERLY=price_...
STRIPE_PRICE_ID_PLUS_MONTHLY=price_...
STRIPE_PRICE_ID_PLUS_QUARTERLY=price_...
```

## 2.1 Como o webhook sabe qual DEGRAU foi comprado
- `checkout.session.completed`/`async_payment_succeeded`: lê `session.metadata.tier`
  — setado por nós mesmos ao criar o Checkout (`createCheckoutSession`), sem custo de
  API extra.
- `customer.subscription.updated` (inclusive troca de degrau pelo **Portal do
  Cliente**, fora do nosso Checkout): lê o `price.id` ATUAL do primeiro item da
  subscription e casa contra os 4 `STRIPE_PRICE_ID_*` acima — é a única fonte confiável
  quando o cliente troca de plano sem passar pelo nosso fluxo (metadata da criação não
  se atualiza sozinha nesse caso). Price desconhecido/env não configurada → concede
  BASE por segurança (nunca PLUS por adivinhação).

## 3. Validar o webhook localmente (Stripe CLI)
```
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
# copie o whsec_... impresso para STRIPE_WEBHOOK_SECRET e reinicie o backend
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
```
Confirmar no log/DB: upgrade vira BASE ou PLUS/limite correspondente; delete volta
FREE/limite 3 (e desliga `availableForNewStudents`, se estivesse ligado).

## 4. Fluxo completo em modo teste (já confirmado em produção — passos abaixo servem
de roteiro pra repetir o teste em modo live antes de anunciar ativação)
1. Personal no limite 3/3 (ou querendo o diretório) → tela **Planos** → escolhe
   **Base** ou **Plus** → **Assinar** → Checkout do Stripe.
2. Cartão de teste `4242 4242 4242 4242`, validade futura, CVC qualquer.
3. Após o retorno, o webhook processa e o Personal já vincula mais alunos / pode
   ativar disponibilidade no diretório. **Confirmado funcionando em produção.**
4. **Cancelar**: botão "Gerenciar/cancelar" → Portal do Stripe → cancelar → webhook
   `customer.subscription.deleted` → FREE/limite 3, **sem desfazer** vínculos
   existentes (mas desliga a disponibilidade no diretório). Ainda não testado em
   produção — fazer isso é o próximo passo natural antes de ativar modo live.

## 5. IMPORTANTE — webhook em PRODUÇÃO passa pelo frontend
O backend do Cloud Run é **IAM-restricted** (o Stripe não o alcança direto). Configure
o endpoint de webhook no Stripe apontando para a **URL pública do frontend**:
```
https://thunderafit-frontend-vy6oiie6rq-uc.a.run.app/api/billing/webhook
```
O proxy server-side do frontend repassa os **bytes crus** (via `arrayBuffer()`) e o
header `Stripe-Signature` ao backend, anexando o ID token do Google — a assinatura
continua válida porque o corpo não é reserializado.

## 6. Ativar produção (decisão explícita sua)
Ver o checklist completo de 9 passos na seção de status no topo deste arquivo. Não
precisa de deploy de código novo — só trocar valores de secrets/Price IDs, tudo já
está no código/infra. Antes de completar o checklist, nada processa pagamento real.

## Hardening já aplicado (revisão de segurança)
- Webhook só age após verificar a assinatura (`constructEvent` + raw body).
- `checkout.session.completed` só concede PAGO se `payment_status` = paid /
  no_payment_required; boleto/Pix (confirmação atrasada) só sobem para PAGO no
  `checkout.session.async_payment_succeeded`. Evita plano pago antes do dinheiro entrar.
- Eventos de subscription só agem sobre a subscription CORRENTE do usuário — um
  `updated(active)` obsoleto reentregue após um cancelamento é ignorado (o Stripe não
  garante ordem de entrega). 
- Cartão nunca toca o backend (Checkout hospedado).

### Hardening recomendado para volume maior (não aplicado)
- Idempotência por `event.id` (tabela de eventos processados) + reconciliação via
  `stripe.subscriptions.retrieve()` para estado 100% autoritativo.
- Rate limit no endpoint público de webhook.
