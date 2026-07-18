/**
 * Fase 30: avatar circular pequeno — sem foto, cai num fallback com a
 * inicial do e-mail. Componente puro (sem fetch próprio, sem estado),
 * reaproveitável em qualquer lugar que precise mostrar "a foto de alguém"
 * (hoje só o próprio usuário no AppHeader/tela de perfil).
 */
export function UserAvatar({
  email,
  avatarUrl,
  size = 32,
}: {
  email: string;
  avatarUrl: string | null;
  size?: number;
}) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-border object-cover"
        style={{ width: size, height: size }}
      />
    );
  }

  const initial = email.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised font-display font-bold text-accent"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {initial}
    </span>
  );
}
