// Centre de notifications :
//  - Source STATIQUE : CHANGELOG (nouveautés produit), état lu/non-lu en base
//    via `notification_reads`.
//  - Source DYNAMIQUE : table `user_notifications` (événements ciblés par
//    utilisateur : demandes de suppression, réactivations, etc.), état lu
//    stocké directement dans `read_at`.
//
// Synchronisation temps réel entre appareils via Supabase Realtime.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  useNotificationsPrefs,
  type NotifCategory,
} from "@/lib/notifications-prefs";

export interface NotificationItem {
  id: string;
  source: "static" | "dynamic";
  date: string; // ISO
  title: string;
  description: string;
  category: NotifCategory;
  href?: string;
  read: boolean;
}

// -------- Source statique ---------------------------------------------------

interface StaticEntry {
  id: string;
  date: string;
  title: string;
  description: string;
  category: NotifCategory;
  href?: string;
}

export const CHANGELOG: StaticEntry[] = [
  {
    id: "2026-07-05-suspension-notifs",
    date: "2026-07-05",
    title: "Suspensions notifiées automatiquement",
    description:
      "Toute demande de suspension d'un compte apparaît dans les notifications de l'utilisateur et des administrateurs.",
    category: "account",
    href: "/parametres",
  },
  {
    id: "2026-07-05-notifs-filter",
    date: "2026-07-05",
    title: "Filtre par catégorie",
    description: "Filtrez la liste des notifications directement depuis la cloche.",
    category: "feature",
    href: "/parametres/notifications",
  },
  {
    id: "2026-07-05-notifs-settings",
    date: "2026-07-05",
    title: "Réglages des notifications",
    description:
      "Choisissez les types de notifications à recevoir et la fréquence des rappels.",
    category: "feature",
    href: "/parametres/notifications",
  },
  {
    id: "2026-07-05-notifs-realtime",
    date: "2026-07-05",
    title: "Notifications en temps réel",
    description:
      "Le compteur non lu se met à jour instantanément entre vos appareils.",
    category: "feature",
  },
  {
    id: "2026-07-05-trial-no-invoice",
    date: "2026-07-05",
    title: "Essai sans facture",
    description:
      "Le lancement d'un essai Lite ou Premium ne génère plus de facture ni de reçu PDF.",
    category: "billing",
    href: "/admin/facturation",
  },
  {
    id: "2026-07-05-change-password",
    date: "2026-07-05",
    title: "Changer son mot de passe",
    description: "Modifiez votre mot de passe directement depuis « Mon profil ».",
    category: "account",
    href: "/mon-profil",
  },
];

const LS_KEY = "monregistre.changelogReadIds";

