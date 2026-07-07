// Préférences de la cloche de notifications : catégories activées, canaux
// de diffusion (in-app / email / SMS) et fréquence des rappels. Persistées
// dans Supabase (profils_enseignant.notifications_prefs) et mises en cache
// dans localStorage pour un démarrage instantané et un fonctionnement hors
// ligne.

import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type NotifCategory =
  | "feature"
  | "fix"
  | "account"
  | "billing"
  | "admin"
  | "security"
  | "reactivation";

export const NOTIF_CATEGORY_LABELS: Record<NotifCategory, string> = {
  feature: "Nouvelles fonctionnalités",
  fix: "Améliorations & corrections",
  account: "Compte & profil",
  billing: "Facturation & plans",
  admin: "Actions administratives",
  security: "Sécurité",
  reactivation: "Réactivation de compte",
};

export const NOTIF_CATEGORY_DESCRIPTIONS: Record<NotifCategory, string> = {
  feature: "Nouveautés produit et fonctionnalités.",
  fix: "Corrections et petites améliorations.",
  account: "Modifications de profil et compte.",
  billing: "Plan, essais, paiements et reçus.",
  admin: "Actions effectuées par un administrateur sur votre compte.",
  security: "Mots de passe, connexions et alertes de sécurité.",
  reactivation: "Réactivation ou suspension de votre compte.",
};

export type NotifChannel = "inApp" | "email" | "sms";

export interface CategoryChannels {
  inApp: boolean;
  email: boolean;
  sms: boolean;
}

export type ReminderFrequency = "off" | "immediate" | "daily" | "weekly";

export const REMINDER_FREQUENCY_LABELS: Record<ReminderFrequency, string> = {
  off: "Désactivés",
  immediate: "Immédiats",
  daily: "Une fois par jour",
  weekly: "Une fois par semaine",
};

export type DefaultFilter = "all" | NotifCategory;

/**
 * Push categories — types de notifications push mobiles que l'utilisateur
 * peut activer/désactiver individuellement, indépendamment du canal in-app.
 * Ces clés sont utilisées côté serveur par `sendPushToUser` pour filtrer.
 */
export type PushKind =
  | "schedule_daily"
  | "license_expiry"
  | "billing"
  | "reactivation"
  | "admin"
  | "security"
  | "account"
  | "feature"
  | "fix";

export const ALL_PUSH_KINDS: PushKind[] = [
  "schedule_daily",
  "license_expiry",
  "billing",
  "reactivation",
  "admin",
  "security",
  "account",
  "feature",
  "fix",
];

export const PUSH_KIND_LABELS: Record<PushKind, string> = {
  schedule_daily: "Programme du lendemain",
  license_expiry: "Expiration de licence",
  billing: "Paiements & facturation",
  reactivation: "Réactivation de compte",
  admin: "Actions administratives",
  security: "Sécurité",
  account: "Compte & profil",
  feature: "Nouvelles fonctionnalités",
  fix: "Améliorations & corrections",
};

export const PUSH_KIND_DESCRIPTIONS: Record<PushKind, string> = {
  schedule_daily: "Chaque soir, un résumé des cours du lendemain.",
  license_expiry: "Rappels J-14, J-7, J-3, J-1 avant expiration.",
  billing: "Confirmations de paiement et reçus.",
  reactivation: "Notifications lors d'une réactivation de compte.",
  admin: "Actions effectuées par un administrateur sur votre compte.",
  security: "Alertes de sécurité et changements de mot de passe.",
  account: "Modifications de profil et compte.",
  feature: "Nouveautés produit et fonctionnalités.",
  fix: "Corrections et petites améliorations.",
};

export interface NotificationsPrefs {
  enabled: boolean;
  categories: Record<NotifCategory, boolean>;
  channels: Record<NotifCategory, CategoryChannels>;
  reminderFrequency: ReminderFrequency;
  defaultFilter: DefaultFilter;
  push: Record<PushKind, boolean>;
}

const ALL_CATEGORIES: NotifCategory[] = [
  "feature",
  "fix",
  "account",
  "billing",
  "admin",
  "security",
  "reactivation",
];

function defaultChannelsFor(cat: NotifCategory): CategoryChannels {
  // Par défaut : tout en in-app. Email activé pour compte/facturation/sécurité/
  // réactivation/admin (canaux critiques). SMS désactivé partout (opt-in).
  const criticalEmail: NotifCategory[] = [
    "account",
    "billing",
    "admin",
    "security",
    "reactivation",
  ];
  return {
    inApp: true,
    email: criticalEmail.includes(cat),
    sms: false,
  };
}

