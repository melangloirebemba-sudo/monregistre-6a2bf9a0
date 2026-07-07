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

/**
 * Normalise un numéro WhatsApp pour wa.me : uniquement des chiffres,
 * sans espace ni « + ». On conserve tous les chiffres (y compris un
 * éventuel 0 après l'indicatif pays qui fait partie du numéro opérateur
 * local, ex. Congo : +242 06 …).
 */
export function normalizeWhatsAppNumber(raw: string): string {
  return (raw || "").replace(/\D/g, "");
}

function waLink(message: string): string {
  const number = normalizeWhatsAppNumber(supportConfig.whatsappNumber);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
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
export function buildUpgradeMessage(ecole: string, planLabel: string): string;
export function buildUpgradeMessage(ctx: UpgradeContext): string;
export function buildUpgradeMessage(
  a: string | UpgradeContext,
  b?: string,
): string {
  if (typeof a === "string") {
    return [
      `Bonjour, je souhaite passer du plan ${b} à un plan supérieur sur MonRegistre.`,
      "",
      `École : ${a || "(non renseignée)"}`,
      `Plan actuel : ${b}`,
    ].join("\n");
  }
  const ctx = a;
  const lines: string[] = [];
  const target = ctx.targetPlanLabel
    ? ` (vers le plan ${ctx.targetPlanLabel})`
    : "";
  lines.push(
    `Bonjour, je souhaite passer du plan ${ctx.planLabel} à un plan supérieur${target} sur MonRegistre.`,
  );
  lines.push("");
  if (ctx.userName) lines.push(`Utilisateur : ${ctx.userName}`);
  if (ctx.telephone) lines.push(`Téléphone : ${ctx.telephone}`);
  if (ctx.ecole) lines.push(`École concernée : ${ctx.ecole}`);
  if (ctx.classe) lines.push(`Classe concernée : ${ctx.classe}`);
  if (ctx.ressource) lines.push(`Ressource concernée : ${ctx.ressource}`);
  if (ctx.motif) lines.push(`Motif : ${ctx.motif}`);
  lines.push(`Plan actuel : ${ctx.planLabel}`);
  return lines.join("\n");
}

export interface UpgradeContext {
  planLabel: string;
  targetPlanLabel?: string | null;
  ecole?: string;
  classe?: string;
  ressource?: string;
  motif?: string;
  userName?: string;
  telephone?: string;
}

export function supportWhatsAppHref(ecole: string, planLabel: string): string {
  return waLink(buildSupportMessage(ecole, planLabel));
}

export function upgradeWhatsAppHref(ecole: string, planLabel: string): string;
export function upgradeWhatsAppHref(ctx: UpgradeContext): string;
export function upgradeWhatsAppHref(
  a: string | UpgradeContext,
  b?: string,
): string {
  return waLink(
    typeof a === "string" ? buildUpgradeMessage(a, b!) : buildUpgradeMessage(a),
  );
}

export function supportMailtoHref(ecole: string, planLabel: string): string {
  return `mailto:${supportConfig.supportEmail}?subject=${encodeURIComponent(
    "Support MonRegistre",
  )}&body=${encodeURIComponent(buildSupportMessage(ecole, planLabel))}`;
}
