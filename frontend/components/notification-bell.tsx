"use client";

import { useEffect, useRef, useState } from "react";
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

/**
 * In-app apenas (sino + lista) — sem push real (APNs/FCM) nesta fase, ver
 * decisão documentada em `notifications.service.ts`. Usa polling simples via
 * `refetchInterval`, coerente com a decisão da Fase 10 de não introduzir
 * WebSocket para o recurso de Dúvidas.
 */
export function NotificationBell() {
  const intlLocale = useActiveIntlLocale();
  const t = useTranslations("notificationBell");
  const tCommon = useTranslations("common");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const countQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: getUnreadCount,
    refetchInterval: 30_000,
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
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-foreground hover:bg-surface-raised"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-mono-nums text-[10px] font-bold text-ink-950">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-10 w-80 max-w-[90vw] rounded-lg border border-border bg-surface p-2 shadow-lg">
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
                onClick={() => !n.read && markReadMutation.mutate(n.id)}
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
