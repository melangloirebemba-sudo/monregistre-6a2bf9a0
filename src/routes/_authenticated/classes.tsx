import { createFileRoute } from "@tanstack/react-router";
import { toFrench } from "@/lib/errors";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { GraduationCap, Plus, Pencil, Trash2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { enqueueWrite } from "@/lib/offline-queue";
import { classesQO, ecolesQO, elevesQO, notesQO, periodesQO, requireUserId, type Classe } from "@/lib/queries/data";
import { planCapabilitiesQO } from "@/lib/queries/profil";
import { PLAN_LABEL, type PlanKey } from "@/config/support";
import {
  PlanLimitBanner,
  LockedEmptyState,
  LockedFloatingAdd,
  PlanUpgradeDialog,
} from "@/components/app/plan-limit";
import { Button } from "@/components/ui/button";
import { DataPagination } from "@/components/ui/data-pagination";
import { usePaginatedQuery } from "@/hooks/use-paginated-query";
import { ListSkeleton, NoResults } from "@/components/ui/list-states";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EcoleFilter, EcoleBadge, EcoleGroupHeader } from "@/components/app/ecole-filter";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes — MonRegistre" }] }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(classesQO());
    void context.queryClient.prefetchQuery(ecolesQO());
    void context.queryClient.prefetchQuery(planCapabilitiesQO());
  },
  component: ClassesPage,
});

