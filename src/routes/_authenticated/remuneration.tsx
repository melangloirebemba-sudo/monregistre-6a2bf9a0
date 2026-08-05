import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Coins, Plus, Trash2, Wallet, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toFrench } from "@/lib/errors";
import { ecolesQO, requireUserId } from "@/lib/queries/data";
import {
  CYCLES,
  STATUTS,
  formatHeures,
  labelMois,
  paiementsSalaireQO,
  seancesQO,
  syntheseParEcole,
  tarifsQO,
  type Cycle,
  type SalaireStatut,
} from "@/lib/queries/remuneration";
import { formatMontantXAF } from "@/lib/pdf/recu-paiement-shared";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/remuneration")({
  head: () => ({
    meta: [
      { title: "Heures & rémunération — MonRegistre" },
      {
        name: "description",
        content:
          "Suivi des heures effectuées par école, estimation du salaire net et historique des paiements reçus.",
      },
      { property: "og:title", content: "Heures & rémunération — MonRegistre" },
      {
        property: "og:description",
        content: "Heures de cours, estimation de salaire et paiements reçus par école.",
      },
    ],
  }),
  loader: ({ context }) => {
    void context.queryClient.prefetchQuery(ecolesQO());
    void context.queryClient.prefetchQuery(tarifsQO());
  },
  component: RemunerationPage,
});

function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const debut = new Date(y!, (m ?? 1) - 1, 1);
  const fin = new Date(y!, m ?? 1, 0);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return { debut: iso(debut), fin: iso(fin) };
}

