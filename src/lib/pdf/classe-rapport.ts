import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { moyennePonderee } from "@/lib/format";
import type { Note, Eleve, Classe, Ecole, Periode } from "@/lib/queries/data";

export interface ClasseRapportContext {
  ecole: Ecole | undefined;
  classe: Classe | undefined;
  periode: Periode | undefined;
  eleves: Eleve[];
  notes: Note[];
  enseignant?: string;
  telephone?: string;
  anneeScolaire?: string;
  echelle?: number;
}

function appreciation(moy: number | null, echelle: number): string {
  if (moy === null) return "Non évalué";
  const v = (moy / echelle) * 20;
  if (v >= 16) return "Excellent";
  if (v >= 14) return "Très bien";
  if (v >= 12) return "Bien";
  if (v >= 10) return "Assez bien";
  if (v >= 8) return "Passable";
  return "Insuffisant";
}

export function generateClasseRapportPDF(ctx: ClasseRapportContext) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const echelle = ctx.echelle ?? 20;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  // Header ink band
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pageW, 34, "F");
  doc.setTextColor(245, 240, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RAPPORT DE CLASSE", pageW / 2, 12, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const line1 = [ctx.ecole?.nom, ctx.classe?.nom].filter(Boolean).join("  •  ");
  if (line1) doc.text(line1, pageW / 2, 20, { align: "center" });
  const annee = ctx.periode?.annee_scolaire || ctx.anneeScolaire;
  const line2 = [ctx.periode?.label, annee].filter(Boolean).join("  •  ");
  if (line2) doc.text(line2, pageW / 2, 26, { align: "center" });

  // École badge (chip visible)
  let y = 40;
  doc.setTextColor(26, 26, 46);
  if (ctx.ecole?.nom) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    const label = "ÉCOLE";
    const labelW = doc.getTextWidth(label);
    doc.setFontSize(9);
    const value = ctx.ecole.nom;
    const valueW = doc.getTextWidth(value);
    const padX = 3;
    const gap = 3;
    const chipW = padX + labelW + gap + valueW + padX;
    const chipH = 6.5;
    doc.setFillColor(26, 122, 110);
    doc.roundedRect(15, y - 4.5, chipW, chipH, 1.5, 1.5, "F");
    doc.setTextColor(245, 240, 232);
    doc.setFontSize(8);
    doc.text(label, 15 + padX, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.text(value, 15 + padX + labelW + gap, y);
    doc.setTextColor(26, 26, 46);
    y += 8;
  }

  const labelValue = (label: string, value: string | undefined, x: number, yy: number) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(label, x, yy);
    const labelW = doc.getTextWidth(label);
    doc.setFont("helvetica", "normal");
    doc.text(value ?? "—", x + labelW + 2, yy);
  };

  labelValue("Classe :", ctx.classe?.nom, 15, y);
  labelValue("Année scolaire :", annee, pageW / 2 + 5, y);

  y += 6;
  labelValue("Période :", ctx.periode?.label, 15, y);
  labelValue("Enseignant :", ctx.enseignant, pageW / 2 + 5, y);

  if (ctx.telephone) {
    y += 6;
    labelValue("Téléphone :", ctx.telephone, 15, y);
  }

  y += 10;


  // Simple flat table: all students with all their notes and appreciation
  const sorted = [...ctx.eleves].sort((a, b) =>
    (a.nom + a.prenom).localeCompare(b.nom + b.prenom, "fr"),
  );

  const rows = sorted.map((eleve, i) => {
    const eleveNotes = ctx.notes
      .filter((n) => n.eleve_id === eleve.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const moy = moyennePonderee(eleveNotes);

    const notesStr =
      eleveNotes.length === 0
        ? "—"
        : eleveNotes
            .map(
              (n) =>
                `${n.libelle}${n.matiere ? ` (${n.matiere})` : ""} : ${n.valeur.toFixed(
                  2,
                )}/${echelle}${n.coefficient !== 1 ? ` × ${n.coefficient}` : ""}`,
            )
            .join("\n");

    return [
      String(i + 1),
      `${eleve.nom.toUpperCase()} ${eleve.prenom}`,
      notesStr,
      moy !== null ? `${moy.toFixed(2)} / ${echelle}` : "—",
      appreciation(moy, echelle),
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["N°", "Élève", "Notes", "Moyenne", "Appréciation"]],
    body: rows.length
      ? rows
      : [["—", "Aucun élève", "—", "—", "—"]],
    styles: { fontSize: 9, cellPadding: 2.5, valign: "top" },
    headStyles: {
      fillColor: [26, 122, 110],
      textColor: 245,
      fontSize: 10,
      halign: "left",
    },
    alternateRowStyles: { fillColor: [250, 247, 240] },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { cellWidth: 45, fontStyle: "bold" },
      2: { cellWidth: "auto" },
      3: { halign: "right", cellWidth: 22 },
      4: { halign: "left", cellWidth: 28 },
    },
    margin: { left: 15, right: 15 },
  });

  // Signature block
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } })
    .lastAutoTable.finalY;
  const sigBlockH = 34;
  let sigY = finalY + 10;
  if (sigY + sigBlockH > pageH - 15) {
    doc.addPage();
    sigY = 20;
  }

  doc.setTextColor(26, 26, 46);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(
    `Fait le ${new Date().toLocaleDateString("fr-FR")}`,
    pageW - 15,
    sigY,
    { align: "right" },
  );

  const boxW = 75;
  const boxH = 26;
  const boxX = pageW - 15 - boxW;
  const boxY = sigY + 4;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("Signature de l'enseignant", boxX, boxY - 1);

  doc.setDrawColor(26, 26, 46);
  doc.setLineWidth(0.3);
  doc.rect(boxX, boxY, boxW, boxH);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (ctx.enseignant) {
    doc.text(ctx.enseignant, boxX + 2, boxY + boxH + 5);
  }
  if (ctx.telephone) {
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text(ctx.telephone, boxX + 2, boxY + boxH + 10);
  }



  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `MonRegistre — édité le ${new Date().toLocaleDateString("fr-FR")}${
        ctx.enseignant ? " — " + ctx.enseignant : ""
      }   •   Page ${p} / ${pageCount}`,
      pageW / 2,
      pageH - 8,
      { align: "center" },
    );
  }

  const name = `rapport_${ctx.classe?.nom ?? "classe"}_${ctx.periode?.label ?? ""}`
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]/g, "");
  doc.save(`${name}.pdf`);
}