function ClassesPage() {
  const { data: ecoles = [] } = useQuery(ecolesQO());
  const { data: allClasses = [] } = useQuery(classesQO());
  const { data: caps } = useQuery(planCapabilitiesQO());
  const [ecoleFilter, setEcoleFilter] = useState<string>("all");
  const { data: classes = [], isLoading } = useQuery(
    classesQO(ecoleFilter === "all" ? undefined : ecoleFilter),
  );
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Classe | null>(null);
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [toDelete, setToDelete] = useState<Classe | null>(null);
  const [viewing, setViewing] = useState<Classe | null>(null);

  const pq = usePaginatedQuery({
    data: classes,
    search: q,
    searchFields: (c) => [c.nom, c.code, c.matiere],
    sortKey: ecoleFilter,
  });
  const paged = pq.items;

  const ecoleById = useMemo(() => Object.fromEntries(ecoles.map((e) => [e.id, e.nom])), [ecoles]);

  const canAdd = ecoles.length > 0;

  // Comptage classes par école pour la vérification de limite
  const maxClassesParEcole = caps?.max_classes_par_ecole ?? 0;
  const isAdmin = !!caps?.isAdmin;
  const classesCountByEcole = useMemo(() => {
    const map = new Map<string, number>();
    allClasses.forEach((c) => map.set(c.ecole_id, (map.get(c.ecole_id) ?? 0) + 1));
    return map;
  }, [allClasses]);

  const atLimit = useMemo(() => {
    if (isAdmin || maxClassesParEcole <= 0 || ecoles.length === 0) return false;
    if (ecoleFilter !== "all") {
      return (classesCountByEcole.get(ecoleFilter) ?? 0) >= maxClassesParEcole;
    }
    return ecoles.every(
      (e) => (classesCountByEcole.get(e.id) ?? 0) >= maxClassesParEcole,
    );
  }, [isAdmin, maxClassesParEcole, ecoles, classesCountByEcole, ecoleFilter]);

  const currentPlan: PlanKey = caps?.plan ?? "gratuit";
  const planLabel = PLAN_LABEL[currentPlan];
  const limitDescription = `${maxClassesParEcole} classe${maxClassesParEcole > 1 ? "s" : ""} par école`;
  const bannerMessage = `Le plan ${planLabel} autorise ${limitDescription}. Passez à un plan supérieur pour en ajouter davantage.`;

  const handleAdd = () => {
    if (atLimit) {
      setUpgradeOpen(true);
      return;
    }
    setEditing(null);
    setOpen(true);
  };


  return (
    <div className="px-5 pb-24 pt-5">
      <header className="mb-4">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Registre</div>
        <div className="flex items-end justify-between gap-3">
          <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Classes</h1>
          <span className="rounded-full bg-teal/10 px-3 py-1 text-xs font-semibold text-teal">
            {classes.length}
          </span>
        </div>
      </header>

      <div className="mb-3 space-y-2">
        <EcoleFilter
          value={ecoleFilter}
          onValueChange={setEcoleFilter}
          ecoles={ecoles}
          placeholder="Filtrer par école"
        />
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher une classe…" className="pl-9" />
        </div>
      </div>

      {canAdd && atLimit && (
        <PlanLimitBanner
          planLabel={planLabel}
          message={bannerMessage}
          onUpgrade={() => setUpgradeOpen(true)}
        />
      )}

      {!canAdd ? (
        <div className="card-elevated p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Ajoutez d'abord une école pour créer des classes.
          </p>
        </div>
      ) : isLoading ? (
        <ListSkeleton rows={4} />
      ) : pq.isEmpty ? (
        classes.length === 0 ? (
          <LockedEmptyState
            icon={<GraduationCap className="h-6 w-6" />}
            title="Aucune classe"
            hint="Créez votre première classe."
            lockedHint="Ajout de classe bloqué : la limite de votre plan est atteinte pour cette école."
            onAdd={handleAdd}
            addLabel={<><Plus className="mr-1 h-4 w-4" /> Ajouter une classe</> as unknown as string}
            locked={atLimit}
          />
        ) : (
          <NoResults
            query={q}
            onReset={() => {
              setQ("");
              setEcoleFilter("all");
            }}
          />
        )
      ) : (
        (() => {
          const renderItem = (c: Classe) => (
            <li
              key={c.id}
              className="card-elevated cursor-pointer p-4 transition hover:bg-cream-deep/40"
              onClick={() => setViewing(c)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setViewing(c);
                }
              }}
            >
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-teal/15 text-foreground">
                  <GraduationCap className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate font-display text-base font-semibold text-foreground">{c.nom}</h3>
                    <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-semibold text-foreground">{c.code}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    <EcoleBadge name={ecoleById[c.ecole_id]} fallback="École inconnue" />
                    {c.matiere ? ` · ${c.matiere}` : ""}
                    {" · "}{c.effectif} élève{c.effectif > 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button onClick={(e) => { e.stopPropagation(); setEditing(c); setOpen(true); }} aria-label="Modifier" className="rounded-md p-1.5 text-muted-foreground hover:bg-cream-deep hover:text-foreground">
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); setToDelete(c); }} aria-label="Supprimer" className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
          );
          const listView = (() => {
            if (ecoleFilter === "all") {
              const map = new Map<string, Classe[]>();
              paged.forEach((c) => {
                const list = map.get(c.ecole_id) ?? [];
                list.push(c);
                map.set(c.ecole_id, list);
              });
              const grouped = Array.from(map.entries()).sort((a, b) =>
                (ecoleById[a[0]] ?? "").localeCompare(ecoleById[b[0]] ?? ""),
              );
              return (
                <div className="space-y-4">
                  {grouped.map(([ecoleId, list]) => (
                    <section key={ecoleId}>
                      <EcoleGroupHeader name={ecoleById[ecoleId]} count={list.length} />
                      <ul className="space-y-3">{list.map(renderItem)}</ul>
                    </section>
                  ))}
                </div>
              );
            }
            return <ul className="space-y-3">{paged.map(renderItem)}</ul>;
          })();
          return (
            <div className="space-y-3">
              {listView}
              <DataPagination
                page={pq.page}
                totalPages={pq.totalPages}
                pageSize={pq.pageSize}
                totalCount={pq.totalCount}
                filteredCount={pq.filteredCount}
                start={pq.start}
                end={pq.end}
                onPageChange={pq.setPage}
                onPageSizeChange={pq.setPageSize}
                itemLabel="classes"
              />
            </div>
          );
        })()
      )}


      {canAdd && (
        <LockedFloatingAdd
          onClick={handleAdd}
          locked={atLimit}
          icon={<Plus className="h-6 w-6" />}
        />
      )}

      <ClasseDialog open={open} onOpenChange={setOpen} classe={editing} ecoles={ecoles} defaultEcoleId={ecoleFilter !== "all" ? ecoleFilter : ecoles[0]?.id} />
      <DeleteDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)} classe={toDelete} onDone={() => setToDelete(null)} />
      <PlanUpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        currentPlan={currentPlan}
        ecole={
          ecoleFilter !== "all"
            ? ecoleById[ecoleFilter]
            : ecoles[0]?.nom ?? ""
        }
        ressource="Classes"
        limitDescription={limitDescription}
      />
      <ClasseElevesDialog
        classe={viewing}
        ecoleNom={viewing ? ecoleById[viewing.ecole_id] : undefined}
        onOpenChange={(v) => !v && setViewing(null)}
      />
    </div>
  );
}


