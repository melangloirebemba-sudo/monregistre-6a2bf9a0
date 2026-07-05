// Liste des modifications / notes de version affichées dans la cloche de l'AppBar.
// Ajoutez une nouvelle entrée en tête de liste à chaque déploiement notable.
import { useCallback, useEffect, useState } from "react";

export interface ChangelogEntry {
  id: string;
  date: string; // ISO
  title: string;
  description: string;
}

export const CHANGELOG: ChangelogEntry[] = [
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

const READ_KEY = "monregistre.changelogReadIds";

function readIds(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(READ_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeIds(ids: string[]) {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(ids));
  } catch {
    /* ignore */
  }
}

export function useChangelog() {
  const [readSet, setReadSet] = useState<Set<string>>(() => new Set(readIds()));

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === READ_KEY) setReadSet(new Set(readIds()));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const markRead = useCallback((id: string) => {
    setReadSet((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      writeIds(Array.from(next));
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    const all = CHANGELOG.map((e) => e.id);
    setReadSet(new Set(all));
    writeIds(all);
  }, []);

  const entries = CHANGELOG.map((e) => ({ ...e, read: readSet.has(e.id) }));
  const unreadCount = entries.filter((e) => !e.read).length;

  return { entries, unreadCount, markRead, markAllRead };
}
