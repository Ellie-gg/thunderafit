"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
} from "@/lib/api/notifications";
import { useActiveIntlLocale } from "@/i18n/use-active-locale";
import { useTranslations } from "next-intl";
import { useAuthStore } from "@/lib/store/auth-store";
import type { Role } from "@/lib/types";

/**
 * Fase 79: clicar numa notificação precisa levar pra onde ela aconteceu, não
 * só marcar como lida (bug relatado: clique não abria nada). O destino
 * depende do TIPO da notificação (`type`, string livre setada por quem
 * chama `notificationsService.notify()` no backend) E do papel de quem está
 * vendo — o mesmo tipo "new_message" leva o aluno pra uma tela e o
 * profissional pra outra. Resolvido 100% no client (sem precisar de coluna
 * nova no backend) porque o papel de quem está logado já é conhecido aqui.
 * Tipos sem destino conhecido (fallback) não navegam — só marcam como lida,
 * mesmo comportamento de antes.
 */
function resolveNotificationPath(type: string, role: Role | undefined): string | null {
  switch (type) {
    case "connection_request":
      return role === "PERSONAL" ? "/personal/solicitacoes" : null;
    case "new_message":
      if (role === "ALUNO") return "/profissionais";
      if (role === "PERSONAL") return "/personal/solicitacoes";
      return null;
    case "connection_accepted":
    case "connection_rejected":
      return role === "ALUNO" ? "/profissionais" : null;
    case "support_new_thread":
      if (role === "PERSONAL") return "/personal/duvidas";
      if (role === "NUTRICIONISTA") return "/nutricionista/duvidas";
      return null;
    case "support_reply":
      return role === "ALUNO" ? "/duvidas" : null;
    case "payment_reminder":
      return role === "ALUNO" ? "/dashboard" : null;
    case "payment_failed":
      // Fase 103: aviso proativo de falha de cobrança da PRÓPRIA assinatura
      // do Personal (billing.service.ts) — não confundir com
      // "payment_reminder" acima, que é o Personal lembrando O ALUNO de
      // pagar ELE. Só PERSONAL tem `/personal/upgrade` na UI hoje
      // (Nutricionista fica de fora da interface de billing desde a Fase 18,
      // mesmo o backend aceitando os dois).
      return role === "PERSONAL" ? "/personal/upgrade" : null;
    default:
      return null;
  }
}

// Perf (pedido do fundador — Neon compute hours): nenhum tipo de
// notificação hoje (support_new_thread/reply, connection_*, payment_reminder)
// é sensível a tempo real — payment_reminder em particular já é CRIADO no
// login do aluno (relations.service.ts#checkAndFireDueReminders), não por um
// job de fundo, então o poll passivo nunca é o que determina se ela aparece
// na hora certa. 30s em toda tela autenticada nunca deixava o timer de
// autosuspend do Neon zerar — o compute ficava "ativo" pelo tempo inteiro
// que qualquer aba ficasse aberta em primeiro plano, o que piora
// proporcionalmente com mais usuários simultâneos (a chance de "sempre ter
// alguém com aba aberta" sobe rápido). 6h é só uma rede de segurança agora;
// abrir o sino (ação que já existe) força uma checagem na hora — ver
// `onClick` abaixo — sem precisar de nenhum elemento novo na UI.
const PASSIVE_REFETCH_INTERVAL_MS = 6 * 60 * 60 * 1000;

/**
 * In-app apenas (sino + lista) — sem push real (APNs/FCM) nesta fase, ver
 * decisão documentada em `notifications.service.ts`.
 */
export function NotificationBell() {
  const intlLocale = useActiveIntlLocale();
  const t = useTranslations("notificationBell");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const role = useAuthStore((s) => s.user?.role);
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: PASSIVE_REFETCH_INTERVAL_MS,
  });

  const listQuery = useQuery({
    queryKey: ["notifications-list"],
    queryFn: listNotifications,
    enabled: open,
  });

  const markReadMutation = useMutation({
    mutationFn: markNotificationRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: markAllNotificationsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-list"] });
    },
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const unreadCount = countQuery.data?.count ?? 0;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={t("title")}
        onClick={() => {
          setOpen((o) => {
            const next = !o;
            // Abrir o sino É a checagem manual — sem poll de 30s mais, é
            // aqui que o usuário força uma contagem fresca (ver comentário
            // de PASSIVE_REFETCH_INTERVAL_MS acima). `listQuery` já refaz
            // sozinha ao reabrir (fica stale entre uma abertura e outra).
            if (next) countQuery.refetch();
            return next;
          });
        }}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-surface-raised"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono-nums text-[10px] font-bold text-ink-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Achado real em produção (correção pós-lançamento): `absolute right-0`
          é relativo a ESTE container (só o botão do sino), não à tela — e o
          sino não fica na borda direita do header (avatar/hambúrguer/Sair
          vêm depois dele). Num celular estreito isso jogava a lista (320px)
          pra fora da tela pela ESQUERDA, cortando o texto. `fixed` no
          mobile ancora no viewport (sempre visível, não depende de onde o
          sino está no layout); a partir de `sm` volta a ser `absolute`
          ancorado no próprio sino (funciona bem lá, telas maiores já tinham
          espaço). */}
      {open && (
        <div className="fixed inset-x-4 top-16 z-20 rounded-lg border border-border bg-surface p-2 shadow-lg sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:z-10 sm:w-80">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs font-semibold uppercase tracking-wide text-accent-secondary">
              {t("title")}
            </span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllMutation.mutate()}
                className="text-xs text-muted hover:text-foreground hover:underline"
              >
                {t("markAllRead")}
              </button>
            )}
          </div>

          <div className="mt-1 flex max-h-80 flex-col gap-1 overflow-y-auto">
            {listQuery.isLoading && <p className="px-2 py-2 text-sm text-muted">{tCommon("loading")}</p>}

            {listQuery.data?.notifications.length === 0 && (
              <p className="px-2 py-2 text-sm text-muted">{t("empty")}</p>
            )}

            {listQuery.data?.notifications.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  if (!n.read) markReadMutation.mutate(n.id);
                  const path = resolveNotificationPath(n.type, role);
                  if (path) {
                    setOpen(false);
                    router.push(path);
                  }
                }}
                className={`flex flex-col gap-0.5 rounded-md px-2 py-2 text-left text-sm hover:bg-surface-raised ${
                  n.read ? "text-muted" : "text-foreground"
                }`}
              >
                <span className="flex items-center gap-2">
                  {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                  {n.message}
                </span>
                <span className="text-xs text-muted">
                  {new Date(n.createdAt).toLocaleString(intlLocale)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