function ClasseDialog({
  open,
  onOpenChange,
  classe,
  ecoles,
  defaultEcoleId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  classe: Classe | null;
  ecoles: { id: string; nom: string }[];
  defaultEcoleId?: string;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState({ nom: "", code: "", matiere: "", effectif: "0", ecole_id: "" });

  useEffect(() => {
    if (open) {
      setForm({
        nom: classe?.nom ?? "",
        code: classe?.code ?? "",
        matiere: classe?.matiere ?? "",
        effectif: String(classe?.effectif ?? 0),
        ecole_id: classe?.ecole_id ?? defaultEcoleId ?? "",
      });
    }
  }, [open, classe, defaultEcoleId]);

  const save = useMutation({
    mutationFn: async () => {
      const user_id = await requireUserId();
      // Récupère l'année active pour rattacher la classe
      const { data: prof } = await supabase
        .from("profils_enseignant")
        .select("annee_active")
        .eq("user_id", user_id)
        .maybeSingle();
      const annee_scolaire = prof?.annee_active?.trim() || null;

      const payload = {
        nom: form.nom.trim(),
        code: form.code.trim(),
        matiere: form.matiere.trim() || null,
        effectif: Number(form.effectif) || 0,
        ecole_id: form.ecole_id,
      };
      if (!payload.nom || !payload.code) throw new Error("Nom et code obligatoires");
      if (!payload.ecole_id) throw new Error("Sélectionnez une école");
      if (classe) {
        await enqueueWrite({
          table: "classes",
          op: "update",
          payload,
          match: { id: classe.id },
          label: `Modifier classe ${payload.nom}`,
        });
      } else {
        await enqueueWrite({
          table: "classes",
          op: "insert",
          payload: { ...payload, id: crypto.randomUUID(), user_id, annee_scolaire },
          label: `Ajouter classe ${payload.nom}`,
        });
      }
    },

    onSuccess: () => {
      toast.success(classe ? "Classe modifiée" : "Classe ajoutée");
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[380px]">
        <DialogHeader>
          <DialogTitle className="font-display">{classe ? "Modifier la classe" : "Nouvelle classe"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
          <div className="space-y-1.5">
            <Label>École *</Label>
            <Select value={form.ecole_id} onValueChange={(v) => setForm({ ...form, ecole_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choisir une école" /></SelectTrigger>
              <SelectContent>
                {ecoles.map((e) => <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5 col-span-2">
              <Label htmlFor="cnom">Nom *</Label>
              <Input id="cnom" placeholder="ex. 6ème A" value={form.nom} onChange={(e) => setForm({ ...form, nom: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ccode">Code *</Label>
              <Input id="ccode" placeholder="6A" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ceff">Effectif</Label>
              <Input id="ceff" type="number" min={0} value={form.effectif} onChange={(e) => setForm({ ...form, effectif: e.target.value })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cmat">Matière enseignée</Label>
            <Input id="cmat" value={form.matiere} onChange={(e) => setForm({ ...form, matiere: e.target.value })} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Enregistrement…" : "Enregistrer"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ open, onOpenChange, classe, onDone }: { open: boolean; onOpenChange: (v: boolean) => void; classe: Classe | null; onDone: () => void; }) {
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: async () => {
      if (!classe) return;
      await enqueueWrite({
        table: "classes",
        op: "delete",
        match: { id: classe.id },
        label: `Supprimer classe ${classe.nom}`,
      });
    },
    onSuccess: () => {
      toast.success("Classe supprimée");
      qc.invalidateQueries({ queryKey: ["classes"] });
      qc.invalidateQueries({ queryKey: ["counts"] });
      onDone();
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer {classe?.nom} ?</AlertDialogTitle>
          <AlertDialogDescription>Les élèves et notes rattachés seront aussi supprimés.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Annuler</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => { e.preventDefault(); del.mutate(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Supprimer</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function ClasseElevesDialog({
  classe,
  ecoleNom,
  onOpenChange,
}: {
  classe: Classe | null;
  ecoleNom?: string;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: eleves = [], isLoading } = useQuery({
    ...elevesQO(classe?.id),
    enabled: !!classe?.id,
  });
  const { data: periodes = [] } = useQuery({
    ...periodesQO(),
    enabled: !!classe?.id,
  });
  const [periodeId, setPeriodeId] = useState<string>("all");
  const [matiere, setMatiere] = useState<string>("all");
  const [filter, setFilter] = useState<"all" | "with" | "without">("all");
  const [detailEleveId, setDetailEleveId] = useState<string | null>(null);

  useEffect(() => {
    if (!classe) return;
    const active = periodes.find((p) => p.active);
    setPeriodeId(active?.id ?? "all");
    setMatiere(classe.matiere?.trim() ? classe.matiere : "all");
    setFilter("all");
    setDetailEleveId(null);
  }, [classe, periodes]);

  // Toutes les notes de la classe (toutes périodes) pour lister les matières disponibles
  const { data: allNotes = [] } = useQuery({
    ...notesQO({ classeId: classe?.id }),
    enabled: !!classe?.id,
  });
  // Notes filtrées par période (matière filtrée côté client)
  const { data: notes = [] } = useQuery({
    ...notesQO({ classeId: classe?.id, periodeId: periodeId === "all" ? undefined : periodeId }),
    enabled: !!classe?.id,
  });

  const matiereOptions = useMemo(() => {
    const set = new Set<string>();
    allNotes.forEach((n) => n.matiere && set.add(n.matiere));
    if (classe?.matiere) set.add(classe.matiere);
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [allNotes, classe]);

  const notesFiltered = useMemo(
    () => (matiere === "all" ? notes : notes.filter((n) => (n.matiere ?? "") === matiere)),
    [notes, matiere],
  );
  const eleveIdsWithNotes = useMemo(
    () => new Set(notesFiltered.map((n) => n.eleve_id)),
    [notesFiltered],
  );

  const total = eleves.length;
  const nbF = eleves.filter((e) => (e.sexe ?? "").toUpperCase().startsWith("F")).length;
  const nbM = eleves.filter((e) => (e.sexe ?? "").toUpperCase().startsWith("M")).length;
  const nbNC = total - nbF - nbM;
  const withNotes = eleveIdsWithNotes.size;
  const periodeLabel = periodeId === "all"
    ? "toutes périodes"
    : periodes.find((p) => p.id === periodeId)?.label ?? "période";
  const matiereLabel = matiere === "all" ? "toutes matières" : matiere;

  const filteredEleves = useMemo(() => {
    if (filter === "with") return eleves.filter((e) => eleveIdsWithNotes.has(e.id));
    if (filter === "without") return eleves.filter((e) => !eleveIdsWithNotes.has(e.id));
    return eleves;
  }, [eleves, eleveIdsWithNotes, filter]);

  const detailEleve = detailEleveId ? eleves.find((e) => e.id === detailEleveId) ?? null : null;

  const open = !!classe;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="font-display">
            Élèves — {classe?.nom}
          </DialogTitle>
          {classe && (
            <p className="text-xs text-muted-foreground">
              {ecoleNom ?? "École"} · {classe.code}
              {classe.matiere ? ` · ${classe.matiere}` : ""}
            </p>
          )}
        </DialogHeader>

        <div className="space-y-3 rounded-xl border border-border/60 bg-card/40 p-3">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-teal/10 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Effectif</div>
              <div className="font-display text-lg font-semibold text-foreground">{total}</div>
            </div>
            <div className="rounded-lg bg-gold/15 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Filles / Garçons</div>
              <div className="font-display text-sm font-semibold text-foreground">
                {nbF} <span className="text-muted-foreground">·</span> {nbM}
                {nbNC > 0 && <span className="text-muted-foreground"> (+{nbNC})</span>}
              </div>
            </div>
            <div className="rounded-lg bg-teal/10 px-2 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Avec notes</div>
              <div className="font-display text-lg font-semibold text-foreground">
                {withNotes}<span className="text-xs text-muted-foreground">/{total}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Période</Label>
              <Select value={periodeId} onValueChange={setPeriodeId}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes périodes</SelectItem>
                  {periodes.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.label}{p.active ? " (active)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">Matière</Label>
              <Select value={matiere} onValueChange={setMatiere}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Matière" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes matières</SelectItem>
                  {matiereOptions.map((m) => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {withNotes} élève{withNotes > 1 ? "s" : ""} avec au moins une note — {periodeLabel} · {matiereLabel}.
          </p>
        </div>

        <div className="flex gap-1 rounded-lg bg-cream-deep/40 p-1">
          {([
            { k: "all", l: `Tous (${total})` },
            { k: "with", l: `Avec notes (${withNotes})` },
            { k: "without", l: `Sans notes (${total - withNotes})` },
          ] as const).map((t) => (
            <button
              key={t.k}
              type="button"
              onClick={() => setFilter(t.k)}
              className={`flex-1 rounded-md px-2 py-1.5 text-[11px] font-medium transition ${
                filter === t.k
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.l}
            </button>
          ))}
        </div>

        <div className="max-h-[40vh] overflow-y-auto">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chargement…</p>
          ) : filteredEleves.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              {eleves.length === 0 ? "Aucun élève dans cette classe." : "Aucun élève dans ce filtre."}
            </p>
          ) : (
            <ul className="space-y-2">
              {filteredEleves.map((e, i) => {
                const has = eleveIdsWithNotes.has(e.id);
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setDetailEleveId(e.id)}
                      className="flex w-full items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2 text-left transition hover:bg-cream-deep/40"
                    >
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal/15 text-[11px] font-semibold text-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium text-foreground">
                            {e.nom} {e.prenom}
                          </span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                              has ? "bg-teal/20 text-teal" : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {has ? "notée" : "à noter"}
                          </span>
                        </div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {e.sexe ? `${e.sexe} · ` : ""}
                          {e.numero_eleve ? `N° ${e.numero_eleve}` : "—"}
                          {e.tuteur_nom ? ` · ${e.tuteur_nom}` : ""}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>

      <EleveNotesQuickDialog
        eleve={detailEleve}
        classe={classe}
        periodes={periodes}
        periodeId={periodeId}
        matiere={matiere}
        onOpenChange={(v) => !v && setDetailEleveId(null)}
      />
    </Dialog>
  );
}

function EleveNotesQuickDialog({
  eleve,
  classe,
  periodes,
  periodeId,
  matiere,
  onOpenChange,
}: {
  eleve: { id: string; nom: string; prenom: string; ecole_id: string } | null;
  classe: Classe | null;
  periodes: { id: string; label: string; active: boolean }[];
  periodeId: string;
  matiere: string;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const open = !!eleve && !!classe;
  const { data: eleveNotes = [] } = useQuery({
    ...notesQO({ eleveId: eleve?.id, periodeId: periodeId === "all" ? undefined : periodeId }),
    enabled: open,
  });
  const filtered = useMemo(
    () => (matiere === "all" ? eleveNotes : eleveNotes.filter((n) => (n.matiere ?? "") === matiere)),
    [eleveNotes, matiere],
  );

  const [form, setForm] = useState({
    libelle: "",
    valeur: "",
    coefficient: "1",
    date: new Date().toISOString().slice(0, 10),
  });
  useEffect(() => {
    if (open) {
      setForm({
        libelle: "",
        valeur: "",
        coefficient: "1",
        date: new Date().toISOString().slice(0, 10),
      });
    }
  }, [open, eleve?.id, periodeId, matiere]);

  const periodeLabel = periodeId === "all"
    ? "toutes périodes"
    : periodes.find((p) => p.id === periodeId)?.label ?? "période";
  const canAdd = periodeId !== "all" && matiere !== "all";

  const add = useMutation({
    mutationFn: async () => {
      if (!eleve || !classe) return;
      if (!canAdd) throw new Error("Sélectionnez une période et une matière précises.");
      const valeur = Number(form.valeur);
      const coefficient = Number(form.coefficient) || 1;
      if (!form.libelle.trim()) throw new Error("Libellé requis");
      if (Number.isNaN(valeur)) throw new Error("Valeur invalide");
      const user_id = await requireUserId();
      await enqueueWrite({
        table: "notes",
        op: "insert",
        payload: {
          id: crypto.randomUUID(),
          user_id,
          eleve_id: eleve.id,
          ecole_id: eleve.ecole_id ?? classe.ecole_id,
          periode_id: periodeId,
          matiere,
          libelle: form.libelle.trim(),
          valeur,
          coefficient,
          date: form.date,
        },
        label: `Note ${form.libelle} — ${eleve.nom}`,
      });
    },
    onSuccess: () => {
      toast.success("Note enregistrée");
      qc.invalidateQueries({ queryKey: ["notes"] });
      setForm((f) => ({ ...f, libelle: "", valeur: "" }));
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const prefill = (n: { libelle: string; valeur: number; coefficient: number; date: string }) => {
    setForm({
      libelle: n.libelle,
      valeur: String(n.valeur),
      coefficient: String(n.coefficient ?? 1),
      date: n.date?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    });
    toast.success("Formulaire pré-rempli");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          <DialogTitle className="font-display">
            Notes — {eleve?.nom} {eleve?.prenom}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {periodeLabel} · {matiere === "all" ? "toutes matières" : matiere}
          </p>
        </DialogHeader>

        <div className="space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Notes existantes ({filtered.length})
          </div>
          <div className="max-h-[30vh] overflow-y-auto rounded-lg border border-border/60">
            {filtered.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                Aucune note pour ce filtre.
              </p>
            ) : (
              <ul className="divide-y divide-border/60">
                {filtered.map((n) => (
                  <li key={n.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{n.libelle}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {n.matiere ?? "—"} · coef {n.coefficient} · {n.date}
                      </div>
                    </div>
                    <span className="rounded-md bg-teal/15 px-1.5 py-0.5 font-semibold text-foreground">
                      {n.valeur}
                    </span>
                    <button
                      type="button"
                      onClick={() => prefill(n)}
                      className="rounded-md px-2 py-1 text-[10px] font-medium text-teal hover:bg-teal/10"
                    >
                      Pré-remplir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
          className="space-y-2 rounded-xl border border-border/60 bg-card/40 p-3"
        >
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nouvelle note
          </div>
          {!canAdd && (
            <p className="rounded-md bg-gold/15 px-2 py-1.5 text-[11px] text-foreground">
              Sélectionnez une période et une matière précises pour ajouter une note.
            </p>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px]">Libellé</Label>
              <Input
                value={form.libelle}
                onChange={(e) => setForm({ ...form, libelle: e.target.value })}
                placeholder="ex. Devoir 1"
                disabled={!canAdd}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Valeur</Label>
              <Input
                type="number"
                step="0.25"
                value={form.valeur}
                onChange={(e) => setForm({ ...form, valeur: e.target.value })}
                disabled={!canAdd}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-[10px]">Coefficient</Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={form.coefficient}
                onChange={(e) => setForm({ ...form, coefficient: e.target.value })}
                disabled={!canAdd}
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-[10px]">Date</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                disabled={!canAdd}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button type="submit" size="sm" disabled={!canAdd || add.isPending}>
              {add.isPending ? "Enregistrement…" : "Enregistrer la note"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
