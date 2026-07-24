import "dotenv/config";

// Garantir que variáveis de ambiente de teste estejam definidas
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test_jwt_secret_32_chars_minimum_ok";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test_refresh_secret_32_chars_ok_";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://thunderafit:thunderafit_secret@localhost:5432/thunderafit_db?schema=public";

// Fase 20 (billing): valores dummy de teste. A verificação de assinatura do
// webhook é cripto local (HMAC) e funciona com qualquer segredo; chamadas à
// API do Stripe (checkout/portal) são mockadas nos testes.
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy_key_for_tests";
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_secret_for_tests_only";
// Billing 3 degraus: 4 preços (2 degraus pagos × mensal/anual), evolução dos
// 2 preços únicos da Fase 20 (só intervalo, um único degrau "PAGO").
process.env.STRIPE_PRICE_ID_BASE_MONTHLY =
  process.env.STRIPE_PRICE_ID_BASE_MONTHLY ?? "price_test_base_monthly";
process.env.STRIPE_PRICE_ID_BASE_ANNUAL =
  process.env.STRIPE_PRICE_ID_BASE_ANNUAL ?? "price_test_base_annual";
process.env.STRIPE_PRICE_ID_PLUS_MONTHLY =
  process.env.STRIPE_PRICE_ID_PLUS_MONTHLY ?? "price_test_plus_monthly";
process.env.STRIPE_PRICE_ID_PLUS_ANNUAL =
  process.env.STRIPE_PRICE_ID_PLUS_ANNUAL ?? "price_test_plus_annual";
