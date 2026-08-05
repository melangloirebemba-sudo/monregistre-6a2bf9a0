import { mirrorUpsert, mirrorSelect } from "@/lib/sqlite";
import { mirrorClearAll } from "@/lib/sqlite/mirror";
import { clearQueue } from "@/lib/offline-queue";

const FLAG = "mr-demo-mode";
const TOUR_DEMO_DONE = "mr-tour-demo-done";

/** Identifiant local du visiteur démo — n'existe jamais en base. */
export const DEMO_USER_ID = "demo-local-user";

export interface DemoProfil {
  nom_affiche: string;
  initiales: string;
  annee_active: string;
}

export function isDemoMode(): boolean {
  if (typeof localStorage === "undefined") return false;
  return localStorage.getItem(FLAG) === "1";
}

export function setDemoMode(active: boolean) {
  if (typeof localStorage === "undefined") return;
  if (active) localStorage.setItem(FLAG, "1");
  else localStorage.removeItem(FLAG);
}

export function markTourDemoDone() {
  if (typeof localStorage !== "undefined") localStorage.setItem(TOUR_DEMO_DONE, "1");
}
export function isTourDemoDone(): boolean {
  return typeof localStorage !== "undefined" && localStorage.getItem(TOUR_DEMO_DONE) === "1";
}

export function demoAnneeActive(): string {
  const y = new Date().getFullYear();
  return `${y}-${y + 1}`;
}

export function demoProfil(): DemoProfil {
  return { nom_affiche: "Enseignant démo", initiales: "ED", annee_active: demoAnneeActive() };
}

function uid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const PRENOMS = [
  "Alice", "Bruno", "Chantal", "David", "Émilie",
  "Franck", "Grace", "Henri", "Inès", "Julien",
];
const NOMS = [
  "Mendy", "Kouyaté", "Diallo", "Ngoma", "Bakala",
  "Ondongo", "Mabiala", "Ibara", "Massamba", "Tati",
];

/**
 * Génère un jeu de données de démonstration **uniquement en local**
 * (miroir IndexedDB). Aucune ligne n'est écrite en base tant que
 * l'utilisateur n'a pas créé son compte.
 */
async function seedLocalDemo(): Promise<void> {
  const existing = await mirrorSelect("ecoles", { where: { user_id: DEMO_USER_ID } });
  if (existing.length > 0) return;

  const now = new Date().toISOString();
  const annee = demoAnneeActive();
  const base = { user_id: DEMO_USER_ID, created_at: now, updated_at: now };

  const anneeId = uid();
  await mirrorUpsert("annees_scolaires", [
    { ...base, id: anneeId, libelle: annee, active: true, archived: false, date_debut: null, date_fin: null },
  ]);

  const ecoleId = uid();
  await mirrorUpsert("ecoles", [
    {
      ...base,
      id: ecoleId,
      nom: "École de démonstration",
      numero: null,
      adresse: "Brazzaville",
      telephone: null,
      directeur_etudes: null,
    },
  ]);

  const classes = [
    { id: uid(), nom: "6ème A", code: "6A", matiere: "Mathématiques" },
    { id: uid(), nom: "5ème B", code: "5B", matiere: "Français" },
  ];
  await mirrorUpsert(
    "classes",
    classes.map((c) => ({
      ...base,
      id: c.id,
      ecole_id: ecoleId,
      nom: c.nom,
      code: c.code,
      matiere: c.matiere,
      effectif: 5,
      chef_id: null,
      annee_scolaire: annee,
    })),
  );

  const periodes = ["Trimestre 1", "Trimestre 2", "Trimestre 3"].map((label, i) => ({
    ...base,
    id: uid(),
    label,
    ordre: i + 1,
    active: i === 0,
    annee_scolaire: annee,
  }));
  await mirrorUpsert("periodes", periodes);

  const eleves = PRENOMS.map((prenom, i) => ({
    ...base,
    id: uid(),
    ecole_id: ecoleId,
    classe_id: classes[i % 2]!.id,
    prenom,
    nom: NOMS[i]!,
    sexe: i % 2 === 0 ? "F" : "M",
    tuteur_nom: null,
    tuteur_numero: null,
    adresse: null,
    numero_eleve: String(i + 1).padStart(3, "0"),
  }));
  await mirrorUpsert("eleves", eleves);

  const periodeId = periodes[0]!.id;
  const notes = eleves.slice(0, 6).map((e, i) => ({
    ...base,
    id: uid(),
    ecole_id: ecoleId,
    eleve_id: e.id,
    periode_id: periodeId,
    sequence_id: null,
    libelle: "Devoir 1",
    matiere: i % 2 === 0 ? "Mathématiques" : "Français",
    valeur: 8 + (i % 8),
    coefficient: 1,
    date: now.slice(0, 10),
  }));
  await mirrorUpsert("notes", notes);
}

