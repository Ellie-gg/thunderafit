import "dotenv/config";

// Garantir que variáveis de ambiente de teste estejam definidas
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test_jwt_secret_32_chars_minimum_ok";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test_refresh_secret_32_chars_ok_";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://thunderafit:thunderafit_secret@localhost:5432/thunderafit_db?schema=public";

// Fase 77 (SSO Google): OAuth2Client é mockado nos testes (ver
// google-sso.test.ts) — o valor real só importa em produção.
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "test-google-client-id.apps.googleusercontent.com";

// Fase 78 (Fale Conosco): sendMail é mockado nos testes (ver
// contact.test.ts) — só precisa que CONTACT_EMAIL_TO exista pra o service
// decidir TENTAR enviar (a chamada em si é interceptada pelo mock).
process.env.CONTACT_EMAIL_TO = process.env.CONTACT_EMAIL_TO ?? "test-founder@thunderafit.test";

// Fase 83 (troca Gmail SMTP -> Resend): RESEND_API_KEY é lida por
// src/lib/mailer.ts — sendMail é mockado nos testes que enviam e-mail, então
// o valor real nunca importa aqui, só precisa existir.
process.env.RESEND_API_KEY = process.env.RESEND_API_KEY ?? "test-resend-api-key";

// Fase 81 (confirmação de e-mail / esqueci minha senha): usado pra montar o
// link do e-mail (getEnv("ALLOWED_ORIGIN") lança se ausente, o que
// silenciosamente engoliria o envio de e-mail no register/forgot-password
// sem essa var setada em teste).
process.env.ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "http://localhost:3001";

// Fase 20 (billing): valores dummy de teste. A verificação de assinatura do
// webhook é cripto local (HMAC) e funciona com qualquer segredo; chamadas à
// API do Stripe (checkout/portal) são mockadas nos testes.
process.env.STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY ?? "sk_test_dummy_key_for_tests";
process.env.STRIPE_WEBHOOK_SECRET =
  process.env.STRIPE_WEBHOOK_SECRET ?? "whsec_test_secret_for_tests_only";
// Billing 3 degraus: 4 preços (2 degraus pagos × mensal/trimestral —
// "annual" trocado por "quarterly" na Fase 87), evolução dos 2 preços únicos
// da Fase 20 (só intervalo, um único degrau "PAGO").
process.env.STRIPE_PRICE_ID_BASE_MONTHLY =
  process.env.STRIPE_PRICE_ID_BASE_MONTHLY ?? "price_test_base_monthly";
process.env.STRIPE_PRICE_ID_BASE_QUARTERLY =
  process.env.STRIPE_PRICE_ID_BASE_QUARTERLY ?? "price_test_base_quarterly";
process.env.STRIPE_PRICE_ID_PLUS_MONTHLY =
  process.env.STRIPE_PRICE_ID_PLUS_MONTHLY ?? "price_test_plus_monthly";
process.env.STRIPE_PRICE_ID_PLUS_QUARTERLY =
  process.env.STRIPE_PRICE_ID_PLUS_QUARTERLY ?? "price_test_plus_quarterly";
