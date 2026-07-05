import { describe, it, expect } from "vitest";
import { CHANGELOG } from "@/lib/changelog";
import type { NotifCategory } from "@/lib/notifications-prefs";

// Reproduit la logique de filtrage + « Tout lire » de la cloche pour la
// tester sans dépendance UI / réseau.
type Item = { id: string; category: NotifCategory; read: boolean };

function filterByCategory(items: Item[], filter: "all" | NotifCategory) {
  return filter === "all" ? items : items.filter((n) => n.category === filter);
}

function idsToMarkRead(items: Item[], filter: "all" | NotifCategory) {
  return filterByCategory(items, filter)
    .filter((n) => !n.read)
    .map((n) => n.id);
}

const SAMPLE: Item[] = [
  { id: "a", category: "feature", read: false },
  { id: "b", category: "feature", read: true },
  { id: "c", category: "account", read: false },
  { id: "d", category: "billing", read: false },
];

describe("filtrage des notifications", () => {
  it("« Toutes » affiche tout", () => {
    expect(filterByCategory(SAMPLE, "all")).toHaveLength(4);
  });

  it("filtre par catégorie", () => {
    expect(filterByCategory(SAMPLE, "feature").map((i) => i.id)).toEqual(["a", "b"]);
    expect(filterByCategory(SAMPLE, "account").map((i) => i.id)).toEqual(["c"]);
  });
});

describe("« Tout lire » respecte le filtre actif", () => {
  it("filtre = all → toutes les non-lues", () => {
    expect(idsToMarkRead(SAMPLE, "all").sort()).toEqual(["a", "c", "d"]);
  });

  it("filtre = feature → uniquement les feature non-lues", () => {
    expect(idsToMarkRead(SAMPLE, "feature")).toEqual(["a"]);
  });

  it("filtre = account → uniquement 'c'", () => {
    expect(idsToMarkRead(SAMPLE, "account")).toEqual(["c"]);
  });
});

describe("liens cliquables du changelog statique", () => {
  const withHref = CHANGELOG.filter((e) => e.href);

  it("chaque href est une route interne absolue", () => {
    expect(withHref.length).toBeGreaterThan(0);
    for (const entry of withHref) {
      expect(entry.href!.startsWith("/")).toBe(true);
      expect(entry.href).not.toMatch(/^https?:\/\//);
    }
  });

  it("les catégories utilisées sont valides", () => {
    const valid: NotifCategory[] = ["feature", "fix", "account", "billing"];
    for (const entry of CHANGELOG) {
      expect(valid).toContain(entry.category);
    }
  });

  it("les ids sont uniques", () => {
    const ids = CHANGELOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
