// Configuration centralisée du support : numéro WhatsApp, e-mail et
// constructeurs de messages pré-remplis. Toute modification doit se faire ici
// pour éviter les divergences entre parametres.tsx et support.tsx.

// wa.me exige le numéro en format international sans "+", sans zéro initial
// ni espace. +242 06 962 65 40 → 24269626540
export const WHATSAPP_NUMBER = "242069626540";
export const WHATSAPP_DISPLAY = "+242 06 962 65 40";
export const SUPPORT_EMAIL = "support@monregistre.app";

export type PlanKey = "gratuit" | "lite" | "premium";

export const PLAN_LABEL: Record<PlanKey, string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};

function waLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

/** Message d'aide générique (contact support). */
export function buildSupportMessage(ecole: string, planLabel: string): string {
  return [
    "Bonjour, je souhaite obtenir de l'aide concernant MonRegistre.",
    "",
    `École : ${ecole || "(non renseignée)"}`,
    `Plan actuel : ${planLabel}`,
  ].join("\n");
}

/** Message pré-rempli pour une demande de mise à niveau. */
export function buildUpgradeMessage(ecole: string, planLabel: string): string {
  return [
    `Bonjour, je souhaite passer du plan ${planLabel} à un plan supérieur sur MonRegistre.`,
    "",
    `École : ${ecole || "(non renseignée)"}`,
    `Plan actuel : ${planLabel}`,
  ].join("\n");
}

export function supportWhatsAppHref(ecole: string, planLabel: string): string {
  return waLink(buildSupportMessage(ecole, planLabel));
}

export function upgradeWhatsAppHref(ecole: string, planLabel: string): string {
  return waLink(buildUpgradeMessage(ecole, planLabel));
}

export function supportMailtoHref(ecole: string, planLabel: string): string {
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    "Support MonRegistre",
  )}&body=${encodeURIComponent(buildSupportMessage(ecole, planLabel))}`;
}
