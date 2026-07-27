import { useTranslations } from "next-intl";
import { UserAvatar } from "@/components/user-avatar";
import type { Specialty } from "@/lib/constants/professional-directory";

/**
 * Fase 75: card de profissional reaproveitado tanto na busca do aluno
 * (/profissionais) quanto no preview "como vou aparecer" do perfil do
 * Personal — mesma aparência nos dois lugares, sem duplicar o layout.
 */
export function ProfessionalCard({
  email,
  avatarUrl,
  city,
  state,
  bio,
  specialties,
  isPlus,
}: {
  email: string;
  avatarUrl: string | null;
  city: string | null;
  state: string | null;
  bio: string | null;
  specialties: Specialty[];
  isPlus?: boolean;
}) {
  const t = useTranslations("specialty");
  const locationLabel = [city, state].filter(Boolean).join(", ");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-3">
        <UserAvatar email={email} avatarUrl={avatarUrl} size={40} />
        <div>
          <div className="flex items-center gap-2">
            <p className="font-semibold">{email.split("@")[0]}</p>
            {isPlus && (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                ★ Plus
              </span>
            )}
          </div>
          {locationLabel && <p className="text-xs text-muted">📍 {locationLabel}</p>}
        </div>
      </div>
      {bio && <p className="text-sm text-muted">{bio}</p>}
      {specialties.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {specialties.map((s) => (
            <span key={s} className="rounded-full bg-surface-raised px-2 py-0.5 text-xs text-muted">
              {t(s)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
