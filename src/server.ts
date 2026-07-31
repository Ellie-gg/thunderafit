import "dotenv/config";
import { buildApp } from "./app";

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const HOST = "0.0.0.0";

// A12 (auditoria 2026-07-31): sem isso, subir o servidor com `JWT_SECRET`/
// `JWT_REFRESH_SECRET` ausente não falhava aqui — `getEnv` só lança na
// PRIMEIRA vez que algum request precisa assinar/verificar um token, e o
// middleware de autenticação (`src/auth/middlewares/authenticate.ts`)
// converte essa exceção genericamente em "401 Token de acesso inválido ou
// expirado.". Resultado: todo mundo vê "sessão expirada" em loop, sem
// nenhuma pista no log de que a causa é config ausente, não sessão real.
// Falhar alto AQUI (processo nem sobe) torna o erro de config óbvio na hora
// do deploy, em vez de escondido atrás de um sintoma de usuário.
const REQUIRED_ENV_VARS = ["JWT_SECRET", "JWT_REFRESH_SECRET"];

function assertRequiredEnvVars(): void {
  const missing = REQUIRED_ENV_VARS.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`Variáveis de ambiente obrigatórias ausentes: ${missing.join(", ")}.`);
    process.exit(1);
  }
}

async function start() {
  assertRequiredEnvVars();
  const app = await buildApp();

  try {
    await app.listen({ port: PORT, host: HOST });
    app.log.info(`ThunderAfit server running at http://${HOST}:${PORT}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
