"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile } from "@/lib/api/connections";
import { ApiError } from "@/lib/api/client";
import { AuthGuard } from "@/components/auth-guard";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AvatarUpload } from "@/components/avatar-upload";
import { CityStateInput } from "@/components/city-state-input";
import { ChangePasswordCard } from "@/components/change-password-card";

/**
 * Fase 30: tela mínima de perfil do aluno — só a foto por enquanto (o
 * Personal já tinha /personal/perfil pra bio/localização; o aluno não tinha
 * nenhuma tela de perfil própria). Fica como ponto natural de extensão pra
 * futuras preferências do aluno, sem precisar de rota nova.
 *
 * Fase 75: ganha um card de cidade — mesmo campo estruturado usado na busca
 * de "Encontrar Personal" (/profissionais), só que editável aqui também,
 * sem precisar passar pela tela de busca de novo pra corrigir a cidade.
 */
function PerfilContent() {
  const t = useTranslations("alunoProfile");
  const tCommon = useTranslations("common");
  const queryClient = useQueryClient();
  const profileQuery = useQuery({ queryKey: ["my-profile"], queryFn: getMyProfile });

  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [hydrated, setHydrated] = useState(false);
  // Trava contra corrida: se o aluno já começar a digitar antes do perfil
  // terminar de carregar, o pré-preenchimento abaixo não pode sobrescrever o
  // que ele já digitou quando a resposta chegar.
  const userEditedRef = useRef(false);

  useEffect(() => {
    if (profileQuery.data && !hydrated) {
      if (!userEditedRef.current) {
        setCity(profileQuery.data.profile.city ?? "");
        setState(profileQuery.data.profile.state ?? "");
      }
      setHydrated(true);
    }
  }, [profileQuery.data, hydrated]);

  const saveMutation = useMutation({
    mutationFn: () => updateMyProfile({ city: city.trim() || null, state: state || null }),
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
            {t("eyebrow")}
          </span>
          <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
        </div>

        <Card>
          <h2 className="mb-3 font-display text-lg font-bold">{t("photoTitle")}</h2>
          <AvatarUpload />
        </Card>

        <ChangePasswordCard />

        <Card className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-bold">{t("cityTitle")}</h2>
            <p className="text-xs text-muted">{t("cityDescription")}</p>
          </div>

          {profileQuery.isLoading && <p className="text-sm text-muted">{tCommon("loading")}</p>}

          {profileQuery.isSuccess && (
            <>
              <CityStateInput
                city={city}
                state={state}
                onCityChange={(v) => {
                  userEditedRef.current = true;
                  setCity(v);
                }}
                onStateChange={(v) => {
                  userEditedRef.current = true;
                  setState(v);
                }}
              />

              {saveMutation.isError && (
                <p className="text-sm text-danger">
                  {saveMutation.error instanceof ApiError ? saveMutation.error.message : t("saveError")}
                </p>
              )}
              {saveMutation.isSuccess && <p className="text-sm text-success">{t("saveSuccess")}</p>}

              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="self-start"
              >
                {saveMutation.isPending ? t("saving") : t("saveButton")}
              </Button>
            </>
          )}
        </Card>
      </main>
    </>
  );
}

export default function PerfilPage() {
  return (
    <AuthGuard allowedRoles={["ALUNO"]}>
      <PerfilContent />
    </AuthGuard>
  );
}
