import { apiFetch } from "./client";
import type { Notification } from "../types";

export function listNotifications() {
  return apiFetch<{ notifications: Notification[] }>("/api/notifications");
}

export function getUnreadCount() {
  return apiFetch<{ count: number }>("/api/notifications/unread-count");
}

export function markNotificationRead(id: string) {
  return apiFetch<{ notification: Notification }>(`/api/notifications/${id}/read`, { method: "POST" });
}

export function markAllNotificationsRead() {
  return apiFetch<{ ok: boolean }>("/api/notifications/read-all", { method: "POST" });
}
