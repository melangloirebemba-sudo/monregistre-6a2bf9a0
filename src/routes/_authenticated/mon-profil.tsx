import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { UserCircle2 } from "lucide-react";
import { profilQueryOptions } from "@/lib/queries/profil";
import { requireUserId } from "@/lib/queries/data";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/mon-profil")({
  head: () => ({ meta: [{ title: "Mon profil — MonRegistre" }] }),
  component: MonProfilPage,
});

function MonProfilPage() {
  const { data: profil } = useQuery(profilQueryOptions());
  const qc = useQueryClient();

  const [prenom, setPrenom] = useState("");
  const [nomFamille, setNomFamille] = useState("");
  const [telephone, setTelephone] = useState("");
  const [email, setEmail] = useState("");
  const [matiere, setMatiere] = useState("");
  const [etablissement, setEtablissement] = useState("");
  const [initiales, setInitiales] = useState("");

  useEffect(() => {
    if (!profil) return;
    setPrenom(profil.prenom ?? "");
    setNomFamille(profil.nom_famille ?? "");
    setTelephone(profil.telephone ?? "");
    setEmail(profil.email ?? "");
    setMatiere(profil.matiere_principale ?? "");
    setEtablissement(profil.etablissement ?? "");
    setInitiales(profil.initiales ?? "");
  }, [profil]);

  const save = useMutation({
    mutationFn: async () => {
      const uid = await requireUserId();
      const nomAffiche = `${prenom.trim()} ${nomFamille.trim()}`.trim() || profil?.nom_affiche || "Enseignant";
      const inits =
        initiales.trim().slice(0, 2).toUpperCase() ||
        `${prenom.trim().charAt(0)}${nomFamille.trim().charAt(0)}`.toUpperCase() ||
        "EM";
      const patch = {
        prenom: prenom.trim() || null,
        nom_famille: nomFamille.trim() || null,
        telephone: telephone.trim() || null,
        email: email.trim() || null,
        matiere_principale: matiere.trim() || null,
        etablissement: etablissement.trim() || null,
        nom_affiche: nomAffiche,
        initiales: inits,
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

  const displayInitiales =
    initiales ||
    `${prenom.charAt(0)}${nomFamille.charAt(0)}`.toUpperCase() ||
    profil?.initiales ||
    "EM";

  return (
    <div className="px-5 pb-24 pt-5">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Compte
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
          Mon profil
        </h1>
      </div>

      <div className="card-elevated flex items-center gap-4 p-5 mb-4">
        <div className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-gold font-display text-xl font-semibold text-gold-foreground shadow-soft">
          {displayInitiales}
        </div>
        <div className="min-w-0">
          <div className="font-display text-lg font-semibold text-foreground">
            {`${prenom} ${nomFamille}`.trim() || profil?.nom_affiche || "Enseignant"}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {matiere || "Enseignant"}
            {etablissement ? ` • ${etablissement}` : ""}
          </div>
          {telephone && (
            <div className="text-xs text-muted-foreground">{telephone}</div>
          )}
        </div>
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); save.mutate(); }}
        className="card-elevated space-y-5 p-5"
      >
        <div className="flex items-center gap-2 text-sm font-medium text-foreground">
          <UserCircle2 className="h-4 w-4" />
          Informations personnelles
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="prenom">Prénom</Label>
            <Input id="prenom" value={prenom} onChange={(e) => setPrenom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="nomf">Nom</Label>
            <Input id="nomf" value={nomFamille} onChange={(e) => setNomFamille(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="tel">Numéro de téléphone</Label>
            <Input id="tel" type="tel" value={telephone} onChange={(e) => setTelephone(e.target.value)} placeholder="+229 ..." />
          </div>
          <div className="space-y-2">
            <Label htmlFor="mail">Email</Label>
            <Input id="mail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="mat">Matière principale</Label>
            <Input id="mat" value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Mathématiques, Français…" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="etab">Établissement</Label>
            <Input id="etab" value={etablissement} onChange={(e) => setEtablissement(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="init">Initiales (2 lettres)</Label>
          <Input
            id="init"
            value={initiales}
            maxLength={2}
            onChange={(e) => setInitiales(e.target.value.toUpperCase())}
          />
        </div>

        <Button type="submit" disabled={save.isPending} className="w-full">
          {save.isPending ? "Enregistrement…" : "Enregistrer"}
        </Button>
      </form>
    </div>
  );
}
