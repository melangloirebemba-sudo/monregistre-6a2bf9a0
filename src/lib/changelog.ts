// Liste des modifications / notes de version affichées dans la cloche de l'AppBar.
// L'état lu/non-lu est persisté en base (table `notification_reads`) pour être
// synchronisé entre appareils, avec :
//  - fallback localStorage hors-ligne
//  - abonnement Realtime pour propager immédiatement les changements
//  - filtrage par catégorie selon les préférences locales
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNotificationsPrefs, type NotifCategory } from "@/lib/notifications-prefs";

export interface ChangelogEntry {
  id: string;
  date: string; // ISO
  title: string;
  description: string;
  category: NotifCategory;
  /** Route TanStack vers laquelle ouvrir la fonctionnalité concernée. */
  href?: string;
}

export const CHANGELOG: ChangelogEntry[] = [
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
    id: "2026-07-05-notifs",
    date: "2026-07-05",
    title: "Centre de notifications",
    description: "Une cloche affiche la liste des nouveautés de l'application.",
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
    id: "2026-07-05-whatsapp",
    date: "2026-07-05",
    title: "WhatsApp — demande de suppression",
    description:
      "L'administrateur peut contacter l'utilisateur sur WhatsApp depuis les demandes.",
    category: "account",
    href: "/admin",
  },
  {
    id: "2026-07-05-change-password",
    date: "2026-07-05",
    title: "Changer son mot de passe",
    description: "Modifiez votre mot de passe directement depuis « Mon profil ».",
    category: "account",
    href: "/mon-profil",
  },
  {
    id: "2026-07-05-delete-account",
    date: "2026-07-05",
    title: "Demande de suppression de compte",
    description:
      "Depuis les paramètres, demandez la suspension de votre compte (réactivable par l'admin).",
    category: "account",
    href: "/parametres",
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

export function useChangelog() {
  const qc = useQueryClient();
  const prefs = useNotificationsPrefs();

  const { data: dbIds } = useQuery({
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

  // Realtime — un canal par session, invalide la query dès qu'une ligne
  // change côté serveur (par exemple depuis un autre appareil).
  useEffect(() => {
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      const { data: userRes } = await supabase.auth.getUser();
      if (cancelled || !userRes.user) return;
      channel = supabase
        .channel(`notification_reads:${userRes.user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "notification_reads",
            filter: `user_id=eq.${userRes.user.id}`,
          },
          () => {
            qc.invalidateQueries({ queryKey: ["notification-reads"] });
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);

  const [optimistic, setOptimistic] = useState<Set<string>>(() => new Set(readLocal()));
  useEffect(() => {
    if (dbIds) setOptimistic(new Set(dbIds));
  }, [dbIds]);

  const markMutation = useMutation({
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notification-reads"] });
    },
  });

  const markRead = useCallback(
    (id: string) => {
      setOptimistic((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        writeLocal(Array.from(next));
        return next;
      });
      markMutation.mutate([id]);
    },
    [markMutation],
  );

  // Filtre par catégorie activée + désactivation globale
  const visible = useMemo(() => {
    if (!prefs.enabled) return [] as ChangelogEntry[];
    return CHANGELOG.filter((e) => prefs.categories[e.category]);
  }, [prefs]);

  const markAllRead = useCallback(() => {
    const all = visible.map((e) => e.id);
    if (all.length === 0) return;
    setOptimistic((prev) => {
      const next = new Set(prev);
      for (const id of all) next.add(id);
      writeLocal(Array.from(next));
      return next;
    });
    markMutation.mutate(all);
  }, [markMutation, visible]);

  const entries = visible.map((e) => ({ ...e, read: optimistic.has(e.id) }));
  const unreadCount = entries.filter((e) => !e.read).length;

  return { entries, unreadCount, markRead, markAllRead, enabled: prefs.enabled };
}