/** Démarre une session démo strictement locale (aucun compte, aucune écriture en base). */
export async function startDemo(): Promise<void> {
  setDemoMode(true);
  await seedLocalDemo();
}

/** Termine la démo : purge les données locales de démonstration. */
export async function endDemo(): Promise<void> {
  setDemoMode(false);
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem(TOUR_DEMO_DONE);
  }
  try {
    await clearQueue();
  } catch {
    /* noop */
  }
  try {
    await mirrorClearAll();
  } catch {
    /* noop */
  }
}

/**
 * Après la création d'un vrai compte, recopie en base les données saisies
 * pendant la démo (jusque-là uniquement locales).
 */
export async function importDemoDataToAccount(userId: string): Promise<void> {
  const { supabase } = await import("@/integrations/supabase/client");
  const idMap = new Map<string, string>();
  const remap = (v: unknown): string | null => {
    if (typeof v !== "string" || !v) return null;
    if (!idMap.has(v)) idMap.set(v, uid());
    return idMap.get(v)!;
  };

  const annee = demoAnneeActive();
  const ecoles = await mirrorSelect<Record<string, unknown>>("ecoles");
  const classes = await mirrorSelect<Record<string, unknown>>("classes");
  const eleves = await mirrorSelect<Record<string, unknown>>("eleves");
  const periodes = await mirrorSelect<Record<string, unknown>>("periodes");
  const notes = await mirrorSelect<Record<string, unknown>>("notes");
  const absences = await mirrorSelect<Record<string, unknown>>("absences");

  await supabase.from("annees_scolaires").insert({
    user_id: userId,
    libelle: annee,
    statut: "active",
  });

  if (ecoles.length) {
    await supabase.from("ecoles").insert(
      ecoles.map((e) => ({
        id: remap(e.id)!,
        user_id: userId,
        nom: String(e.nom ?? "École"),
        numero: (e.numero as string) ?? null,
        adresse: (e.adresse as string) ?? null,
        telephone: (e.telephone as string) ?? null,
        directeur_etudes: (e.directeur_etudes as string) ?? null,
      })),
    );
  }
  if (classes.length) {
    await supabase.from("classes").insert(
      classes.map((c) => ({
        id: remap(c.id)!,
        user_id: userId,
        ecole_id: remap(c.ecole_id)!,
        nom: String(c.nom ?? "Classe"),
        code: String(c.code ?? "CL"),
        matiere: (c.matiere as string) ?? null,
        effectif: Number(c.effectif ?? 0),
        annee_scolaire: (c.annee_scolaire as string) ?? annee,
      })),
    );
  }
  if (eleves.length) {
    await supabase.from("eleves").insert(
      eleves.map((e) => ({
        id: remap(e.id)!,
        user_id: userId,
        ecole_id: remap(e.ecole_id)!,
        classe_id: remap(e.classe_id)!,
        nom: String(e.nom ?? ""),
        prenom: String(e.prenom ?? ""),
        sexe: (e.sexe as string) ?? null,
        tuteur_nom: (e.tuteur_nom as string) ?? null,
        tuteur_numero: (e.tuteur_numero as string) ?? null,
        adresse: (e.adresse as string) ?? null,
        numero_eleve: (e.numero_eleve as string) ?? null,
      })),
    );
  }
  if (periodes.length) {
    await supabase.from("periodes").insert(
      periodes.map((p) => ({
        id: remap(p.id)!,
        user_id: userId,
        label: String(p.label ?? "Période"),
        ordre: Number(p.ordre ?? 1),
        active: Boolean(p.active),
        annee_scolaire: (p.annee_scolaire as string) ?? annee,
      })),
    );
  }
  if (notes.length) {
    await supabase.from("notes").insert(
      notes.map((n) => ({
        id: remap(n.id)!,
        user_id: userId,
        ecole_id: remap(n.ecole_id)!,
        eleve_id: remap(n.eleve_id)!,
        periode_id: n.periode_id ? remap(n.periode_id) : null,
        libelle: String(n.libelle ?? "Note"),
        matiere: (n.matiere as string) ?? null,
        valeur: Number(n.valeur ?? 0),
        coefficient: Number(n.coefficient ?? 1),
        date: (n.date as string) ?? new Date().toISOString().slice(0, 10),
      })),
    );
  }
  if (absences.length) {
    await supabase.from("absences").insert(
      absences.map((a) => ({
        id: remap(a.id)!,
        user_id: userId,
        eleve_id: remap(a.eleve_id)!,
        date: (a.date as string) ?? new Date().toISOString().slice(0, 10),
        motif: (a.motif as string) ?? null,
        justifiee: Boolean(a.justifiee),
      })),
    );
  }
}
