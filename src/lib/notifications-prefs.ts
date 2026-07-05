// Préférences locales de la cloche de notifications : catégories activées
// et fréquence des rappels de nouveautés non lues. Persistées dans
// localStorage et propagées via un CustomEvent.

import { useEffect, useState } from "react";

export type NotifCategory = "feature" | "fix" | "account" | "billing";

export const NOTIF_CATEGORY_LABELS: Record<NotifCategory, string> = {
  feature: "Nouvelles fonctionnalités",
  fix: "Améliorations & corrections",
  account: "Compte & profil",
  billing: "Facturation & plans",
};

export type ReminderFrequency = "off" | "immediate" | "daily" | "weekly";

export const REMINDER_FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  off: "Désactivés",
  immediate: "Immédiats",
  daily: "Une fois par jour",
  weekly: "Une fois par semaine",
};

export interface NotificationsPrefs {
  enabled: boolean;
  categories: Record<NotifCategory, boolean>;
  reminderFrequency: ReminderFrequency;
}

export const DEFAULT_NOTIFICATIONS_PREFS: NotificationsPrefs = {
  enabled: true,
  categories: { feature: true, fix: true, account: true, billing: true },
  reminderFrequency: "daily",
};

const STORAGE_KEY = "monregistre.notificationsPrefs";
const CHANGE_EVENT = "monregistre:notifications-prefs-change";

function coerce(raw: unknown): NotificationsPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_NOTIFICATIONS_PREFS };
  const r = raw as Partial<NotificationsPrefs>;
  const cats = (r.categories ?? {}) as Partial<Record<NotifCategory, boolean>>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_NOTIFICATIONS_PREFS.enabled,
    categories: {
      feature: typeof cats.feature === "boolean" ? cats.feature : true,
      fix: typeof cats.fix === "boolean" ? cats.fix : true,
      account: typeof cats.account === "boolean" ? cats.account : true,
      billing: typeof cats.billing === "boolean" ? cats.billing : true,
    },
    reminderFrequency: (["off", "immediate", "daily", "weekly"] as ReminderFrequency[]).includes(
      r.reminderFrequency as ReminderFrequency,
    )
      ? (r.reminderFrequency as ReminderFrequency)
      : DEFAULT_NOTIFICATIONS_PREFS.reminderFrequency,
  };
}

export function getNotificationsPrefs(): NotificationsPrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_NOTIFICATIONS_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return coerce(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_NOTIFICATIONS_PREFS };
  }
}

export function setNotificationsPrefs(patch: Partial<NotificationsPrefs>) {
  const current = getNotificationsPrefs();
  const merged: NotificationsPrefs = coerce({
    ...current,
    ...patch,
    categories: { ...current.categories, ...(patch.categories ?? {}) },
  });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
  return merged;
}

export function useNotificationsPrefs(): NotificationsPrefs {
  const [prefs, setPrefs] = useState<NotificationsPrefs>(() => getNotificationsPrefs());
  useEffect(() => {
    const onChange = () => setPrefs(getNotificationsPrefs());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return prefs;
}
