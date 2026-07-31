import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { Role, Locale } from "@prisma/client";
import { authRepository } from "../repository/auth.repository";
import { relationsService } from "../../fitness/services/relations.service";
import { clientInvitesService } from "../../fitness/services/client-invites.service";
import { deleteUserCascade } from "../../lib/user-deletion";
import { sendMail } from "../../lib/mailer";
import { toSafeUser } from "../../lib/safe-user";

const BCRYPT_SALT_ROUNDS = 12;
const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

// Fase 81 — confirmação de e-mail + "esqueci minha senha". Token de 256 bits
// (bem acima dos 128 bits mínimos recomendados pelo OWASP Forgot Password
// Cheat Sheet), nunca guardado em texto puro — só o hash sha256 (rápido de
// propósito: ao contrário de senha, o token já nasce com entropia alta, não
// precisa do custo computacional do bcrypt pra se proteger de força bruta).
const EMAIL_VERIFICATION_TOKEN_BYTES = 32;
const EMAIL_VERIFICATION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24h
const PASSWORD_RESET_TOKEN_BYTES = 32;
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1h — janela curta, recomendação OWASP (15-60min)

function generateRawToken(bytes: number): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/**
 * Achado real (auditoria 2026-07-31, A1): `checkAndFireDueReminders` era
 * chamado direto (sem try/catch) em login/refresh/SSO Google — uma falha ali
 * (timeout do banco, erro ao criar a notificação) derrubava o fluxo inteiro
 * com 500, e no caso do `refresh()` especificamente, o novo refresh token JÁ
 * tinha sido gravado antes dessa chamada, deixando o cliente com um token
 * órfão que dispararia a detecção de reuso (roubo) na tentativa seguinte —
 * um erro de lembrete de pagamento derrubando a sessão inteira do usuário.
 * Nunca deve poder quebrar login/refresh/SSO — é best-effort por natureza
 * (mesmo espírito do `try/catch` já existente em `sendVerificationEmail`
 * logo abaixo).
 */
async function safeCheckAndFireDueReminders(userId: string): Promise<void> {
  try {
    await relationsService.checkAndFireDueReminders(userId);
  } catch (err) {
    console.error("Falha ao checar/disparar lembrete de pagamento:", err);
  }
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

const MIN_PASSWORD_LENGTH = 8;

// Fase 90: `toSafeUser` extraído pra `src/lib/safe-user.ts` (reaproveitado
// agora também pelo domínio admin) — ver o comentário lá pro rationale
// completo de por que cada campo é removido.

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
  // Fase 104 — convite por link (só consumido se role === ALUNO — ver
  // comentário em `register()`).
  inviteToken?: string;
}

