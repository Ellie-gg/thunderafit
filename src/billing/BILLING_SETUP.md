# Billing (Stripe) — setup e validação com conta viva (Fase 20)

O código de billing está completo e testado com **cripto real do Stripe** (o webhook
rejeita assinatura inválida e aceita válida; upgrade→PAGO+50→4º aluno e
downgrade→FREE+3 provados server-side). O que **não** pôde ser rodado aqui (não há
conta Stripe): criar os produtos/preços reais, um Checkout hospedado real e receber
um webhook vindo dos servidores do Stripe. Estes passos ficam para você, em **modo
teste**.

## 1. Criar os produtos/preços (modo teste)
No Dashboard do Stripe (test mode) ou via API, criar 1 produto "ThunderaFit Pro" com
2 preços recorrentes (BRL):
- Mensal: **R$ 9,90/mês** → anote o `price_...` → `STRIPE_PRICE_ID_MONTHLY`
- Anual: **R$ 95,04/ano** (20% off) → anote o `price_...` → `STRIPE_PRICE_ID_ANNUAL`

## 2. Variáveis de ambiente (nunca commitar valores reais)
No `.env` local e, quando ativar, no Secret Manager de produção:
```
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...        # do `stripe listen` ou do endpoint no Dashboard
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_ANNUAL=price_...
```

## 3. Validar o webhook localmente (Stripe CLI)
```
stripe login
stripe listen --forward-to localhost:3000/api/billing/webhook
# copie o whsec_... impresso para STRIPE_WEBHOOK_SECRET e reinicie o backend
stripe trigger checkout.session.completed
stripe trigger customer.subscription.deleted
```
Confirmar no log/DB: upgrade vira PAGO/limite 50; delete volta FREE/limite 3.

## 4. Fluxo completo em modo teste
1. Suba local (`./dev.sh` / `dev.ps1`) com as env acima.
2. Personal no limite 3/3 → tela **Planos** → **Assinar** → Checkout do Stripe.
3. Cartão de teste `4242 4242 4242 4242`, validade futura, CVC qualquer.
4. Após o retorno, o webhook (via `stripe listen`) processa e o Personal já vincula o 4º aluno.
5. **Cancelar**: botão "Gerenciar/cancelar" → Portal do Stripe → cancelar → webhook
   `customer.subscription.deleted` → FREE/limite 3, **sem desfazer** vínculos existentes.

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
Só troque as chaves de teste por chaves live e faça o deploy (merge da branch
`feat/billing-stripe` em `main`) quando decidir cobrar de verdade. Antes disso,
nada nesta fase processa pagamento real.

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
