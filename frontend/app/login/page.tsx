"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { checkEmailRequest, loginRequest, registerRequest, googleAuthRequest } from "@/lib/api/auth";
import { previewClientInvite } from "@/lib/api/client-invites";
import { ApiError } from "@/lib/api/client";
import { useAuthStore } from "@/lib/store/auth-store";
import { dashboardPathForRole } from "@/lib/auth/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import type { Role } from "@/lib/types";

/**
 * Fase 24 (Parte 2): fluxo unificado — uma tela só de e-mail decide entre
 * login e cadastro (POST /api/auth/check-email, Parte 1). Substitui as
 * antigas /login e /register separadas.
 */
type Step = "email" | "login" | "signup-role" | "signup-details";
type SignupRole = Extract<Role, "ALUNO" | "PERSONAL">;

// i18n: guarda a CHAVE de tradução (namespace "login"), não o texto — resolvido
// dentro de cada componente via `t(...)`, já que este mapeamento vive fora de
// qualquer componente (sem acesso a hooks).
function roleTranslationKey(role: SignupRole): "aluno" | "personal" {
  return role === "ALUNO" ? "aluno" : "personal";
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof ApiError ? error.message : fallback;
}

// Fase 32.1: alterna a senha entre oculta/visível — útil pra conferir o que
// foi digitado quando o login falha por senha errada, sem depender do
// gerenciador de senha do navegador (que nem sempre está ativo).
function PasswordField({
  id,
  value,
  onChange,
  minLength,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  minLength?: number;
}) {
  const t = useTranslations("login");
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        required
        minLength={minLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="••••••••"
        className="pr-16"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute inset-y-0 right-0 px-3 text-xs font-semibold text-muted hover:text-foreground"
        aria-label={visible ? t("passwordField.hideAria") : t("passwordField.showAria")}
      >
        {visible ? t("passwordField.hide") : t("passwordField.show")}
      </button>
    </div>
  );
}

const ROLE_ICON: Record<SignupRole, string> = {
  PERSONAL: "🏋️",
  ALUNO: "⚡",
};

/**
 * Card interativo de seleção de papel (cadastro). Antes eram 2 botões de
 * mesmo peso visual (texto puro, sem ícone) — difícil bater o olho e saber
 * qual estava selecionado. Agora cada card tem ícone + título + descrição
 * própria, e acende com a cor do papel (dourado=Personal, ciano=Aluno —
 * mesma convenção já usada no resto do produto, ex: barra do AppHeader) só
 * quando selecionado.
 */
function RoleCard({
  signupRole,
  active,
  onClick,
}: {
  signupRole: SignupRole;
  active: boolean;
  onClick: () => void;
}) {
  const t = useTranslations("login");
  const roleKey = roleTranslationKey(signupRole);
  const activeClasses =
    signupRole === "PERSONAL"
      ? "border-accent bg-accent/10"
      : "border-accent-secondary bg-accent-secondary/10";
  const iconActiveClasses =
    signupRole === "PERSONAL"
      ? "bg-accent text-ink-950"
      : "bg-accent-secondary text-ink-950";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors ${
        active ? activeClasses : "border-border hover:border-foreground/40"
      }`}
    >
      <span
        aria-hidden
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg transition-colors ${
          active ? iconActiveClasses : "bg-surface-raised text-foreground"
        }`}
      >
        {ROLE_ICON[signupRole]}
      </span>
      <span className="flex flex-col gap-0.5 pt-0.5">
        <span className="font-display text-sm font-bold text-foreground">
          {t(`roles.${roleKey}.cardTitle`)}
        </span>
        <span className="text-xs text-muted">{t(`roles.${roleKey}.cardDescription`)}</span>
      </span>
    </button>
  );
}

