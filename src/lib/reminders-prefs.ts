// Préférences locales des rappels affichés sur l'Accueil.
// Persistées dans localStorage, réactives via un CustomEvent.

import { useEffect, useState } from "react";

export interface ReminderPrefs {
  /** Alerter si aucune période n'est définie. */
  noPeriodes: boolean;
  /** Alerter pour les classes sans aucune note enregistrée. */
  noNotes: boolean;
  /** Alerter pour les classes sans note récente. */
  staleNotes: boolean;
  /** Seuil (en jours) au-delà duquel une classe est considérée "sans note récente". */
  staleNotesDays: number;
  /** Alerter pour les absences non justifiées récentes. */
  absencesUnj: boolean;
  /** Fenêtre (en jours) pour les absences non justifiées. */
  absencesWindowDays: number;
  /** Envoyer une notification locale quand un rappel devient actif. */
  notificationsEnabled: boolean;
}

export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  noPeriodes: true,
  noNotes: true,
  staleNotes: true,
  staleNotesDays: 14,
  absencesUnj: true,
  absencesWindowDays: 7,
};

const STORAGE_KEY = "monregistre.reminderPrefs";
const CHANGE_EVENT = "monregistre:reminder-prefs-change";

function coerce(raw: unknown): ReminderPrefs {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_REMINDER_PREFS };
  const r = raw as Partial<ReminderPrefs>;
  const clampInt = (v: unknown, min: number, max: number, fb: number) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return fb;
    return Math.min(max, Math.max(min, Math.round(n)));
  };
  return {
    noPeriodes: typeof r.noPeriodes === "boolean" ? r.noPeriodes : DEFAULT_REMINDER_PREFS.noPeriodes,
    noNotes: typeof r.noNotes === "boolean" ? r.noNotes : DEFAULT_REMINDER_PREFS.noNotes,
    staleNotes:
      typeof r.staleNotes === "boolean" ? r.staleNotes : DEFAULT_REMINDER_PREFS.staleNotes,
    staleNotesDays: clampInt(r.staleNotesDays, 1, 180, DEFAULT_REMINDER_PREFS.staleNotesDays),
    absencesUnj:
      typeof r.absencesUnj === "boolean" ? r.absencesUnj : DEFAULT_REMINDER_PREFS.absencesUnj,
    absencesWindowDays: clampInt(
      r.absencesWindowDays,
      1,
      90,
      DEFAULT_REMINDER_PREFS.absencesWindowDays,
    ),
  };
}

export function getReminderPrefs(): ReminderPrefs {
  if (typeof localStorage === "undefined") return { ...DEFAULT_REMINDER_PREFS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return coerce(raw ? JSON.parse(raw) : null);
  } catch {
    return { ...DEFAULT_REMINDER_PREFS };
  }
}

export function setReminderPrefs(patch: Partial<ReminderPrefs>) {
  const next = coerce({ ...getReminderPrefs(), ...patch });
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
  return next;
}

export function resetReminderPrefs(): ReminderPrefs {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
  }
  return { ...DEFAULT_REMINDER_PREFS };
}

export function useReminderPrefs(): ReminderPrefs {
  const [prefs, setPrefs] = useState<ReminderPrefs>(() => getReminderPrefs());
  useEffect(() => {
    const onChange = () => setPrefs(getReminderPrefs());
    window.addEventListener(CHANGE_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(CHANGE_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return prefs;
}
