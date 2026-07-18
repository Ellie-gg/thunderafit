import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { Role } from "@prisma/client";
import { authRepository } from "../repository/auth.repository";

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

  const { passwordHash: _ph, refreshTokenHash: _rth, ...safeUser } = user;
  return { accessToken, refreshToken, user: safeUser };
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

/**
 * Verifica um access token e retorna o payload.
 * Usado pelo middleware de autenticação.
 */
export function verifyAccessToken(token: string): JwtPayload {
  const jwtSecret = getEnv("JWT_SECRET");
  return jwt.verify(token, jwtSecret) as JwtPayload;
}
