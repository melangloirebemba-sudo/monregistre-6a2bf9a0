// Notifications locales pour les rappels de l'Accueil.
// Utilise l'API Notification du navigateur (pas de service worker requis).

import { useEffect, useRef } from "react";

const SEEN_KEY = "monregistre.reminderNotifSeen";
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // Ne pas re-notifier le même rappel avant 24h.

export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export function getNotificationPermission(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    const res = await Notification.requestPermission();
    return res as NotificationPermissionState;
  } catch {
    return "default";
  }
}

function readSeen(): Record<string, number> {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return raw ? (JSON.parse(raw) as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writeSeen(seen: Record<string, number>) {
  try {
    localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}

function showNotification(title: string, body: string, tag: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    const n = new Notification(title, {
      body,
      tag, // Regroupe/écrase les notifs avec le même tag.
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      silent: false,
    });
    n.onclick = () => {
      window.focus();
      n.close();
    };
  } catch {
    /* ignore (Safari iOS notamment) */
  }
}

export interface NotifiableReminder {
  id: string;
  label: string;
}

/**
 * Envoie une notification locale pour chaque nouveau rappel actif.
 * Un rappel n'est re-notifié qu'après une période de "cooldown" (24h par défaut).
 */
export function useReminderNotifications(
  reminders: NotifiableReminder[],
  enabled: boolean,
) {
  const firedThisSession = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    if (reminders.length === 0) return;

    const seen = readSeen();
    const now = Date.now();
    let mutated = false;

    for (const r of reminders) {
      if (firedThisSession.current.has(r.id)) continue;
      const last = seen[r.id];
      if (last && now - last < COOLDOWN_MS) {
        firedThisSession.current.add(r.id);
        continue;
      }
      showNotification("MonRegistre — Rappel", r.label, r.id);
      seen[r.id] = now;
      firedThisSession.current.add(r.id);
      mutated = true;
    }

    // Purge des entrées trop anciennes.
    for (const k of Object.keys(seen)) {
      if (now - seen[k] > 30 * COOLDOWN_MS) {
        delete seen[k];
        mutated = true;
      }
    }
    if (mutated) writeSeen(seen);
  }, [reminders, enabled]);
}
