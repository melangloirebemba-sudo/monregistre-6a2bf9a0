// Configuration centralisée du support : numéro WhatsApp, e-mail et
// constructeurs de messages pré-remplis.
//
// Les valeurs sont stockées dans un objet mutable exporté (`supportConfig`)
// afin de pouvoir être surchargées à l'exécution par les réglages
// administrateur (table `app_settings`). Les valeurs ci-dessous restent les
// valeurs par défaut appliquées avant hydratation.

export type PlanKey = "gratuit" | "lite" | "premium";

export const PLAN_LABEL: Record<PlanKey, string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};

export interface SupportConfig {
  whatsappNumber: string;
  whatsappDisplay: string;
  supportEmail: string;
}

// wa.me exige le numéro en format international sans "+", sans zéro initial
// ni espace. +242 06 962 65 40 → 24269626540
export const supportConfig: SupportConfig = {
  whatsappNumber: "242069626540",
  whatsappDisplay: "+242 06 962 65 40",
  supportEmail: "support@monregistre.app",
};

/** Constantes rétro-compatibles (peuvent être obsolètes après hydratation). */
export const WHATSAPP_NUMBER = supportConfig.whatsappNumber;
export const WHATSAPP_DISPLAY = supportConfig.whatsappDisplay;
export const SUPPORT_EMAIL = supportConfig.supportEmail;

export function updateSupportConfig(patch: Partial<SupportConfig>) {
  if (patch.whatsappNumber) supportConfig.whatsappNumber = patch.whatsappNumber;
  if (patch.whatsappDisplay) supportConfig.whatsappDisplay = patch.whatsappDisplay;
  if (patch.supportEmail) supportConfig.supportEmail = patch.supportEmail;
}

function waLink(message: string): string {
  return `https://wa.me/${supportConfig.whatsappNumber}?text=${encodeURIComponent(message)}`;
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
  return `mailto:${supportConfig.supportEmail}?subject=${encodeURIComponent(
    "Support MonRegistre",
  )}&body=${encodeURIComponent(buildSupportMessage(ecole, planLabel))}`;
}
