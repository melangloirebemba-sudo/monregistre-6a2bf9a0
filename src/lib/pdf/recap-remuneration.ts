import { savePdfBlob } from "./save";
import { formatHeures, labelMois, type SyntheseEcole } from "@/lib/queries/remuneration";
import { formatMontantXAF } from "./recu-paiement-shared";

export interface RecapRemunerationContext {
  mois: string; // ISO yyyy-mm-01
  enseignant?: string;
  synthese: SyntheseEcole[];
  ecoleNom: Record<string, string>;
  /** Nombre de séances en attente d'approbation sur le mois. */
  enAttente?: number;
}

/** Récapitulatif mensuel : heures consommées, retenues et salaire estimé. */
export async function generateRecapRemunerationPDF(ctx: RecapRemunerationContext) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);

  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pageW, 32, "F");
  doc.setTextColor(245, 240, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.text("RÉCAPITULATIF MENSUEL", pageW / 2, 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    [labelMois(ctx.mois), ctx.enseignant].filter(Boolean).join("  •  "),
    pageW / 2,
    22,
    { align: "center" },
  );

  const totalMinutes = ctx.synthese.reduce((a, s) => a + s.minutesEffectuees, 0);
  const totalPerduMin = ctx.synthese.reduce((a, s) => a + s.minutesPerdues, 0);
  const totalEstime = ctx.synthese.reduce((a, s) => a + s.montantEstime, 0);
  const totalRetenue = ctx.synthese.reduce((a, s) => a + s.montantPerdu, 0);

  doc.setTextColor(26, 26, 46);
  let y = 44;
  const box = (label: string, value: string, x: number) => {
    doc.setDrawColor(220, 215, 205);
    doc.roundedRect(x, y - 7, 56, 18, 2, 2, "S");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(label.toUpperCase(), x + 4, y - 1);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(value, x + 4, y + 7);
  };
  box("Heures payables", formatHeures(totalMinutes), 15);
  box("Salaire estimé", formatMontantXAF(Math.round(totalEstime)), 76);
  box("Retenues", formatMontantXAF(Math.round(totalRetenue)), 137);
  y += 20;

  autoTable(doc, {
    startY: y,
    head: [["École", "Séances", "Heures payables", "Heures perdues", "Salaire estimé", "Retenues"]],
    body: ctx.synthese.map((s) => [
      ctx.ecoleNom[s.ecole_id] ?? "École",
      String(s.seances),
      formatHeures(s.minutesEffectuees),
      formatHeures(s.minutesPerdues),
      formatMontantXAF(Math.round(s.montantEstime), s.devise),
      s.montantPerdu > 0 ? `−${formatMontantXAF(Math.round(s.montantPerdu), s.devise)}` : "—",
    ]),
    styles: { fontSize: 9, cellPadding: 2.5 },
    headStyles: { fillColor: [26, 122, 110], textColor: [245, 240, 232] },
    theme: "grid",
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y;
  let yy = finalY + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(`Heures perdues (retards et absences) : ${formatHeures(totalPerduMin)}`, 15, yy);
  yy += 6;
  if (ctx.enAttente) {
    doc.setTextColor(180, 60, 40);
    doc.text(`${ctx.enAttente} séance(s) en attente d'approbation`, 15, yy);
    doc.setTextColor(26, 26, 46);
    yy += 6;
  }
  doc.setFontSize(8);
  doc.setTextColor(120, 115, 110);
  doc.text(
    `Document généré le ${new Date().toLocaleDateString("fr-FR")} par MonRegistre — estimation indicative.`,
    15,
    yy + 4,
  );

  const blob = doc.output("blob") as Blob;
  await savePdfBlob(blob, `recap-remuneration-${ctx.mois.slice(0, 7)}.pdf`, "Récapitulatif mensuel");
}
