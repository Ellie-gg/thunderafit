import "dotenv/config";

// Garantir que variáveis de ambiente de teste estejam definidas
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = process.env.JWT_SECRET ?? "test_jwt_secret_32_chars_minimum_ok";
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? "test_refresh_secret_32_chars_ok_";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ??
  "postgresql://thunderafit:thunderafit_secret@localhost:5432/thunderafit_db?schema=public";
