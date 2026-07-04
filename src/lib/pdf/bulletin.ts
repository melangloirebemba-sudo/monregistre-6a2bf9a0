import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { moyennePonderee } from "@/lib/format";
import type { Note, Eleve, Classe, Ecole, Periode } from "@/lib/queries/data";

export interface BulletinContext {
  ecole: Ecole | undefined;
  classe: Classe | undefined;
  periode: Periode | undefined;
  eleve: Eleve;
  notes: Note[];
  enseignant?: string;
  echelle?: number;
  moyenneClasse?: number | null;
}

export function generateBulletinPDF(ctx: BulletinContext) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const echelle = ctx.echelle ?? 20;
  const pageW = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(26, 26, 46);
  doc.rect(0, 0, pageW, 28, "F");
  doc.setTextColor(245, 240, 232);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("BULLETIN DE NOTES", pageW / 2, 13, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(
    `${ctx.ecole?.nom ?? ""}${ctx.periode ? "  •  " + ctx.periode.label : ""}${ctx.periode?.annee_scolaire ? "  •  " + ctx.periode.annee_scolaire : ""}`,
    pageW / 2,
    21,
    { align: "center" },
  );

  // Student info
  doc.setTextColor(26, 26, 46);
  doc.setFontSize(11);
  let y = 40;
  doc.setFont("helvetica", "bold");
  doc.text("Élève :", 15, y);
  doc.setFont("helvetica", "normal");
  doc.text(`${ctx.eleve.prenom} ${ctx.eleve.nom}`, 35, y);

  doc.setFont("helvetica", "bold");
  doc.text("Classe :", 115, y);
  doc.setFont("helvetica", "normal");
  doc.text(ctx.classe?.nom ?? "", 135, y);

  y += 6;
  if (ctx.eleve.sexe) {
    doc.setFont("helvetica", "bold");
    doc.text("Sexe :", 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(ctx.eleve.sexe, 35, y);
  }
  if (ctx.classe?.matiere) {
    doc.setFont("helvetica", "bold");
    doc.text("Matière :", 115, y);
    doc.setFont("helvetica", "normal");
    doc.text(ctx.classe.matiere, 135, y);
  }

  // Notes table
  const rows = ctx.notes.map((n) => [
    new Date(n.date).toLocaleDateString("fr-FR"),
    n.libelle,
    n.matiere ?? "-",
    String(n.coefficient),
    `${n.valeur.toFixed(2)} / ${echelle}`,
  ]);

  autoTable(doc, {
    startY: y + 8,
    head: [["Date", "Évaluation", "Matière", "Coef.", "Note"]],
    body: rows.length ? rows : [["-", "Aucune note", "-", "-", "-"]],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [26, 122, 110], textColor: 245 },
    alternateRowStyles: { fillColor: [245, 240, 232] },
    columnStyles: { 3: { halign: "center" }, 4: { halign: "right" } },
    margin: { left: 15, right: 15 },
  });

  const moy = moyennePonderee(ctx.notes);
  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Summary box
  doc.setFillColor(201, 168, 76);
  doc.rect(15, finalY, pageW - 30, 22, "F");
  doc.setTextColor(26, 26, 46);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("MOYENNE GÉNÉRALE", 20, finalY + 9);
  doc.setFontSize(20);
  const moyStr = moy !== null ? `${moy.toFixed(2)} / ${echelle}` : "—";
  doc.text(moyStr, pageW - 20, finalY + 12, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  if (ctx.moyenneClasse != null) {
    doc.text(
      `Moyenne de la classe : ${ctx.moyenneClasse.toFixed(2)} / ${echelle}`,
      20,
      finalY + 17,
    );
  }
  doc.text(`${ctx.notes.length} note${ctx.notes.length > 1 ? "s" : ""}`, pageW - 20, finalY + 18, {
    align: "right",
  });

  // Signature
  const sy = finalY + 40;
  doc.setDrawColor(26, 26, 46);
  doc.line(pageW - 80, sy, pageW - 20, sy);
  doc.setFontSize(9);
  doc.text("Signature de l'enseignant" + (ctx.enseignant ? ` — ${ctx.enseignant}` : ""), pageW - 20, sy + 5, {
    align: "right",
  });

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `MonRegistre — édité le ${new Date().toLocaleDateString("fr-FR")}`,
    pageW / 2,
    doc.internal.pageSize.getHeight() - 8,
    { align: "center" },
  );

  const name = `bulletin_${ctx.eleve.nom}_${ctx.eleve.prenom}_${ctx.periode?.label ?? ""}`
    .replace(/\s+/g, "-")
    .replace(/[^\w\-]/g, "");
  doc.save(`${name}.pdf`);
}
