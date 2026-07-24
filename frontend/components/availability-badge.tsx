"use client";

import { useTranslations } from "next-intl";

/**
 * Fase 21 — elemento de assinatura para o conceito de "descoberta".
 *
 * Em vez de um dot verde genérico de "online" (verde é reservado a status no
 * design Voltagem), a disponibilidade "aberto para novos alunos" é comunicada
 * no idioma do produto: uma pílula dourada (a cor de energia/treino desde a
 * Fase 5) com o raio ⚡ e um ponto "carregado" pulsante — a metáfora é uma
 * vaga de energia disponível, coerente com a Barra de Voltagem.
 */
export function AvailabilityBadge({ available }: { available: boolean }) {
  const t = useTranslations("availabilityBadge");
  if (!available) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-0.5 text-xs font-semibold text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--muted)]" aria-hidden />
        {t("full")}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
      style={{
        borderColor: "color-mix(in srgb, var(--accent) 50%, transparent)",
        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
        color: "var(--accent)",
      }}
    >
      <span aria-hidden>⚡</span>
      <span
        className="h-1.5 w-1.5 animate-pulse rounded-full"
        style={{ background: "var(--accent)", boxShadow: "0 0 6px 0 var(--accent)" }}
        aria-hidden
      />
      {t("openForNewStudents")}
    </span>
  );
}
