export function noteColorClass(valeur: number, echelle = 20): string {
  const v = (valeur / echelle) * 20;
  if (v >= 14) return "bg-success/15 text-success border border-success/30";
  if (v >= 10) return "bg-gold/20 text-ink border border-gold/40";
  return "bg-destructive/15 text-destructive border border-destructive/30";
}

export function moyennePonderee(
  notes: { valeur: number; coefficient: number }[],
): number | null {
  if (!notes.length) return null;
  const sumCoef = notes.reduce((a, n) => a + (n.coefficient || 1), 0);
  if (!sumCoef) return null;
  const sum = notes.reduce((a, n) => a + n.valeur * (n.coefficient || 1), 0);
  return sum / sumCoef;
}

export function formatNote(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
}

export function currentUserId(getUser: () => Promise<{ data: { user: { id: string } | null } }>) {
  return getUser().then((r) => r.data.user?.id ?? null);
}
