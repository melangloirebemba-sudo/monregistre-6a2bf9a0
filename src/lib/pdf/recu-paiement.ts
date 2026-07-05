import jsPDF from "jspdf";

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

const PLAN_LABEL: Record<string, string> = {
  gratuit: "Gratuit",
  lite: "Lite",
  premium: "Premium",
};
const PERIODE_LABEL: Record<string, string> = {
  mensuelle: "Mensuelle (30 j)",
  trimestrielle: "Trimestrielle (90 j)",
  annuelle: "Annuelle (300 j)",
};

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
}

export function formatMontantXAF(montant: number, devise = "XAF"): string {
  const groupé = new Intl.NumberFormat("fr-FR").format(Math.max(0, Math.floor(montant)));
  const suffix = devise === "XAF" ? "FCFA" : devise;
  return `${groupé} ${suffix}`;
}

function buildDoc(ctx: RecuPaiementContext): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a5", orientation: "portrait" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Bandeau
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pageW, 22, "F");
  doc.setTextColor(245, 240, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("MonRegistre", 12, 11);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text("Reçu de paiement", 12, 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`N° ${ctx.numero_recu}`, pageW - 12, 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Émis le ${fmtDate(ctx.paye_le)}`, pageW - 12, 17, { align: "right" });

  // Bénéficiaire
  doc.setTextColor(26, 26, 46);
  let y = 32;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("BÉNÉFICIAIRE", 12, y);
  y += 5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(ctx.utilisateur.nom_affiche || "—", 12, y);
  if (ctx.utilisateur.email) {
    y += 4.5;
    doc.setFontSize(9);
    doc.setTextColor(90, 90, 90);
    doc.text(ctx.utilisateur.email, 12, y);
    doc.setTextColor(26, 26, 46);
  }

  // Détails
  y += 10;
  doc.setDrawColor(220, 214, 200);
  doc.line(12, y, pageW - 12, y);
  y += 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("DÉTAILS DU PAIEMENT", 12, y);
  y += 6;

  const rows: Array<[string, string]> = [
    ["Plan", PLAN_LABEL[ctx.plan] ?? ctx.plan],
    ["Période", ctx.periode ? PERIODE_LABEL[ctx.periode] ?? ctx.periode : "—"],
    ["Date de paiement", fmtDate(ctx.paye_le)],
    ["Date d'expiration", fmtDate(ctx.plan_expires_at)],
    ["Moyen de paiement", ctx.moyen_paiement || "manuel"],
  ];
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const [k, v] of rows) {
    doc.setTextColor(90, 90, 90);
    doc.text(k, 12, y);
    doc.setTextColor(26, 26, 46);
    doc.text(v, pageW - 12, y, { align: "right" });
    y += 6;
  }

  // Montant
  y += 4;
  doc.setFillColor(26, 122, 110);
  doc.roundedRect(12, y, pageW - 24, 16, 2, 2, "F");
  doc.setTextColor(245, 240, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("MONTANT PAYÉ", 16, y + 6);
  doc.setFontSize(16);
  doc.text(formatMontantXAF(ctx.montant, ctx.devise), pageW - 16, y + 11, { align: "right" });
  y += 22;

  // Note
  if (ctx.note) {
    doc.setTextColor(90, 90, 90);
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(`Note : ${ctx.note}`, pageW - 24);
    doc.text(lines, 12, y);
    y += lines.length * 4 + 2;
  }

  // Pied
  doc.setTextColor(140, 140, 140);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(
    "Reçu généré automatiquement — MonRegistre. Conservez ce document comme preuve de paiement.",
    pageW / 2,
    pageH - 8,
    { align: "center" },
  );

  return doc;
}

export function recuFilename(ctx: RecuPaiementContext): string {
  return `Recu_${ctx.numero_recu}.pdf`;
}

export function buildRecuPaiementPDFBlob(
  ctx: RecuPaiementContext,
): { blob: Blob; filename: string } {
  const doc = buildDoc(ctx);
  const blob = doc.output("blob") as Blob;
  return { blob, filename: recuFilename(ctx) };
}

export function generateRecuPaiementPDF(ctx: RecuPaiementContext) {
  const doc = buildDoc(ctx);
  doc.save(recuFilename(ctx));
}

