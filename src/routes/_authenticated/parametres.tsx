import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Plus, Trash2, Check, X, Sparkles } from "lucide-react";
import { profilQueryOptions, planCapabilitiesQO, type Profil, type PlanCapabilities } from "@/lib/queries/profil";
import { periodesQO, requireUserId, type Periode } from "@/lib/queries/data";
import { supabase } from "@/integrations/supabase/client";

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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/parametres")({
  head: () => ({ meta: [{ title: "Paramètres — MonRegistre" }] }),
  component: ParametresPage,
});

function ParametresPage() {
  const { data: profil } = useQuery(profilQueryOptions());
  const { data: caps } = useQuery(planCapabilitiesQO());
  const { data: periodes = [] } = useQuery(periodesQO());
  const qc = useQueryClient();


  const [nom, setNom] = useState("");
  const [initiales, setInitiales] = useState("");
  const [annee, setAnnee] = useState("");
  const [echelle, setEchelle] = useState("20");

  useEffect(() => {
    if (!profil) return;
    setNom(profil.nom_affiche ?? "");
    setInitiales(profil.initiales ?? "");
    setAnnee(profil.annee_active ?? "");
    setEchelle(String(profil.echelle_notation ?? 20));
  }, [profil]);

  const save = useMutation({
    mutationFn: async () => {
      const uid = await requireUserId();
      const patch: Partial<Profil> = {
        nom_affiche: nom.trim(),
        initiales: initiales.trim().slice(0, 2).toUpperCase() || "EM",
        annee_active: annee.trim(),
        echelle_notation: Number(echelle),
      };
      const { error } = await supabase
        .from("profils_enseignant")
        .update(patch)
        .eq("user_id", uid);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil enregistré");
      qc.invalidateQueries({ queryKey: ["profil"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newPeriode, setNewPeriode] = useState("");
  const addPeriode = useMutation({
    mutationFn: async () => {
      const label = newPeriode.trim();
      if (!label) throw new Error("Nom obligatoire");
      const user_id = await requireUserId();
      const ordre = periodes.length + 1;
      const { error } = await supabase.from("periodes").insert({
        user_id,
        label,
        ordre,
        annee_scolaire: annee || new Date().getFullYear() + "",
        active: periodes.length === 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPeriode("");
      toast.success("Période ajoutée");
      qc.invalidateQueries({ queryKey: ["periodes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const togglePeriode = useMutation({
    mutationFn: async (p: Periode) => {
      const uid = await requireUserId();
      const { error: e1 } = await supabase.from("periodes").update({ active: false }).eq("user_id", uid);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("periodes").update({ active: true }).eq("id", p.id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periodes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const delPeriode = useMutation({
    mutationFn: async (p: Periode) => {
      const { error } = await supabase.from("periodes").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Période supprimée");
      qc.invalidateQueries({ queryKey: ["periodes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addPreset = useMutation({
    mutationFn: async (preset: "trimestres" | "semestres") => {
      const user_id = await requireUserId();
      const labels = preset === "trimestres"
        ? ["1er trimestre", "2ème trimestre", "3ème trimestre"]
        : ["1er semestre", "2ème semestre"];
      const anneeVal = annee || new Date().getFullYear() + "";
      const rows = labels.map((label, i) => ({
        user_id, label, ordre: i + 1, annee_scolaire: anneeVal, active: i === 0,
      }));
      const { error } = await supabase.from("periodes").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Périodes créées");
      qc.invalidateQueries({ queryKey: ["periodes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-5 pb-24 pt-5">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Compte</div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">Paramètres</h1>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="card-elevated space-y-5 p-5"
      >
        <div className="space-y-2">
          <Label htmlFor="nom">Nom affiché</Label>
          <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="init">Initiales</Label>
            <Input id="init" value={initiales} maxLength={2} onChange={(e) => setInitiales(e.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ech">Échelle</Label>
            <Select value={echelle} onValueChange={setEchelle}>
              <SelectTrigger id="ech"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="10">/10</SelectItem>
                <SelectItem value="20">/20</SelectItem>
                <SelectItem value="100">/100</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="annee">Année scolaire active</Label>
          <Input id="annee" placeholder="2025-2026" value={annee} onChange={(e) => setAnnee(e.target.value)} />
        </div>
        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>

      <section className="card-elevated mt-6 space-y-4 p-5">
        <div>
          <h2 className="font-display text-lg font-semibold">Périodes scolaires</h2>
          <p className="text-xs text-muted-foreground">
            Utilisées pour organiser les notes et générer les bulletins.
          </p>
        </div>

        {periodes.length === 0 && (
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" onClick={() => addPreset.mutate("trimestres")}>
              Créer 3 trimestres
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => addPreset.mutate("semestres")}>
              Créer 2 semestres
            </Button>
          </div>
        )}

        <ul className="space-y-2">
          {periodes.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-background/60 px-3 py-2">
              <button
                type="button"
                onClick={() => !p.active && togglePeriode.mutate(p)}
                aria-label="Rendre active"
                className={p.active ? "text-teal" : "text-muted-foreground hover:text-foreground"}
              >
                {p.active ? <CheckCircle2 className="h-5 w-5" /> : <Circle className="h-5 w-5" />}
              </button>
              <div className="flex-1">
                <div className="text-sm font-medium">{p.label}</div>
                <div className="text-[10px] text-muted-foreground">{p.annee_scolaire}</div>
              </div>
              <button
                type="button"
                onClick={() => delPeriode.mutate(p)}
                aria-label="Supprimer"
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>

        <div className="flex gap-2">
          <Input
            value={newPeriode}
            onChange={(e) => setNewPeriode(e.target.value)}
            placeholder="Nouvelle période"
          />
          <Button type="button" onClick={() => addPeriode.mutate()} disabled={addPeriode.isPending}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </section>
    </div>
  );
}
