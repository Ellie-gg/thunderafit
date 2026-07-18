"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile } from "@/lib/api/connections";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { QueryError } from "@/components/query-error";
import { AvailabilityBadge } from "@/components/availability-badge";
import { AvatarUpload } from "@/components/avatar-upload";

function PerfilContent() {
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  const [available, setAvailable] = useState(false);
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [hydrated, setHydrated] = useState(false);

  // Popula o form uma vez, quando o perfil carrega.
  useEffect(() => {
    if (profileQuery.data && !hydrated) {
      setAvailable(profileQuery.data.profile.availableForNewStudents);
      setLocation(profileQuery.data.profile.location ?? "");
      setBio(profileQuery.data.profile.bio ?? "");
      setHydrated(true);
    }
  }, [profileQuery.data, hydrated]);

  const saveMutation = useMutation({
    mutationFn: () =>
      updateMyProfile({ availableForNewStudents: available, location, bio }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-profile"] });
    },
  });

  return (
    <>
      <AppHeader />
      <main className="flex flex-1 flex-col gap-6 px-6 py-8">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
            Perfil
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">Perfil público</h1>
          <p className="text-sm text-muted">
            Ative a disponibilidade para aparecer na busca de alunos. Você aprova cada
            solicitação manualmente.
          </p>
        </div>

        <Card>
          <h2 className="mb-3 font-display text-lg font-bold">Foto de perfil</h2>
          <AvatarUpload />
        </Card>

        {profileQuery.isLoading && <p className="text-sm text-muted">Carregando...</p>}
        {profileQuery.isError && (
          <QueryError error={profileQuery.error} onRetry={() => profileQuery.refetch()} />
        )}

        {profileQuery.isSuccess && (
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="font-semibold">Disponível para novos alunos</p>
                <p className="text-xs text-muted">
                  Quando ligado, seu perfil aparece na busca por localização.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <AvailabilityBadge available={available} />
                <button
                  type="button"
                  role="switch"
                  aria-checked={available}
                  aria-label="Disponível para novos alunos"
                  onClick={() => setAvailable((v) => !v)}
                  className="relative h-6 w-11 shrink-0 rounded-full border border-border transition-colors"
                  style={{ background: available ? "var(--accent)" : "var(--surface-raised)" }}
                >
                  <span
                    className="absolute top-0.5 h-4 w-4 rounded-full bg-ink-950 transition-all"
                    style={{ left: available ? "22px" : "3px" }}
                  />
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="location">Localização (cidade/estado)</Label>
              <Input
                id="location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Ex: Palhoça, SC"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="bio">Bio / especialidade</Label>
              <textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                rows={3}
                className="rounded-md border border-border bg-surface px-3.5 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                placeholder="Ex: Especialista em treino funcional e reabilitação."
              />
            </div>

            {saveMutation.isError && (
              <p className="text-sm text-danger">
                {saveMutation.error instanceof ApiError
                  ? saveMutation.error.message
                  : "Não foi possível salvar."}
              </p>
            )}
            {saveMutation.isSuccess && <p className="text-sm text-success">Perfil salvo.</p>}

            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="self-start">
              {saveMutation.isPending ? "Salvando..." : "Salvar perfil"}
            </Button>
          </Card>
        )}
      </main>
    </>
  );
}

export default function PerfilPage() {
  return (
    <AuthGuard allowedRoles={["PERSONAL"]}>
      <PerfilContent />
    </AuthGuard>
  );
}
