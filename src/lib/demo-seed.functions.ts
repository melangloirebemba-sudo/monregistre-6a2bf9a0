import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PRENOMS = [
  "Alice", "Bruno", "Chantal", "David", "Émilie", "Franck",
  "Grace", "Henri", "Inès", "Julien", "Karim", "Léa",
];
const NOMS = [
  "Mendy", "Kouyaté", "Diallo", "Ngoma", "Bakala", "Ondongo",
  "Mabiala", "Nzalakanda", "Ibara", "Massamba", "Tati", "Loubelo",
];

/**
 * Peuple l'espace démo (utilisateur courant) avec quelques données
 * réalistes : année scolaire active, 1 école, 2 classes, 10 élèves.
 */
export const seedDemoData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Idempotence : si l'espace démo a déjà des écoles, on ne re-seed pas.
    const { data: existing } = await supabase
      .from("ecoles")
      .select("id")
      .eq("user_id", userId)
      .limit(1);
    if (existing && existing.length > 0) return { seeded: false };

    const currentYear = new Date().getFullYear();
    const libelle = `${currentYear}-${currentYear + 1}`;

    // Profil démo : nom d'affiche + année active
    await supabase
      .from("profils_enseignant")
      .update({
        nom_affiche: "Enseignant démo",
        initiales: "ED",
        annee_active: libelle,
      })
      .eq("user_id", userId);

    // Année scolaire
    await supabase.from("annees_scolaires").insert({
      user_id: userId,
      libelle,
      statut: "active",
    });

    // École
    const { data: ecole } = await supabase
      .from("ecoles")
      .insert({
        user_id: userId,
        nom: "École de démonstration",
        adresse: "Brazzaville",
      })
      .select("id")
      .single();
    const ecoleId = ecole?.id as string;

    // 2 classes
    const classesPayload = [
      { user_id: userId, ecole_id: ecoleId, nom: "CM2 A", code: "CM2A", annee_scolaire: libelle },
      { user_id: userId, ecole_id: ecoleId, nom: "CM1 B", code: "CM1B", annee_scolaire: libelle },
    ];
    const { data: classes } = await supabase
      .from("classes")
      .insert(classesPayload)
      .select("id");
    const classeIds = (classes ?? []).map((c: { id: string }) => c.id);

    // Élèves répartis
    const elevesPayload = PRENOMS.slice(0, 10).map((prenom, i) => ({
      user_id: userId,
      ecole_id: ecoleId,
      classe_id: classeIds[i % classeIds.length],
      prenom,
      nom: NOMS[i % NOMS.length],
      sexe: i % 2 === 0 ? "F" : "M",
    }));
    await supabase.from("eleves").insert(elevesPayload);

    return { seeded: true };
  });
