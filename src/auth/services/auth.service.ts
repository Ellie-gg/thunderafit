import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { Role, Locale } from "@prisma/client";
import { authRepository } from "../repository/auth.repository";
import { relationsService } from "../../fitness/services/relations.service";

const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

function getEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export interface RegisterInput {
  email: string;
  password: string;
  role: Role;
  // Fase 39: cadastro mínimo de nome — obrigatório no formulário de cadastro
  // real, mas opcional na API (ver comentário em registerHandler) e nullable
  // no schema (contas já existentes não têm esse dado, sem backfill).
  name: string | null;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: Role;
}

/**
 * Gera um access token (vida curta) e um refresh token (vida longa).
 */
function generateTokens(payload: JwtPayload): {
  accessToken: string;
  refreshToken: string;
} {
  const jwtSecret = getEnv("JWT_SECRET");
  const jwtRefreshSecret = getEnv("JWT_REFRESH_SECRET");

  const accessToken = jwt.sign(payload, jwtSecret, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(payload, jwtRefreshSecret, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
  });

  return { accessToken, refreshToken };
}

/**
 * Registra um novo usuário.
 * Lança erro se o e-mail já estiver em uso.
 */
export async function register(input: RegisterInput) {
  const existing = await authRepository.findByEmail(input.email);
  if (existing) {
    const err = new Error("E-mail já cadastrado.");
    (err as Error & { statusCode: number }).statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  const user = await authRepository.createUser({
    email: input.email,
    passwordHash,
    role: input.role,
    name: input.name,
  });

  // Nunca retornar passwordHash nem refreshTokenHash
  const { passwordHash: _ph, refreshTokenHash: _rth, ...safeUser } = user;
  return safeUser;
}

/**
 * Autentica um usuário.
 * Retorna accessToken, refreshToken e o usuário (sem campos sensíveis).
 */
export async function login(input: LoginInput, ipAddress: string | null = null) {
  const user = await authRepository.findByEmail(input.email);

  if (!user) {
    const err = new Error("Credenciais inválidas.");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  // Fase 77: conta criada via Google SSO nunca tem passwordHash — orienta em
  // vez de deixar bcrypt.compare quebrar contra null.
  if (!user.passwordHash) {
    const err = new Error("Esta conta usa login com Google. Continue com o Google.");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  const passwordMatch = await bcrypt.compare(input.password, user.passwordHash);
  if (!passwordMatch) {
    const err = new Error("Credenciais inválidas.");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  const payload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const { accessToken, refreshToken } = generateTokens(payload);

  // Salvar apenas o HASH do refresh token no banco (nunca o token em texto plano)
  const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
  await authRepository.updateRefreshTokenHash(user.id, refreshTokenHash);
  await authRepository.recordLogin(user.id, ipAddress);

  // Lembrete de pagamento (MASTER_SPEC): checagem simples no login, só para
  // ALUNO — Personal/Nutricionista/Admin nunca são o alvo de um lembrete.
  if (user.role === "ALUNO") {
    await relationsService.checkAndFireDueReminders(user.id);
  }

  const { passwordHash: _ph, refreshTokenHash: _rth, ...safeUser } = user;
  return { accessToken, refreshToken, user: safeUser };
}

const SELF_SERVICE_ROLES: Role[] = ["PERSONAL", "ALUNO", "NUTRICIONISTA"];

/**
 * Fase 77 — SSO Google. Fluxo (mesmo endpoint pros 2 casos, diferenciados
 * pela presença de `role`):
 *
 * 1. Frontend manda só o `idToken` (Google Identity Services, botão "Entrar
 *    com o Google"). Verificamos a assinatura/audience/expiração aqui — NUNCA
 *    confiamos em claims decodificadas sem verificar (um idToken forjado
 *    passaria despercebido).
 * 2. Se já existe conta com esse e-mail: login direto (e-mail já é
 *    verificado pelo próprio Google, então vincular automaticamente por
 *    e-mail é seguro — mesmo padrão adotado por Google/Microsoft/etc.).
 *    Vincula `googleId` na conta se ainda não tinha (1ª vez entrando via
 *    Google numa conta criada por senha).
 * 3. Se NÃO existe conta: não dá pra criar ainda — falta o `role`
 *    (Google não informa isso). Devolve `{ needsRole: true }` sem criar
 *    nada; o frontend mostra a mesma tela de escolha de papel do cadastro
 *    tradicional e chama este endpoint de novo, agora com `role` preenchido.
 * 4. Com `role` presente e conta ainda não existente: cria a conta
 *    (passwordHash null — só entra por Google daqui pra frente, a menos que
 *    defina uma senha depois por um fluxo futuro de "adicionar senha").
 */
export async function loginOrRegisterWithGoogle(idToken: string, role?: Role) {
  const clientId = getEnv("GOOGLE_CLIENT_ID");
  const client = new OAuth2Client(clientId);

  let payload;
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    payload = ticket.getPayload();
  } catch {
    const err = new Error("Token do Google inválido ou expirado.");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  if (!payload?.email || !payload.email_verified) {
    const err = new Error("E-mail do Google não verificado.");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  const { email, sub: googleId, name } = payload;
  let user = await authRepository.findByEmail(email);

  if (!user) {
    if (!role) {
      return { needsRole: true as const, email };
    }
    if (!SELF_SERVICE_ROLES.includes(role)) {
      const err = new Error("role deve ser PERSONAL, ALUNO ou NUTRICIONISTA.");
      (err as Error & { statusCode: number }).statusCode = 400;
      throw err;
    }
    user = await authRepository.createUser({
      email,
      passwordHash: null,
      role,
      name: name?.trim() || null,
      googleId,
    });
  } else if (!user.googleId) {
    user = await authRepository.linkGoogleId(user.id, googleId);
  }

  const jwtPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
  const { accessToken, refreshToken } = generateTokens(jwtPayload);

  const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
  await authRepository.updateRefreshTokenHash(user.id, refreshTokenHash);
  await authRepository.recordLogin(user.id, null);

  if (user.role === "ALUNO") {
    await relationsService.checkAndFireDueReminders(user.id);
  }

  const { passwordHash: _ph, refreshTokenHash: _rth, ...safeUser } = user;
  return { needsRole: false as const, accessToken, refreshToken, user: safeUser };
}

/**
 * Rotaciona o refresh token.
 * Valida o token enviado contra o hash no banco e emite novos tokens.
 */
export async function refresh(token: string) {
  const jwtRefreshSecret = getEnv("JWT_REFRESH_SECRET");

  let payload: JwtPayload;
  try {
    payload = jwt.verify(token, jwtRefreshSecret) as JwtPayload;
  } catch {
    const err = new Error("Refresh token inválido ou expirado.");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  const user = await authRepository.findById(payload.sub);
  if (!user || !user.refreshTokenHash) {
    const err = new Error("Refresh token inválido.");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  // Verificar o token enviado contra o hash salvo no banco
  const tokenMatchesHash = await bcrypt.compare(token, user.refreshTokenHash);
  if (!tokenMatchesHash) {
    // Possível reutilização de token roubado — invalidar todos os tokens do usuário
    await authRepository.updateRefreshTokenHash(user.id, null);
    const err = new Error("Refresh token inválido. Faça login novamente.");
    (err as Error & { statusCode: number }).statusCode = 401;
    throw err;
  }

  // Rotação: gerar novos tokens e salvar novo hash
  const newPayload: JwtPayload = {
    sub: user.id,
    email: user.email,
    role: user.role,
  };

  const { accessToken, refreshToken: newRefreshToken } =
    generateTokens(newPayload);

  const newRefreshTokenHash = await bcrypt.hash(
    newRefreshToken,
    BCRYPT_SALT_ROUNDS
  );
  await authRepository.updateRefreshTokenHash(user.id, newRefreshTokenHash);

  return { accessToken, refreshToken: newRefreshToken };
}

/**
 * Invalida o refresh token do usuário no banco (logout server-side).
 */
export async function logout(userId: string) {
  await authRepository.updateRefreshTokenHash(userId, null);
}

/**
 * Checa se existe usuário com o e-mail informado (Fase 24 — fluxo de auth
 * unificado). Não retorna nenhum outro dado do usuário — só o boolean.
 */
export async function checkEmailExists(email: string): Promise<boolean> {
  const user = await authRepository.findByEmail(email);
  return !!user;
}

// Fase 30: foto de perfil. O redimensionamento/compressão acontece no
// cliente (canvas), mas o backend NUNCA confia só nisso — valida formato e
// tamanho de verdade antes de gravar. ~140KB de base64 dá margem folgada
// pra um avatar de até ~256px em WebP/JPEG comprimido (tipicamente poucos
// KB), sem abrir espaço pra alguém gravar blobs grandes no banco.
const MAX_AVATAR_DATA_URL_LENGTH = 140_000;
const AVATAR_DATA_URL_REGEX = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/]+=*$/;

/**
 * Atualiza (ou remove, com `null`) a foto de perfil do usuário autenticado.
 *
 * Bugs potenciais considerados antes de escrever esta função:
 * - confiar no redimensionamento feito no cliente sem validar de novo aqui —
 *   um client alterado poderia mandar uma imagem enorme ou uma string
 *   qualquer; por isso o regex de formato E o cap de tamanho, os dois no
 *   backend, não só no frontend.
 * - tratar `undefined` (campo ausente do body) como "não fazer nada" em vez
 *   de erro — o controller já garante que o campo existe (400 se ausente);
 *   aqui só chega `string` (upload) ou `null` (remoção) de propósito.
 * - esquecer que `null` é um caso LEGÍTIMO (remover avatar), não um erro —
 *   por isso o `if` de validação só roda quando `avatarDataUrl !== null`.
 */
export async function updateAvatar(userId: string, avatarDataUrl: string | null) {
  if (avatarDataUrl !== null) {
    if (avatarDataUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
      const err = new Error("Imagem muito grande. Escolha uma foto menor.");
      (err as Error & { statusCode: number }).statusCode = 400;
      throw err;
    }
    if (!AVATAR_DATA_URL_REGEX.test(avatarDataUrl)) {
      const err = new Error("Formato de imagem inválido. Use PNG, JPEG ou WebP.");
      (err as Error & { statusCode: number }).statusCode = 400;
      throw err;
    }
  }

  const user = await authRepository.updateAvatar(userId, avatarDataUrl);
  const { passwordHash: _ph, refreshTokenHash: _rth, ...safeUser } = user;
  return safeUser;
}

const MIN_PASSWORD_LENGTH = 8;

/**
 * Fase 80 — botão "Trocar senha" no perfil. Dois casos:
 * - Conta tradicional (`passwordHash` já existe): exige `currentPassword` e
 *   confere contra o hash salvo (mesmo `bcrypt.compare` do `login`) antes de
 *   trocar — sem isso, qualquer um com uma sessão ativa roubada poderia
 *   trocar a senha sem saber a atual.
 * - Conta só-Google (`passwordHash` null, Fase 77): não tem senha "atual"
 *   pra conferir — define a senha pela primeira vez direto. A partir daí a
 *   conta pode entrar tanto por senha quanto por Google (googleId continua
 *   setado, não é limpo aqui).
 */
export async function changePassword(
  userId: string,
  currentPassword: string | null,
  newPassword: string
) {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    const err = new Error(`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }

  const user = await authRepository.findById(userId);
  if (!user) {
    const err = new Error("Usuário não encontrado.");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }

  if (user.passwordHash) {
    if (!currentPassword) {
      const err = new Error("Senha atual é obrigatória.");
      (err as Error & { statusCode: number }).statusCode = 400;
      throw err;
    }
    const matches = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!matches) {
      const err = new Error("Senha atual incorreta.");
      (err as Error & { statusCode: number }).statusCode = 401;
      throw err;
    }
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  const updated = await authRepository.updatePasswordHash(userId, newHash);
  const { passwordHash: _ph, refreshTokenHash: _rth, ...safeUser } = updated;
  return safeUser;
}

const VALID_LOCALES: Locale[] = ["PT", "EN", "ES"];

/**
 * i18n: escolha explícita de idioma (tela de Configurações), pra sincronizar
 * entre dispositivos. `null` volta a deixar o frontend detectar
 * automaticamente (Accept-Language/navigator.language) — não é um erro, é
 * o usuário "desfazendo" uma escolha anterior.
 */
export async function updateLocale(userId: string, locale: Locale | null) {
  if (locale !== null && !VALID_LOCALES.includes(locale)) {
    const err = new Error("locale deve ser PT, EN ou ES.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  const user = await authRepository.updateLocale(userId, locale);
  const { passwordHash: _ph, refreshTokenHash: _rth, ...safeUser } = user;
  return safeUser;
}

/**
 * Verifica um access token e retorna o payload.
 * Usado pelo middleware de autenticação.
 */
export function verifyAccessToken(token: string): JwtPayload {
  const jwtSecret = getEnv("JWT_SECRET");
  return jwt.verify(token, jwtSecret) as JwtPayload;
}