function LoginPageContent() {
  const t = useTranslations("login");
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);
  const searchParams = useSearchParams();

  // Fase 104 — convite por link: `?invite=` carrega um token que, se
  // válido, (a) mostra pra quem chegou aqui de quem é o convite, e (b)
  // pula a escolha de papel — o convite já implica "vire meu aluno", não
  // faz sentido perguntar de novo. Token inválido/expirado/já usado não
  // trava nada — só não pula a etapa nem mostra o contexto, cadastro/login
  // seguem normais (o backend também ignora silenciosamente um token morto).
  const inviteToken = searchParams.get("invite");
  const inviteQuery = useQuery({
    queryKey: ["client-invite-preview", inviteToken],
    queryFn: () => previewClientInvite(inviteToken!),
    enabled: !!inviteToken,
  });
  const inviteIsValid = !!inviteToken && inviteQuery.data?.valid === true;

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [signupRole, setSignupRole] = useState<SignupRole | null>(null);
  // Fase 77 — SSO Google: quando preenchido, a tela de escolha de papel
  // (signup-role, reaproveitada do cadastro tradicional) sabe que deve
  // finalizar direto pelo Google em vez de seguir pro passo de nome/senha.
  const [googleIdToken, setGoogleIdToken] = useState<string | null>(null);

  const checkEmailMutation = useMutation({
    mutationFn: () => checkEmailRequest(email.trim()),
    onSuccess: ({ exists }) => {
      if (exists) {
        setStep("login");
        return;
      }
      // Convite válido + e-mail novo: pula a escolha de papel, já sabemos
      // que é ALUNO.
      if (inviteIsValid) {
        setSignupRole("ALUNO");
        setStep("signup-details");
        return;
      }
      setStep("signup-role");
    },
  });

  const loginMutation = useMutation({
    mutationFn: () => loginRequest(email.trim(), password, inviteToken ?? undefined),
    onSuccess: (data) => {
      setSession(data.user);
      router.push(dashboardPathForRole(data.user.role));
    },
  });

  const registerMutation = useMutation({
    mutationFn: async () => {
      await registerRequest(email.trim(), password, signupRole!, name.trim(), inviteToken ?? undefined);
      return loginRequest(email.trim(), password); // encadeia login pra pegar cookies+user, mesmo padrão do /register antigo
    },
    onSuccess: (data) => {
      setSession(data.user);
      router.push(dashboardPathForRole(data.user.role));
    },
  });

  // Fase 77 — SSO Google: mesmo endpoint pros 2 casos. Sem `role`: login
  // direto se a conta já existir (o clique no botão do Google já chama
  // assim). Com `role`: finaliza uma conta nova (chamado a partir do passo
  // signup-role, reaproveitado do cadastro tradicional).
  const googleAuthMutation = useMutation({
    mutationFn: (vars: { idToken: string; role?: Role }) =>
      googleAuthRequest(vars.idToken, vars.role, inviteToken ?? undefined),
    onSuccess: (data, vars) => {
      if (data.needsRole) {
        // Fase 104: mesma lógica do checkEmailMutation acima — convite
        // válido pula a escolha de papel, finaliza direto como ALUNO.
        if (inviteIsValid) {
          googleAuthMutation.mutate({ idToken: vars.idToken, role: "ALUNO" });
          return;
        }
        setEmail(data.email);
        setGoogleIdToken(vars.idToken);
        setStep("signup-role");
        return;
      }
      setSession(data.user);
      router.push(dashboardPathForRole(data.user.role));
    },
  });

  function backToEmail() {
    setStep("email");
    setPassword("");
    setName("");
    setSignupRole(null);
    setGoogleIdToken(null);
    checkEmailMutation.reset();
    googleAuthMutation.reset();
  }

  const emailLooksValid = /\S+@\S+\.\S+/.test(email);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-12">
      <div className="mb-6 flex flex-col items-center gap-3">
        <span className="text-3xl" aria-hidden>
          ⚡
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
          ThunderaFit
        </h1>
      </div>

      {/* Fase 104 — contexto do convite: visível em toda etapa (não só na
          de e-mail), pra quem veio de um link de convite nunca perder de
          vista de quem é o convite enquanto passa pelas próximas telas. */}
      {inviteIsValid && inviteQuery.data && (
        <div className="mb-6 max-w-sm rounded-full border border-accent-secondary/50 bg-accent-secondary/10 px-4 py-2 text-center text-sm text-foreground">
          {t("inviteContext.message", { name: inviteQuery.data.professionalName ?? "" })}
        </div>
      )}

      {/* Hero: só na tela de entrada — as demais etapas (login/cadastro) já
          têm seu próprio título contextual dentro do Card, uma tagline de
          marketing ali só repetiria informação. */}
      {step === "email" && (
        <div className="mb-8 max-w-md text-center">
          <h2 className="mb-3 font-display text-2xl font-bold leading-snug tracking-tight text-foreground sm:text-3xl">
            {t("hero.headline")}
          </h2>
          <p className="text-sm text-muted sm:text-base">{t("hero.subtitle")}</p>
        </div>
      )}

      {step === "email" && (
        <Card
          className="w-full max-w-sm"
          style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}
        >
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              checkEmailMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">{t("emailStep.emailLabel")}</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t("emailStep.emailPlaceholder")}
              />
            </div>

            {checkEmailMutation.isError && (
              <p className="text-sm text-danger">
                {errorMessage(checkEmailMutation.error, t("connectionError"))}
              </p>
            )}

            <Button
              type="submit"
              disabled={!emailLooksValid || checkEmailMutation.isPending}
              className="mt-2"
            >
              {checkEmailMutation.isPending ? t("emailStep.submitting") : t("continue")}
            </Button>
          </form>

          {/* Sem NEXT_PUBLIC_GOOGLE_CLIENT_ID configurado (ex: ambiente local
              sem .env preenchido ainda), some com o divisor também — não
              faz sentido mostrar "ou" sem nada embaixo. */}
          {process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && (
            <>
              <div className="my-5 flex items-center gap-3">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted">{t("orDivider")}</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <GoogleSignInButton
                onCredential={(idToken) => googleAuthMutation.mutate({ idToken })}
              />

              {googleAuthMutation.isError && (
                <p className="mt-3 text-sm text-danger">
                  {errorMessage(googleAuthMutation.error, t("connectionError"))}
                </p>
              )}
            </>
          )}
        </Card>
      )}

      {/* Fase 82: rodapé de disponibilidade — texto honesto sobre o estado
          real do app (Fase 19 confirmou a viabilidade técnica via Capacitor,
          mas o Android ainda não foi publicado na Play Store) em vez de
          prometer uma loja que ainda não existe. */}
      {step === "email" && (
        <p className="mt-6 flex items-center gap-2 text-xs text-muted">
          <span aria-hidden>🌐</span>
          {t("hero.availability")}
        </p>
      )}

      {step === "login" && (
        <Card
          className="w-full max-w-sm"
          style={{ borderTopWidth: "4px", borderTopColor: "var(--accent)" }}
        >
          <button
            type="button"
            onClick={backToEmail}
            className="mb-4 text-xs font-semibold text-muted hover:text-foreground"
          >
            {t("backToEmail")}
          </button>

          <span className="mb-4 inline-block rounded-full border border-accent/50 bg-accent/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent">
            {t("loginStep.badge")}
          </span>

          <h2 className="mb-1 font-display text-xl font-bold text-foreground">
            {t("loginStep.title")}
          </h2>
          <p className="mb-5 text-sm text-muted">{email}</p>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              loginMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t("loginStep.passwordLabel")}</Label>
                <Link href="/esqueci-senha" className="text-xs font-semibold text-muted hover:text-foreground">
                  {t("loginStep.forgotPassword")}
                </Link>
              </div>
              <PasswordField id="password" value={password} onChange={setPassword} />
            </div>

            {loginMutation.isError && (
              <p className="text-sm text-danger">
                {errorMessage(loginMutation.error, t("connectionError"))}
              </p>
            )}

            <Button type="submit" disabled={loginMutation.isPending} className="mt-2">
              {loginMutation.isPending ? t("loginStep.submitting") : t("loginStep.submit")}
            </Button>
          </form>
        </Card>
      )}

      {step === "signup-role" && (
        <Card
          className="w-full max-w-sm"
          style={{ borderTopWidth: "4px", borderTopColor: "var(--accent-secondary)" }}
        >
          <button
            type="button"
            onClick={backToEmail}
            className="mb-4 text-xs font-semibold text-muted hover:text-foreground"
          >
            {t("backToEmail")}
          </button>

          <span className="mb-4 inline-block rounded-full border border-accent-secondary/50 bg-accent-secondary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-secondary">
            {t("signupRoleStep.badge")}
          </span>

          <h2 className="mb-1 font-display text-xl font-bold text-foreground">
            {t("signupRoleStep.title")}
          </h2>
          <p className="mb-1 text-sm text-muted">{email}</p>
          <p className="mb-5 text-sm text-muted">{t("signupRoleStep.question")}</p>

          <div className="mb-5 flex flex-col gap-3">
            <RoleCard
              signupRole="PERSONAL"
              active={signupRole === "PERSONAL"}
              onClick={() => setSignupRole("PERSONAL")}
            />
            <RoleCard
              signupRole="ALUNO"
              active={signupRole === "ALUNO"}
              onClick={() => setSignupRole("ALUNO")}
            />
          </div>

          {googleAuthMutation.isError && (
            <p className="mb-3 text-sm text-danger">
              {errorMessage(googleAuthMutation.error, t("connectionError"))}
            </p>
          )}

          {/* Fase 91: aceite de Termos/Privacidade — exibido aqui porque o
              botão logo abaixo já cria a conta de fato quando o cadastro vem
              via Google (sem passar pelo passo "signup-details"). */}
          <p className="mb-3 text-xs text-muted">
            {t.rich("termsAcceptance", {
              terms: (chunks) => (
                <Link href="/termos-de-uso" target="_blank" className="font-semibold underline">
                  {chunks}
                </Link>
              ),
              privacy: (chunks) => (
                <Link href="/politica-de-privacidade" target="_blank" className="font-semibold underline">
                  {chunks}
                </Link>
              ),
            })}
          </p>

          <Button
            type="button"
            variant="accentSecondary"
            disabled={!signupRole || googleAuthMutation.isPending}
            onClick={() => {
              // Fase 77: veio do botão do Google — já temos o idToken
              // verificado, só falta o papel. Cria a conta direto, sem
              // passar pelo passo de nome/senha (Google já dá o nome).
              if (googleIdToken) {
                googleAuthMutation.mutate({ idToken: googleIdToken, role: signupRole! });
                return;
              }
              setStep("signup-details");
            }}
          >
            {googleAuthMutation.isPending ? t("loginStep.submitting") : t("continue")}
          </Button>
        </Card>
      )}

      {step === "signup-details" && signupRole && (
        <Card
          className="w-full max-w-sm"
          style={{ borderTopWidth: "4px", borderTopColor: "var(--accent-secondary)" }}
        >
          <button
            type="button"
            onClick={() => setStep("signup-role")}
            className="mb-4 text-xs font-semibold text-muted hover:text-foreground"
          >
            {t("backToRole")}
          </button>

          <span className="mb-4 inline-block rounded-full border border-accent-secondary/50 bg-accent-secondary/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-secondary">
            {t(`roles.${roleTranslationKey(signupRole)}.chip`)}
          </span>

          <h2 className="mb-1 font-display text-xl font-bold text-foreground">
            {t("signupDetailsStep.title")}
          </h2>
          <p className="mb-5 text-sm text-muted">{email}</p>

          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              registerMutation.mutate();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">{t("signupDetailsStep.nameLabel")}</Label>
              <Input
                id="name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("signupDetailsStep.namePlaceholder")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">{t("signupDetailsStep.passwordLabel")}</Label>
              <PasswordField id="password" value={password} onChange={setPassword} minLength={8} />
            </div>

            {registerMutation.isError && (
              <p className="text-sm text-danger">
                {errorMessage(registerMutation.error, t("connectionError"))}
              </p>
            )}

            <p className="text-xs text-muted">
              {t.rich("termsAcceptance", {
                terms: (chunks) => (
                  <Link href="/termos-de-uso" target="_blank" className="font-semibold underline">
                    {chunks}
                  </Link>
                ),
                privacy: (chunks) => (
                  <Link href="/politica-de-privacidade" target="_blank" className="font-semibold underline">
                    {chunks}
                  </Link>
                ),
              })}
            </p>

            <Button
              type="submit"
              variant="accentSecondary"
              disabled={registerMutation.isPending}
              className="mt-2"
            >
              {registerMutation.isPending
                ? t("signupDetailsStep.submitting")
                : t("signupDetailsStep.submit")}
            </Button>
          </form>
        </Card>
      )}
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageContent />
    </Suspense>
  );
}