function readLocal(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(LS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(ids: string[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

function normalizeCategory(v: string | null | undefined): NotifCategory {
  if (
    v === "feature" ||
    v === "fix" ||
    v === "account" ||
    v === "billing" ||
    v === "admin" ||
    v === "security" ||
    v === "reactivation"
  )
    return v;
  return "feature";
}

export function useNotificationCenter() {
  const qc = useQueryClient();
  const prefs = useNotificationsPrefs();

  // ---- Statique : ids lus (par utilisateur) --------------------------------
  const { data: readIds } = useQuery({
    queryKey: ["notification-reads"],
    staleTime: 60_000,
    queryFn: async (): Promise<string[]> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return readLocal();
      const { data, error } = await supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", userRes.user.id);
      if (error) return readLocal();
      const ids = (data ?? []).map((r) => r.notification_id as string);
      const merged = Array.from(new Set([...ids, ...readLocal()]));
      writeLocal(merged);
      return merged;
    },
  });

  // ---- Dynamique : lignes user_notifications -------------------------------
  const { data: dynamic = [] } = useQuery({
    queryKey: ["user-notifications"],
    staleTime: 30_000,
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return [];
      const { data, error } = await supabase
        .from("user_notifications")
        .select("id, title, body, category, href, read_at, created_at")
        .eq("user_id", userRes.user.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return [];
      return data ?? [];
    },
  });

  // ---- Realtime : invalide les deux queries à chaque changement ------------
  useEffect(() => {
    let cancelled = false;
    let ch1: ReturnType<typeof supabase.channel> | null = null;
    let ch2: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (cancelled || !userRes.user) return;
      const uid = userRes.user.id;
      const suffix = Math.random().toString(36).slice(2);
      ch1 = supabase.channel(`notification_reads:${uid}:${suffix}`);
      ch1
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notification_reads",
            filter: `user_id=eq.${uid}`,
          },
          () => qc.invalidateQueries({ queryKey: ["notification-reads"] }),
        )
        .subscribe();
      ch2 = supabase.channel(`user_notifications:${uid}:${suffix}`);
      ch2
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${uid}`,
          },
          () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (ch1) supabase.removeChannel(ch1);
      if (ch2) supabase.removeChannel(ch2);
    };
  }, [qc]);

  // Optimistic pour la partie statique
  const [optimistic, setOptimistic] = useState<Set<string>>(() => new Set(readLocal()));
  useEffect(() => {
    if (readIds) setOptimistic(new Set(readIds));
  }, [readIds]);

  const upsertStaticRead = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const rows = ids.map((notification_id) => ({
        user_id: userRes.user!.id,
        notification_id,
      }));
      const { error } = await supabase
        .from("notification_reads")
        .upsert(rows, { onConflict: "user_id,notification_id" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notification-reads"] }),
  });

  const markDynamicRead = useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .in("id", ids)
        .is("read_at", null);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifications"] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return;
      const { error } = await supabase
        .from("user_notifications")
        .delete()
        .eq("user_id", userRes.user.id);
      if (error) throw error;
      // Marque aussi tous les changelog statiques comme lus.
      const allStaticIds = CHANGELOG.map((e) => e.id);
      if (allStaticIds.length > 0) {
        const rows = allStaticIds.map((notification_id) => ({
          user_id: userRes.user!.id,
          notification_id,
        }));
        await supabase
          .from("notification_reads")
          .upsert(rows, { onConflict: "user_id,notification_id" });
      }
      setOptimistic(new Set(allStaticIds));
      writeLocal(allStaticIds);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-notifications"] });
      qc.invalidateQueries({ queryKey: ["notification-reads"] });
    },
  });

  // Fusion + filtrage par préférences
  const allItems = useMemo<NotificationItem[]>(() => {
    const staticItems: NotificationItem[] = CHANGELOG.map((e) => ({
      id: e.id,
      source: "static" as const,
      date: e.date,
      title: e.title,
      description: e.description,
      category: e.category,
      href: e.href,
      read: optimistic.has(e.id),
    }));
    const dynItems: NotificationItem[] = dynamic.map((r) => ({
      id: r.id,
      source: "dynamic" as const,
      date: r.created_at,
      title: r.title,
      description: r.body ?? "",
      category: normalizeCategory(r.category),
      href: r.href ?? undefined,
      read: r.read_at != null,
    }));
    const merged = [...dynItems, ...staticItems].sort((a, b) =>
      a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
    );
    if (!prefs.enabled) return [];
    return merged.filter((n) => prefs.categories[n.category]);
  }, [dynamic, optimistic, prefs]);

  const markRead = useCallback(
    (item: NotificationItem) => {
      if (item.read) return;
      if (item.source === "static") {
        setOptimistic((prev) => {
          if (prev.has(item.id)) return prev;
          const next = new Set(prev);
          next.add(item.id);
          writeLocal(Array.from(next));
          return next;
        });
        upsertStaticRead.mutate([item.id]);
      } else {
        markDynamicRead.mutate([item.id]);
      }
    },
    [upsertStaticRead, markDynamicRead],
  );

  const markAllRead = useCallback(
    (filter?: NotifCategory) => {
      const target = filter ? allItems.filter((i) => i.category === filter) : allItems;
      const staticIds = target.filter((i) => i.source === "static" && !i.read).map((i) => i.id);
      const dynIds = target.filter((i) => i.source === "dynamic" && !i.read).map((i) => i.id);
      if (staticIds.length > 0) {
        setOptimistic((prev) => {
          const next = new Set(prev);
          for (const id of staticIds) next.add(id);
          writeLocal(Array.from(next));
          return next;
        });
        upsertStaticRead.mutate(staticIds);
      }
      if (dynIds.length > 0) markDynamicRead.mutate(dynIds);
    },
    [allItems, upsertStaticRead, markDynamicRead],
  );

  const unreadCount = allItems.filter((n) => !n.read).length;

  return {
    items: allItems,
    unreadCount,
    markRead,
    markAllRead,
    clearAll: () => clearAll.mutate(),
    enabled: prefs.enabled,
  };
}
