import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { profilQueryOptions, type Profil } from "@/lib/queries/profil";
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
      const { data: userRes } = await supabase.auth.getUser();
      if (!userRes.user) throw new Error("Session expirée");
      const patch: Partial<Profil> = {
        nom_affiche: nom.trim(),
        initiales: initiales.trim().slice(0, 2).toUpperCase() || "EM",
        annee_active: annee.trim(),
        echelle_notation: Number(echelle),
      };
      const { error } = await supabase
        .from("profils_enseignant")
        .update(patch)
        .eq("user_id", userRes.user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil enregistré");
      qc.invalidateQueries({ queryKey: ["profil"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="px-5 pb-6 pt-5">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Compte
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
          Paramètres
        </h1>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          save.mutate();
        }}
        className="card-elevated space-y-5 p-5"
      >
        <div className="space-y-2">
          <Label htmlFor="nom">Nom affiché</Label>
          <Input id="nom" value={nom} onChange={(e) => setNom(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="init">Initiales</Label>
            <Input
              id="init"
              value={initiales}
              maxLength={2}
              onChange={(e) => setInitiales(e.target.value.toUpperCase())}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ech">Échelle</Label>
            <Select value={echelle} onValueChange={setEchelle}>
              <SelectTrigger id="ech">
                <SelectValue />
              </SelectTrigger>
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
          <Input
            id="annee"
            placeholder="2025-2026"
            value={annee}
            onChange={(e) => setAnnee(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </div>
  );
}
