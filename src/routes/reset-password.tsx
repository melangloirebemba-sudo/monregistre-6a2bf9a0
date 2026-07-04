import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Lock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Réinitialiser le mot de passe — MonRegistre" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // Supabase place le jeton de récupération dans le hash au retour du lien e-mail.
    // Le client détecte automatiquement la session ; on attend juste onAuthStateChange
    // ou getSession() pour être sûrs.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pwd.length < 8) return toast.error("Mot de passe trop court (8 caractères min.)");
    if (pwd !== pwd2) return toast.error("Les mots de passe ne correspondent pas");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDone(true);
    toast.success("Mot de passe mis à jour");
    setTimeout(() => navigate({ to: "/accueil" }), 1200);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-elevated w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-teal" />
          <h1 className="font-display text-lg font-semibold text-foreground">
            Nouveau mot de passe
          </h1>
        </div>

        {done ? (
          <div className="flex items-center gap-2 rounded-lg bg-teal/10 p-3 text-sm text-teal">
            <CheckCircle2 className="h-4 w-4" />
            Mot de passe mis à jour, redirection…
          </div>
        ) : !ready ? (
          <p className="text-sm text-muted-foreground">
            Ouvrez le lien reçu par e-mail depuis MonRegistre pour continuer.
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="pwd">Nouveau mot de passe</Label>
              <Input
                id="pwd"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd2">Confirmer</Label>
              <Input
                id="pwd2"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
