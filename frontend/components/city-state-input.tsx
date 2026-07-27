"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { BR_STATES } from "@/lib/constants/professional-directory";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Fase 75: cidade/UF estruturados, reaproveitados tanto pelo aluno (cidade
 * de busca) quanto pelo Personal (cidade do perfil público) — mesmo par de
 * campos dos dois lados, pra bater exatamente na busca/filtro (igualdade,
 * não "contains"). UF é select fechado (27 opções); cidade continua um
 * input de texto (não existe uma lista fechada de municípios no sistema),
 * mas o valor é normalizado (trim) antes de salvar no backend.
 *
 * "Usar minha localização atual" chama a Nominatim (OpenStreetMap) — serviço
 * gratuito e sem chave, mas de terceiros e com limite de uso educado (não é
 * SLA); se falhar ou o navegador negar a permissão, o campo de texto
 * continua sempre disponível pra digitar manualmente.
 */
export function CityStateInput({
  city,
  state,
  onCityChange,
  onStateChange,
}: {
  city: string;
  state: string;
  onCityChange: (value: string) => void;
  onStateChange: (value: string) => void;
}) {
  const t = useTranslations("cityStateInput");
  const [geoStatus, setGeoStatus] = useState<"idle" | "loading" | "error">("idle");

  function useCurrentLocation() {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setGeoStatus("error");
      return;
    }
    setGeoStatus("loading");
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&accept-language=pt-BR`,
            { headers: { Accept: "application/json" } }
          );
          if (!res.ok) throw new Error("reverse geocoding failed");
          const data = await res.json();
          const address = data?.address ?? {};
          const cityGuess: string =
            address.city || address.town || address.village || address.municipality || "";
          const isoState: string =
            typeof address["ISO3166-2-lvl4"] === "string" ? address["ISO3166-2-lvl4"].split("-")[1] ?? "" : "";
          if (cityGuess) onCityChange(cityGuess);
          if (isoState && (BR_STATES as readonly string[]).includes(isoState)) onStateChange(isoState);
          setGeoStatus("idle");
        } catch {
          setGeoStatus("error");
        }
      },
      () => setGeoStatus("error"),
      { timeout: 10000 }
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="city-input">{t("cityLabel")}</Label>
          <Input
            id="city-input"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder={t("cityPlaceholder")}
          />
        </div>
        <div className="flex w-24 flex-col gap-1.5">
          <Label htmlFor="state-input">{t("stateLabel")}</Label>
          <select
            id="state-input"
            value={state}
            onChange={(e) => onStateChange(e.target.value)}
            className="h-11 rounded-md border border-border bg-surface px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <option value="">{t("stateEmpty")}</option>
            {BR_STATES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Button
        type="button"
        variant="secondary"
        className="self-start"
        disabled={geoStatus === "loading"}
        onClick={useCurrentLocation}
      >
        {geoStatus === "loading" ? t("locating") : t("useMyLocation")}
      </Button>
      {geoStatus === "error" && <p className="text-xs text-danger">{t("locationError")}</p>}
    </div>
  );
}
