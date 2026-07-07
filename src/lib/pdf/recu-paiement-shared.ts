// Utilitaires légers partagés par les vues de facturation.
// Aucun import de jspdf ici : les pages qui n'ont besoin que du format
// monétaire n'embarquent pas la lib PDF dans leur bundle.

export interface RecuPaiementContext {
  numero_recu: string;
  paye_le: string;                 // ISO
  plan: "lite" | "premium" | "gratuit";
  periode: "mensuelle" | "trimestrielle" | "annuelle" | null;
  montant: number;
  devise: string;                  // XAF
  moyen_paiement: string;
  plan_expires_at?: string | null; // ISO
  note?: string | null;
  utilisateur: {
    nom_affiche?: string | null;
    email?: string | null;
  };
}

export function formatMontantXAF(montant: number, devise = "XAF"): string {
  const groupé = new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.floor(montant)));
  const suffix = devise === "XAF" ? "FCFA" : devise;
  return `${groupé} ${suffix}`;
}
