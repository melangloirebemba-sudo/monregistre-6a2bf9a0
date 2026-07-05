// Liste des modifications / notes de version affichées dans la cloche de l'AppBar.
// L'état lu/non-lu est persisté en base (table `notification_reads`) pour être
// synchronisé entre mobile et desktop, avec un fallback localStorage hors-ligne.
import { useCallback, useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ChangelogEntry {
  id: string;
  date: string; // ISO
  title: string;
  description: string;
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    id: "2026-07-05-notifs-sync",
    date: "2026-07-05",
    title: "Notifications synchronisées",
    description:
      "L'état lu/non-lu des nouveautés est désormais partagé entre vos appareils (mobile et bureau).",
  },
  {
    id: "2026-07-05-notifs",
    date: "2026-07-05",
    title: "Notifications de modifications",
    description:
      "Une cloche dans la barre supérieure affiche désormais la liste des nouveautés de l'application.",
  },
  {
    id: "2026-07-05-trial-no-invoice",
    date: "2026-07-05",
    title: "Essai sans facture",
    description:
      "Le lancement d'un essai gratuit (Lite ou Premium) ne génère plus de facture ni de reçu PDF.",
  },
  {
    id: "2026-07-05-whatsapp",
    date: "2026-07-05",
    title: "WhatsApp lors d'une demande de suppression",
    description:
      "L'administrateur peut contacter directement l'utilisateur sur WhatsApp depuis les demandes de suppression.",
  },
  {
    id: "2026-07-05-change-password",
    date: "2026-07-05",
    title: "Changer son mot de passe",
    description:
      "Vous pouvez maintenant modifier votre mot de passe directement depuis « Mon profil ».",
  },
  {
    id: "2026-07-05-delete-account",
    date: "2026-07-05",
    title: "Demande de suppression de compte",
    description:
      "Depuis les paramètres, un bouton permet de demander la suspension de votre compte (l'administrateur peut le réactiver).",
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

  // Ids lus depuis la base (par utilisateur).
  const { data: dbIds } = useQuery({
    queryKey: ["notification-reads"],
    staleTime: 30_000,
    queryFn: async (): Promise<string[]> => {
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) return readLocal();
      const { data, error } = await supabase
        .from("notification_reads")
        .select("notification_id")
        .eq("user_id", userRes.user.id);
      if (error) return readLocal();
      const ids = (data ?? []).map((r) => r.notification_id as string);
      // Fusion avec le cache local (au cas où l'utilisateur ait été hors-ligne).
      const merged = Array.from(new Set([...ids, ...readLocal()]));
      writeLocal(merged);
      return merged;
    },
  });

  // État local optimiste pour un rendu immédiat sans re-fetch.
  const [optimistic, setOptimistic] = useState<Set<string>>(
    () => new Set(readLocal()),
  );

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

  const markAllRead = useCallback(() => {
    const all = CHANGELOG.map((e) => e.id);
    setOptimistic(new Set(all));
    writeLocal(all);
    markMutation.mutate(all);
  }, [markMutation]);

  const entries = CHANGELOG.map((e) => ({ ...e, read: optimistic.has(e.id) }));
  const unreadCount = entries.filter((e) => !e.read).length;

  return { entries, unreadCount, markRead, markAllRead };
}