function defaultChannels(): Record<NotifCategory, CategoryChannels> {
  const out = {} as Record<NotifCategory, CategoryChannels>;
  for (const c of ALL_CATEGORIES) out[c] = defaultChannelsFor(c);
  return out;
}

function defaultCategories(): Record<NotifCategory, boolean> {
  const out = {} as Record<NotifCategory, boolean>;
  for (const c of ALL_CATEGORIES) out[c] = true;
  return out;
}

function defaultPush(): Record<PushKind, boolean> {
  const out = {} as Record<PushKind, boolean>;
  for (const k of ALL_PUSH_KINDS) out[k] = true;
  return out;
}

export const DEFAULT_NOTIFICATIONS_PREFS: NotificationsPrefs = {
  enabled: true,
  categories: defaultCategories(),
  channels: defaultChannels(),
  reminderFrequency: "daily",
  defaultFilter: "all",
  push: defaultPush(),
};

/** Catégories pour lesquelles email et SMS peuvent être proposés. */
export const CATEGORIES_WITH_EMAIL_SMS: NotifCategory[] = [
  "account",
  "billing",
  "admin",
  "security",
  "reactivation",
];

const STORAGE_KEY = "monregistre.notificationsPrefs";
const CHANGE_EVENT = "monregistre:notifications-prefs-change";

function coerceChannels(raw: unknown, cat: NotifCategory): CategoryChannels {
  const fallback = defaultChannelsFor(cat);
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Partial<CategoryChannels>;
  return {
    inApp: typeof r.inApp === "boolean" ? r.inApp : fallback.inApp,
    email: typeof r.email === "boolean" ? r.email : fallback.email,
    sms: typeof r.sms === "boolean" ? r.sms : fallback.sms,
  };
}

function coerce(raw: unknown): NotificationsPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_NOTIFICATIONS_PREFS };
  const r = raw as Partial<NotificationsPrefs>;
  const cats = (r.categories ?? {}) as Partial<Record<NotifCategory, boolean>>;
  const chans = (r.channels ?? {}) as Partial<Record<NotifCategory, unknown>>;
  const categories = {} as Record<NotifCategory, boolean>;
  const channels = {} as Record<NotifCategory, CategoryChannels>;
  for (const c of ALL_CATEGORIES) {
    categories[c] = typeof cats[c] === "boolean" ? (cats[c] as boolean) : true;
    channels[c] = coerceChannels(chans[c], c);
  }
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : DEFAULT_NOTIFICATIONS_PREFS.enabled,
    categories,
    channels,
    reminderFrequency: (["off", "immediate", "daily", "weekly"] as ReminderFrequency[]).includes(
      r.reminderFrequency as ReminderFrequency,
    )
      ? (r.reminderFrequency as ReminderFrequency)
      : DEFAULT_NOTIFICATIONS_PREFS.reminderFrequency,
    defaultFilter: (["all", ...ALL_CATEGORIES] as DefaultFilter[]).includes(
      r.defaultFilter as DefaultFilter,
    )
      ? (r.defaultFilter as DefaultFilter)
      : DEFAULT_NOTIFICATIONS_PREFS.defaultFilter,
    push: (() => {
      const raw = (r.push ?? {}) as Partial<Record<PushKind, unknown>>;
      const out = {} as Record<PushKind, boolean>;
      for (const k of ALL_PUSH_KINDS) {
        out[k] = typeof raw[k] === "boolean" ? (raw[k] as boolean) : true;
      }
      return out;
    })(),
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
  const mergedChannels = { ...current.channels };
  if (patch.channels) {
    for (const [k, v] of Object.entries(patch.channels)) {
      const cat = k as NotifCategory;
      mergedChannels[cat] = { ...current.channels[cat], ...(v as Partial<CategoryChannels>) };
    }
  }
  const merged: NotificationsPrefs = coerce({
    ...current,
    ...patch,
    categories: { ...current.categories, ...(patch.categories ?? {}) },
    channels: mergedChannels,
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
    let channel: ReturnType<typeof supabase.channel> | null = null;
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
    const setupRealtime = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (cancelled || !userRes.user) return;
      const uid = userRes.user.id;
      channel = supabase.channel(`prefs:${uid}:${Math.random().toString(36).slice(2)}`);
      channel
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "profils_enseignant",
            filter: `user_id=eq.${uid}`,
          },
          (payload) => {
            const next = (payload.new as { notifications_prefs?: unknown } | null)
              ?.notifications_prefs;
            if (!next) return;
            const coerced = coerce(next);
            const local = readCache();
            if (JSON.stringify(local) !== JSON.stringify(coerced)) {
              writeCache(coerced);
              setPrefs(coerced);
              emitChange();
            }
          },
        )
        .subscribe();
    };
    void hydrate();
    void setupRealtime();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION") {
        void hydrate();
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return prefs;
}
