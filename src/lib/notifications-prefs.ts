// Préférences de la cloche de notifications : catégories activées et
// fréquence des rappels. Persistées dans Supabase (profils_enseignant.
// notifications_prefs) et mises en cache dans localStorage pour un
// démarrage instantané et un fonctionnement hors ligne.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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

function readCache(): NotificationsPrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_NOTIFICATIONS_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return coerce(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_NOTIFICATIONS_PREFS };
  }
}

function writeCache(prefs: NotificationsPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
}

export function getNotificationsPrefs(): NotificationsPrefs {
  return readCache();
}

async function fetchRemotePrefs(): Promise<NotificationsPrefs | null> {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return null;
  const { data, error } = await supabase
    .from("profils_enseignant")
    .select("notifications_prefs")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !data) return null;
  return coerce((data as { notifications_prefs?: unknown }).notifications_prefs);
}

async function pushRemotePrefs(prefs: NotificationsPrefs) {
  const { data: userData } = await supabase.auth.getUser();
  const user = userData?.user;
  if (!user) return;
  await supabase
    .from("profils_enseignant")
    .update({ notifications_prefs: prefs as unknown as never })
    .eq("user_id", user.id);
}

export function setNotificationsPrefs(patch: Partial<NotificationsPrefs>) {
  const current = readCache();
  const merged: NotificationsPrefs = coerce({
    ...current,
    ...patch,
    categories: { ...current.categories, ...(patch.categories ?? {}) },
  });
  writeCache(merged);
  emitChange();
  // Sync distant (best-effort, non bloquant)
  void pushRemotePrefs(merged);
  return merged;
}

export function useNotificationsPrefs(): NotificationsPrefs {
  const [prefs, setPrefs] = useState<NotificationsPrefs>(() => readCache());

  useEffect(() => {
    const onChange = () => setPrefs(readCache());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  // Hydratation depuis Supabase au montage et à chaque changement d'auth,
  // pour restaurer les préférences après un rechargement / sur un autre appareil.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      const remote = await fetchRemotePrefs();
      if (cancelled || !remote) return;
      const local = readCache();
      if (JSON.stringify(local) !== JSON.stringify(remote)) {
        writeCache(remote);
        setPrefs(remote);
        emitChange();
      }
    };
    void hydrate();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        void hydrate();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return prefs;
}