export interface LoginInput {
  email: string;
  password: string;
  // Fase 104 — mesma ideia de RegisterInput.inviteToken: cobre o caso de
  // quem clica no link do convite mas JÁ tinha conta (login em vez de
  // cadastro) — o vínculo automático acontece do mesmo jeito.
  inviteToken?: string;
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
// A6 (auditoria 2026-07-31): `register()` nunca validava formato de e-mail
// nem tamanho mínimo de senha (só presença) — diferente de `resetPassword`/
// `changePassword`, que já exigem `MIN_PASSWORD_LENGTH`, e de `checkEmailExists`/
// `requestPasswordReset` no controller, que já exigem este mesmo formato de
// e-mail. Duplicar o regex aqui (em vez de importar do controller) preserva
// a direção normal de dependência (controller → service, nunca o contrário).
const REGISTER_EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function register(input: RegisterInput) {
  // A2: normaliza ANTES de validar o formato — trim primeiro, senão um
  // e-mail colado com espaço (erro de copiar/colar comum) falharia a
  // validação de formato por causa do espaço, não por ser realmente
  // inválido. O repositório normaliza de novo na escrita/leitura (defesa em
  // profundidade, idempotente) — normalizar aqui também é o que permite
  // validar o formato do valor que de fato vai ser gravado.
  const email = input.email.trim().toLowerCase();

  if (!REGISTER_EMAIL_FORMAT_REGEX.test(email)) {
    const err = new Error("E-mail em formato inválido.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  if (input.password.length < MIN_PASSWORD_LENGTH) {
    const err = new Error(`A senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }

  const existing = await authRepository.findByEmail(email);
  if (existing) {
    const err = new Error("E-mail já cadastrado.");
    (err as Error & { statusCode: number }).statusCode = 409;
    throw err;
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS);

  let user;
  try {
    user = await authRepository.createUser({
      email,
      passwordHash,
      role: input.role,
      name: input.name,
    });
  } catch (err) {
    // A11 (auditoria 2026-07-31): 2 cadastros concorrentes com o mesmo
    // e-mail (duplo clique, 2 abas) passam ambos pelo `findByEmail` acima
    // antes de qualquer um dos dois existir — o 2º `createUser` estoura a
    // constraint única do banco. Sem isso, virava 500 com a mensagem crua do
    // Prisma em vez do 409 "E-mail já cadastrado." que este mesmo serviço já
    // define alguns segundos antes.
    if ((err as { code?: string })?.code === "P2002") {
      const dupErr = new Error("E-mail já cadastrado.");
      (dupErr as Error & { statusCode: number }).statusCode = 409;
      throw dupErr;
    }
    throw err;
  }

  // Fase 81: dispara o e-mail de confirmação — best-effort, nunca derruba o
  // cadastro se o envio falhar (mesmo espírito do Fale Conosco: a conta já
  // foi criada de verdade, o resto é best-effort por cima).
  try {
    await sendVerificationEmail(user.id, user.email);
  } catch (err) {
    console.error("Falha ao enviar e-mail de verificação:", err);
  }

  // Fase 104 — convite por link: só ALUNO consome (o convite é "vire meu
  // aluno" — um PERSONAL/NUTRICIONISTA se cadastrando pelo mesmo link, por
  // engano ou não, nunca deveria virar cliente de outro profissional).
  // `consumeInvite` já é melhor-esforço por dentro (nunca lança).
  if (input.inviteToken && input.role === "ALUNO") {
    await clientInvitesService.consumeInvite(input.inviteToken, user.id);
  }

  // Nunca retornar passwordHash nem refreshTokenHash
  const safeUser = toSafeUser(user);
  return safeUser;
}

/**
 * Fase 81 — gera um novo token de verificação (invalida qualquer link
 * anterior ainda não usado, mesmo padrão de "1 token ativo por vez" do
 * refreshTokenHash) e manda o e-mail. Reaproveitada tanto no cadastro
 * quanto no botão "reenviar e-mail de verificação".
 */
export async function sendVerificationEmail(userId: string, email: string) {
  const rawToken = generateRawToken(EMAIL_VERIFICATION_TOKEN_BYTES);
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_EXPIRY_MS);
  await authRepository.setEmailVerificationToken(userId, hashToken(rawToken), expiresAt);

  const appUrl = getEnv("ALLOWED_ORIGIN");
  const link = `${appUrl}/verificar-email?uid=${userId}&token=${rawToken}`;
  await sendMail({
    to: email,
    subject: "Confirme seu e-mail — ThunderaFit",
    text: `Confirme seu e-mail clicando no link abaixo (válido por 24 horas):\n\n${link}\n\nSe você não criou uma conta no ThunderaFit, ignore este e-mail.`,
  });
}

export async function resendVerificationEmail(userId: string) {
  const user = await authRepository.findById(userId);
  if (!user) {
    const err = new Error("Usuário não encontrado.");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }
  if (user.emailVerifiedAt) {
    const err = new Error("Este e-mail já foi confirmado.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  await sendVerificationEmail(user.id, user.email);
}

/**
 * Fase 81 — confirma o e-mail a partir do link. Idempotente: clicar de novo
 * num link já usado (ou numa conta já verificada por outro meio) não é
 * erro, só não faz nada de novo.
 */
export async function verifyEmail(userId: string, token: string) {
  const user = await authRepository.findById(userId);
  if (!user) {
    const err = new Error("Link de verificação inválido.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  if (user.emailVerifiedAt) {
    const safeUser = toSafeUser(user);
    return safeUser;
  }
  if (!user.emailVerificationTokenHash || !user.emailVerificationTokenExpiresAt) {
    const err = new Error("Link de verificação inválido ou já usado.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  if (user.emailVerificationTokenExpiresAt.getTime() < Date.now()) {
    const err = new Error("Link de verificação expirado. Peça um novo.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  if (hashToken(token) !== user.emailVerificationTokenHash) {
    const err = new Error("Link de verificação inválido.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }

  const updated = await authRepository.markEmailVerified(userId);
  const safeUser = toSafeUser(updated);
  return safeUser;
}

/**
 * Fase 81 — "esqueci minha senha". SEMPRE resolve sem lançar erro,
 * independente de o e-mail existir ou não (defesa OWASP contra
 * enumeração de contas — a resposta do controller é idêntica nos dois
 * casos, então não há nada aqui pra vazar).
 */
export async function requestPasswordReset(email: string) {
  const user = await authRepository.findByEmail(email);
  if (!user) return;

  // A9 (auditoria 2026-07-31): `getEnv("ALLOWED_ORIGIN")` lança se a env var
  // faltar — isso rodava DEPOIS de já gravar o token novo no banco, então um
  // ambiente mal configurado apagava (sobrescrevia) um link de reset VÁLIDO
  // que a pessoa já tivesse recebido antes, sem nunca enviar o novo e-mail
  // no lugar. Monta o link ANTES de tocar no banco — se faltar a env var,
  // não escreve nada, e o link anterior (se existir) continua íntegro.
  const rawToken = generateRawToken(PASSWORD_RESET_TOKEN_BYTES);
  const appUrl = getEnv("ALLOWED_ORIGIN");
  const link = `${appUrl}/redefinir-senha?uid=${user.id}&token=${rawToken}`;

  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);
  await authRepository.setPasswordResetToken(user.id, hashToken(rawToken), expiresAt);

  try {
    await sendMail({
      to: user.email,
      subject: "Redefinir sua senha — ThunderaFit",
      text: `Alguém (esperamos que você) pediu pra redefinir a senha da sua conta ThunderaFit. Clique no link abaixo (válido por 1 hora):\n\n${link}\n\nSe não foi você, ignore este e-mail — sua senha continua a mesma.`,
    });
  } catch (err) {
    console.error("Falha ao enviar e-mail de redefinição de senha:", err);
  }
}

/**
 * Fase 81 — confirma o link de "esqueci minha senha" e troca a senha.
 * Best practice OWASP: invalida TODAS as sessões existentes depois de um
 * reset (limpa `refreshTokenHash`) — se alguém tinha acesso via sessão
 * roubada, é derrubado assim que a senha muda.
 */
export async function resetPassword(userId: string, token: string, newPassword: string) {
  if (!newPassword || newPassword.length < MIN_PASSWORD_LENGTH) {
    const err = new Error(`A nova senha deve ter pelo menos ${MIN_PASSWORD_LENGTH} caracteres.`);
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }

  const user = await authRepository.findById(userId);
  if (!user || !user.passwordResetTokenHash || !user.passwordResetTokenExpiresAt) {
    const err = new Error("Link inválido ou expirado.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  if (user.passwordResetTokenExpiresAt.getTime() < Date.now()) {
    const err = new Error("Link expirado. Solicite um novo.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }
  if (hashToken(token) !== user.passwordResetTokenHash) {
    const err = new Error("Link inválido.");
    (err as Error & { statusCode: number }).statusCode = 400;
    throw err;
  }

  const newHash = await bcrypt.hash(newPassword, BCRYPT_SALT_ROUNDS);
  await authRepository.updatePasswordHash(userId, newHash);
  await authRepository.clearPasswordResetToken(userId);
  await authRepository.updateRefreshTokenHash(userId, null);
}

/**
 * Fase 81 — "Excluir minha conta". Conta tradicional precisa confirmar com
 * a senha atual (evita que uma sessão esquecida aberta num computador
 * compartilhado apague a conta com um clique); conta só-Google não tem
 * senha pra pedir — a confirmação forte fica a cargo do frontend (diálogo
 * exigindo digitar algo, mesmo padrão do botão de remoção do admin).
 * Mesmo guard de "último ADMIN" do admin.service — a pessoa consegue votar
 * a se auto-remover mesmo sendo o único ADMIN, o que travaria o /nimbus
 * inteiro sem ninguém pra reverter.
 */
export async function deleteMyAccount(userId: string, password: string | null) {
  const user = await authRepository.findById(userId);
  if (!user) {
    const err = new Error("Usuário não encontrado.");
    (err as Error & { statusCode: number }).statusCode = 404;
    throw err;
  }

  if (user.passwordHash) {
    if (!password) {
      const err = new Error("Senha é obrigatória para confirmar a remoção da conta.");
      (err as Error & { statusCode: number }).statusCode = 400;
      throw err;
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      const err = new Error("Senha incorreta.");
      (err as Error & { statusCode: number }).statusCode = 401;
      throw err;
    }
  }

  if (user.role === "ADMIN") {
    const adminCount = await authRepository.countAdmins();
    if (adminCount <= 1) {
      const err = new Error(
        "Você é o último administrador do sistema — não é possível remover esta conta."
      );
      (err as Error & { statusCode: number }).statusCode = 400;
      throw err;
    }
  }

  await deleteUserCascade(userId);
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
    await safeCheckAndFireDueReminders(user.id);
  }

  // Fase 104 — cobre quem clica no link do convite mas JÁ tinha conta
  // (login em vez de cadastro) — mesmo raciocínio de `register()` acima.
  if (input.inviteToken && user.role === "ALUNO") {
    await clientInvitesService.consumeInvite(input.inviteToken, user.id);
  }

  const safeUser = toSafeUser(user);
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
export async function loginOrRegisterWithGoogle(idToken: string, role?: Role, inviteToken?: string) {
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
  // A3 (auditoria 2026-07-31): busca por `googleId` PRIMEIRO — é o
  // identificador estável (o comentário do schema já dizia isso, mas
  // `findByGoogleId` nunca tinha chamador nenhum, era código morto). Antes,
  // buscar só por e-mail quebrava se a pessoa trocasse o e-mail primário da
  // conta Google depois de já ter linkado aqui: `findByEmail` não achava
  // mais a conta existente, caía no ramo de CRIAR conta nova com o mesmo
  // `googleId` já em uso → 500 (`Unique constraint failed on the fields:
  // (googleId)`) — a pessoa nunca mais conseguia entrar por Google. Buscar
  // por `googleId` primeiro resolve a conta certa independente do e-mail
  // atual no Google.
  let user = await authRepository.findByGoogleId(googleId);
  if (!user) {
    user = await authRepository.findByEmail(email);
  }

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
    // Fase 81: o Google já verificou `email_verified` antes de emitir o
    // idToken (checado acima) — não faz sentido pedir pra essa conta
    // confirmar de novo um e-mail que o próprio provedor já garantiu.
    user = await authRepository.markEmailVerifiedAt(user.id, new Date());
  } else if (!user.googleId) {
    user = await authRepository.linkGoogleId(user.id, googleId);
  }

  const jwtPayload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
  const { accessToken, refreshToken } = generateTokens(jwtPayload);

  const refreshTokenHash = await bcrypt.hash(refreshToken, BCRYPT_SALT_ROUNDS);
  await authRepository.updateRefreshTokenHash(user.id, refreshTokenHash);
  await authRepository.recordLogin(user.id, null);

  if (user.role === "ALUNO") {
    await safeCheckAndFireDueReminders(user.id);
  }

  // Fase 104 — mesmo raciocínio de register()/login(): cobre tanto quem se
  // cadastra quanto quem já tinha conta e faz login, ambos via Google.
  if (inviteToken && user.role === "ALUNO") {
    await clientInvitesService.consumeInvite(inviteToken, user.id);
  }

  const safeUser = toSafeUser(user);
  return { needsRole: false as const, accessToken, refreshToken, user: safeUser };
}

/**
 * Rotaciona o refresh token.
 * Valida o token enviado contra o hash no banco e emite novos tokens.
 *
 * Achado real em produção (correção pós-lançamento): `checkAndFireDueReminders`
 * só era chamado em `login()`/`loginOrRegisterWithGoogle()`, mas o access
 * token dura só 15min (`ACCESS_TOKEN_EXPIRY` acima) e o cliente renova via
 * ESTE endpoint (cookie httpOnly, transparente) sempre que leva um 401 — um
 * aluno que continua usando o app dentro da janela de 7 dias do refresh token
 * nunca chama `/api/auth/login` de novo depois do primeiro login. Resultado:
 * o lembrete de pagamento nunca disparava pra quem já estava "sempre logado"
 * (o caso mais comum). Chamado aqui também fecha essa lacuna sem precisar de
 * scheduler — mesma filosofia "simples, checa em toda interação real" já
 * documentada no comentário de `checkAndFireDueReminders`.
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

  if (user.role === "ALUNO") {
    await safeCheckAndFireDueReminders(user.id);
  }

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
  const safeUser = toSafeUser(user);
  return safeUser;
}

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
  const safeUser = toSafeUser(updated);
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
  const safeUser = toSafeUser(user);
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