function RemunerationPage() {
  const qc = useQueryClient();
  const now = new Date();
  const [mois, setMois] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
  );
  const { debut, fin } = monthBounds(mois);

  const { data: ecoles = [] } = useQuery(ecolesQO());
  const { data: tarifs = [] } = useQuery(tarifsQO());
  const { data: seances = [] } = useQuery(seancesQO(debut, fin));
  const { data: paiements = [] } = useQuery(paiementsSalaireQO());

  const ecoleNom = useMemo(
    () => Object.fromEntries(ecoles.map((e) => [e.id, e.nom])),
    [ecoles],
  );
  const synthese = useMemo(() => syntheseParEcole(seances, tarifs), [seances, tarifs]);
  const totalEstime = synthese.reduce((a, s) => a + s.montantEstime, 0);
  const totalMinutes = synthese.reduce((a, s) => a + s.minutesEffectuees, 0);
  const totalPerdu = synthese.reduce((a, s) => a + s.montantPerdu, 0);

  const [tarifOpen, setTarifOpen] = useState(false);
  const [tEcole, setTEcole] = useState("");
  const [tCycle, setTCycle] = useState<Cycle>("college");
  const [tMatiere, setTMatiere] = useState("");
  const [tMontant, setTMontant] = useState("");

  const saveTarif = useMutation({
    mutationFn: async () => {
      if (!tEcole) throw new Error("École requise");
      const montant = Number(tMontant);
      if (!Number.isFinite(montant) || montant <= 0) throw new Error("Montant horaire invalide");
      const uid = await requireUserId();
      const { error } = await supabase.from("tarifs_horaires").insert({
        user_id: uid,
        ecole_id: tEcole,
        cycle: tCycle,
        matiere: tMatiere.trim() || null,
        montant_horaire: Math.round(montant),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarifs-horaires"] });
      toast.success("Tarif horaire enregistré");
      setTarifOpen(false);
      setTMatiere("");
      setTMontant("");
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const delTarif = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tarifs_horaires").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tarifs-horaires"] });
      toast.success("Tarif supprimé");
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const [payOpen, setPayOpen] = useState(false);
  const [pEcole, setPEcole] = useState("");
  const [pMontant, setPMontant] = useState("");
  const [pStatut, setPStatut] = useState<SalaireStatut>("paye");
  const [pMoyen, setPMoyen] = useState("");
  const [pRef, setPRef] = useState("");

  const savePaiement = useMutation({
    mutationFn: async () => {
      if (!pEcole) throw new Error("École requise");
      const montant = Number(pMontant);
      if (!Number.isFinite(montant) || montant <= 0) throw new Error("Montant invalide");
      const uid = await requireUserId();
      const { error } = await supabase.from("paiements_salaire").insert({
        user_id: uid,
        ecole_id: pEcole,
        mois: `${mois}-01`,
        montant: Math.round(montant),
        statut: pStatut,
        heures_payees:
          Math.round(
            ((synthese.find((s) => s.ecole_id === pEcole)?.minutesEffectuees ?? 0) / 60) * 100,
          ) / 100,
        moyen_paiement: pMoyen.trim() || null,
        reference: pRef.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paiements-salaire"] });
      toast.success("Paiement enregistré");
      setPayOpen(false);
      setPMontant("");
      setPMoyen("");
      setPRef("");
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const delSeance = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("seances").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["seances"] });
      toast.success("Séance supprimée");
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-serif text-foreground">Heures & rémunération</h1>
          <p className="text-sm text-foreground/60">
            Heures assurées, estimation du salaire net et paiements reçus.
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">Mois</Label>
          <Input type="month" value={mois} onChange={(e) => setMois(e.target.value)} />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="card-elevated p-4">
          <div className="flex items-center gap-2 text-teal">
            <Clock className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Heures payables</span>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold text-foreground">
            {formatHeures(totalMinutes)}
          </p>
        </div>
        <div className="card-elevated p-4">
          <div className="flex items-center gap-2 text-success">
            <Wallet className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Salaire estimé</span>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold text-foreground">
            {formatMontantXAF(Math.round(totalEstime))}
          </p>
        </div>
        <div className="card-elevated p-4">
          <div className="flex items-center gap-2 text-destructive">
            <TrendingDown className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-widest">Retenues</span>
          </div>
          <p className="mt-2 font-display text-2xl font-semibold text-foreground">
            {formatMontantXAF(Math.round(totalPerdu))}
          </p>
        </div>
      </section>

      <section className="card-elevated p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
          Détail par école — {labelMois(`${mois}-01`)}
        </h2>
        {synthese.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Aucune séance validée ce mois-ci. Valide ta présence depuis l'accueil ou l'emploi du temps.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {synthese.map((s) => (
              <li key={s.ecole_id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">{ecoleNom[s.ecole_id] ?? "École"}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.seances} séance(s) · {formatHeures(s.minutesEffectuees)} payables ·{" "}
                    {formatHeures(s.minutesPerdues)} non payées
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-semibold text-foreground">
                    {formatMontantXAF(Math.round(s.montantEstime), s.devise)}
                  </p>
                  {s.montantPerdu > 0 && (
                    <p className="text-xs text-destructive">
                      −{formatMontantXAF(Math.round(s.montantPerdu), s.devise)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-elevated p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-foreground">Tarifs horaires</h2>
          <Button
            size="sm"
            onClick={() => {
              setTEcole(ecoles[0]?.id ?? "");
              setTarifOpen(true);
            }}
            className="bg-teal text-ink-foreground hover:bg-teal/90"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Tarif
          </Button>
        </div>
        {tarifs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ajoute un tarif horaire par école et par cycle pour estimer ton salaire.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {tarifs.map((t) => (
              <li key={t.id} className="flex items-center gap-3 py-2.5">
                <Coins className="h-4 w-4 shrink-0 text-gold" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {ecoleNom[t.ecole_id] ?? "École"} ·{" "}
                    {CYCLES.find((c) => c.value === t.cycle)?.label}
                    {t.matiere ? ` · ${t.matiere}` : " · toutes matières"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatMontantXAF(t.montant_horaire, t.devise)} / heure
                  </p>
                </div>
                <Button size="icon" variant="ghost" onClick={() => delTarif.mutate(t.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-elevated p-5">
        <h2 className="mb-3 font-display text-lg font-semibold text-foreground">
          Séances du mois
        </h2>
        {seances.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune séance enregistrée ce mois-ci.</p>
        ) : (
          <ul className="divide-y divide-border">
            {seances.map((s) => (
              <li key={s.id} className="flex items-center gap-3 py-2.5">
                <div className="w-20 shrink-0 text-xs text-muted-foreground">
                  {new Date(s.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })}
                  <div>{s.heure_debut.slice(0, 5)}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {ecoleNom[s.ecole_id] ?? "École"}
                    {s.matiere ? ` · ${s.matiere}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {STATUTS.find((x) => x.value === s.statut)?.label}
                    {s.retard_minutes > 0 ? ` · retard ${s.retard_minutes} min` : ""}
                    {s.motif ? ` · ${s.motif}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    s.statut === "effectuee"
                      ? "bg-success/15 text-success"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {formatHeures(
                    s.statut === "effectuee"
                      ? Math.max(
                          0,
                          (Number(s.heure_fin.slice(0, 2)) * 60 +
                            Number(s.heure_fin.slice(3, 5))) -
                            (Number(s.heure_debut.slice(0, 2)) * 60 +
                              Number(s.heure_debut.slice(3, 5))) -
                            s.retard_minutes,
                        )
                      : 0,
                  )}
                </span>
                <Button size="icon" variant="ghost" onClick={() => delSeance.mutate(s.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card-elevated p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Historique des salaires
          </h2>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setPEcole(synthese[0]?.ecole_id ?? ecoles[0]?.id ?? "");
              setPMontant(String(Math.round(totalEstime)));
              setPayOpen(true);
            }}
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Paiement reçu
          </Button>
        </div>
        {paiements.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun paiement enregistré.</p>
        ) : (
          <ul className="divide-y divide-border">
            {paiements.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {ecoleNom[p.ecole_id] ?? "École"} · {labelMois(p.mois)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.moyen_paiement ?? "—"}
                    {p.reference ? ` · ${p.reference}` : ""} ·{" "}
                    {new Date(p.paye_le).toLocaleDateString("fr-FR")}
                  </p>
                </div>
                <span className="font-display font-semibold text-foreground">
                  {formatMontantXAF(p.montant, p.devise)}
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    p.statut === "paye"
                      ? "bg-success/15 text-success"
                      : "bg-gold/20 text-foreground"
                  }`}
                >
                  {p.statut === "paye" ? "Payé" : p.statut === "partiel" ? "Partiel" : "En attente"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={tarifOpen} onOpenChange={setTarifOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau tarif horaire</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>École</Label>
              <Select value={tEcole} onValueChange={setTEcole}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {ecoles.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Cycle</Label>
              <Select value={tCycle} onValueChange={(v) => setTCycle(v as Cycle)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CYCLES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Matière (vide = toutes)</Label>
              <Input
                value={tMatiere}
                onChange={(e) => setTMatiere(e.target.value)}
                placeholder="Mathématiques"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Montant par heure (FCFA)</Label>
              <Input
                type="number"
                min={0}
                value={tMontant}
                onChange={(e) => setTMontant(e.target.value)}
                placeholder="2500"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarifOpen(false)}>Annuler</Button>
            <Button
              onClick={() => saveTarif.mutate()}
              disabled={saveTarif.isPending}
              className="bg-teal text-ink-foreground hover:bg-teal/90"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Paiement reçu — {labelMois(`${mois}-01`)}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>École</Label>
              <Select value={pEcole} onValueChange={setPEcole}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  {ecoles.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.nom}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Montant reçu (FCFA)</Label>
              <Input
                type="number"
                min={0}
                value={pMontant}
                onChange={(e) => setPMontant(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Statut</Label>
              <Select value={pStatut} onValueChange={(v) => setPStatut(v as SalaireStatut)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paye">Payé</SelectItem>
                  <SelectItem value="partiel">Partiel</SelectItem>
                  <SelectItem value="en_attente">En attente</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Moyen</Label>
                <Input
                  value={pMoyen}
                  onChange={(e) => setPMoyen(e.target.value)}
                  placeholder="Mobile Money"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Référence</Label>
                <Input value={pRef} onChange={(e) => setPRef(e.target.value)} placeholder="TX-001" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>Annuler</Button>
            <Button
              onClick={() => savePaiement.mutate()}
              disabled={savePaiement.isPending}
              className="bg-teal text-ink-foreground hover:bg-teal/90"
            >
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
