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

  // Header
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(245, 240, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("RAPPORT DE CLASSE", pageW / 2, 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${ctx.ecole?.nom ?? ""}${ctx.classe ? "  •  " + ctx.classe.nom : ""}${ctx.periode ? "  •  " + ctx.periode.label : ""}${ctx.periode?.annee_scolaire ? "  •  " + ctx.periode.annee_scolaire : ""}`,
    pageW / 2,
    21,
    { align: "center" },
  );

  doc.setTextColor(26, 26, 46);
  let y = 36;

  const sorted = [...ctx.eleves].sort((a, b) =>
    (a.nom + a.prenom).localeCompare(b.nom + b.prenom, "fr"),
  );

  for (let i = 0; i < sorted.length; i++) {
    const eleve = sorted[i];
    const eleveNotes = ctx.notes
      .filter((n) => n.eleve_id === eleve.id)
      .sort((a, b) => a.date.localeCompare(b.date));
    const moy = moyennePonderee(eleveNotes);

    // Estimate height needed
    const rowsCount = Math.max(eleveNotes.length, 1);
    const estimatedH = 14 + rowsCount * 6 + 14;
    if (y + estimatedH > pageH - 15) {
      doc.addPage();
      y = 20;
    }

    // Student header bar
    doc.setFillColor(245, 240, 232);
    doc.rect(15, y, pageW - 30, 9, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(26, 26, 46);
    doc.text(`${i + 1}. ${eleve.nom.toUpperCase()} ${eleve.prenom}`, 17, y + 6);
    if (eleve.numero_eleve) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`N° ${eleve.numero_eleve}`, pageW - 17, y + 6, { align: "right" });
    }
    y += 11;

    // Notes table
    const rows = eleveNotes.map((n) => [
      new Date(n.date).toLocaleDateString("fr-FR"),
      n.libelle,
      n.matiere ?? "-",
      String(n.coefficient),
      `${n.valeur.toFixed(2)} / ${echelle}`,
    ]);

    autoTable(doc, {
      startY: y,
      head: [["Date", "Évaluation", "Matière", "Coef.", "Note"]],
      body: rows.length ? rows : [["-", "Aucune note", "-", "-", "-"]],
      styles: { fontSize: 9, cellPadding: 2 },
      headStyles: { fillColor: [26, 122, 110], textColor: 245, fontSize: 9 },
      alternateRowStyles: { fillColor: [250, 247, 240] },
      columnStyles: { 3: { halign: "center" }, 4: { halign: "right" } },
      margin: { left: 15, right: 15 },
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } })
      .lastAutoTable.finalY;

    // Moyenne + appréciation
    doc.setFillColor(201, 168, 76);
    doc.rect(15, finalY + 2, pageW - 30, 10, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(26, 26, 46);
    doc.text(
      `Moyenne : ${moy !== null ? moy.toFixed(2) + " / " + echelle : "—"}`,
      17,
      finalY + 8.5,
    );
    doc.text(`Appréciation : ${appreciation(moy, echelle)}`, pageW - 17, finalY + 8.5, {
      align: "right",
    });

    y = finalY + 16;
  }

  // Footer on all pages
  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `MonRegistre — édité le ${new Date().toLocaleDateString("fr-FR")}${ctx.enseignant ? " — " + ctx.enseignant : ""}   •   Page ${p} / ${pageCount}`,
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
