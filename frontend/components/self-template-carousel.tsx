"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import type { WorkoutProgram } from "@/lib/types";

/**
 * Fase 52: carrossel horizontal (scroll-snap nativo, sem lib nova — este
 * projeto deliberadamente não tem embla/swiper/etc) usado pelas seções
 * "Treino em Casa" e "Treinos Premium" de /meu-treino-pessoal. Componente
 * "burro": não sabe a diferença entre aplicar de verdade (Casa) e mostrar
 * "em breve" (Premium) — quem decide o que `onSelect` significa é a página
 * que o usa. `locked` só controla o badge visual de cadeado.
 *
 * Lista vazia: renderiza `null` (a página decide o texto de empty-state,
 * igual já faz com a lista plana de "Geral").
 */
export function SelfTemplateCarousel({
  templates,
  locked = false,
  onSelect,
}: {
  templates: WorkoutProgram[];
  locked?: boolean;
  onSelect: (template: WorkoutProgram) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const slideRefs = React.useRef<Array<HTMLDivElement | null>>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);

  // Rastreia o slide ativo via IntersectionObserver (um observer, todos os
  // slides) em vez de um listener de scroll com throttle manual — mais
  // simples e já suficiente pra destacar o "dot" certo.
  React.useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = slideRefs.current.findIndex((el) => el === entry.target);
            if (index !== -1) setActiveIndex(index);
          }
        }
      },
      { root: container, threshold: [0.5] }
    );

    slideRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [templates.length]);

  if (templates.length === 0) return null;

  function scrollToIndex(index: number) {
    const slide = slideRefs.current[index];
    slide?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        ref={containerRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2"
      >
        {templates.map((tpl, index) => (
          <div
            key={tpl.id}
            ref={(el) => {
              slideRefs.current[index] = el;
            }}
            className="w-[280px] shrink-0 snap-center"
          >
            <SelfTemplateSlide template={tpl} locked={locked} onSelect={() => onSelect(tpl)} />
          </div>
        ))}
      </div>

      {templates.length > 1 && (
        <div className="flex justify-center gap-1.5">
          {templates.map((tpl, index) => (
            <button
              key={tpl.id}
              type="button"
              aria-label={`Slide ${index + 1}`}
              onClick={() => scrollToIndex(index)}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                index === activeIndex ? "bg-accent" : "bg-border"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function SelfTemplateSlide({
  template,
  locked,
  onSelect,
}: {
  template: WorkoutProgram;
  locked: boolean;
  onSelect: () => void;
}) {
  if (!template.bannerImageUrl) {
    return (
      <Card
        onClick={onSelect}
        className="relative flex aspect-video w-full cursor-pointer flex-col items-center justify-center gap-1 text-center hover:border-accent-secondary"
      >
        {locked && <LockBadge />}
        <h3 className="font-display text-base font-bold">{template.name}</h3>
      </Card>
    );
  }

  // O banner já vem com o nome estilizado embutido na própria imagem
  // (gerado/escolhido pelo admin) — sem overlay de texto nem gradiente de
  // legibilidade por cima: eram redundantes com o nome já desenhado na
  // imagem. `alt` carrega o nome pra acessibilidade, já que não há mais
  // texto visível na tela pra isso.
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative block aspect-video w-full overflow-hidden rounded-xl border border-border"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={template.bannerImageUrl}
        alt={template.name}
        className="absolute inset-0 h-full w-full object-cover"
      />
      {locked && <LockBadge />}
    </button>
  );
}

function LockBadge() {
  return (
    <span
      aria-hidden
      className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-sm"
    >
      🔒
    </span>
  );
}
