import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toFrench } from "@/lib/errors";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PasswordCriteria,
  PASSWORD_MIN_LENGTH,
  isPasswordValid,
} from "@/components/app/password-criteria";
import { setDemoMode } from "@/lib/demo";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

/**
 * Convertit l'utilisateur anonyme (démo) en compte permanent en conservant
 * toutes ses données créées pendant la démonstration.
 */
export function DemoConversionDialog({ open, onOpenChange }: Props) {
  const navigate = useNavigate();
  const [nom, setNom] = useState("");
  const [email, setEmail] = useState("");
  const [telephone, setTelephone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const tel = telephone.trim();
    if (tel && !/^\+?[0-9\s().-]{6,20}$/.test(tel)) {
      toast.error("Numéro WhatsApp invalide");
      return;
    }
    setLoading(true);
    try {
      // 1) Rattache un email au compte anonyme (déclenche un email de confirmation)
      const { error: emailErr } = await supabase.auth.updateUser({
        email,
        data: { nom_affiche: nom, telephone: tel || null },
      });
      if (emailErr) throw emailErr;
      // 2) Définit le mot de passe
      const { error: pwErr } = await supabase.auth.updateUser({ password });
      if (pwErr) throw pwErr;
      // 3) Met à jour le profil enseignant si présent
      const { data: userData } = await supabase.auth.getUser();
      if (userData.user) {
        await supabase
          .from("profils_enseignant")
          .update({
            nom_affiche: nom,
            telephone: tel || null,
            initiales: nom.trim().slice(0, 2).toUpperCase() || undefined,
          })
          .eq("user_id", userData.user.id);
      }
      setDemoMode(false);
      toast.success("Compte créé — vos données de démo sont conservées !");
      onOpenChange(false);
      navigate({ to: "/accueil", replace: true });
    } catch (err) {
      toast.error(toFrench(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-gold" />
            Créer mon compte
          </DialogTitle>
          <DialogDescription>
            Créez votre compte pour <strong>conserver toutes les données</strong> saisies pendant
            la démo (écoles, classes, élèves, notes…). Aucune donnée ne sera perdue.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="dc-nom">Nom affiché</Label>
            <Input
              id="dc-nom"
              required
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Emmanuel Mendy"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dc-email">Email</Label>
            <Input
              id="dc-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dc-tel">Numéro WhatsApp</Label>
            <Input
              id="dc-tel"
              type="tel"
              autoComplete="tel"
              required
              value={telephone}
              onChange={(e) => setTelephone(e.target.value)}
              placeholder="+242 06 000 00 00"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dc-password">Mot de passe</Label>
            <Input
              id="dc-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <PasswordCriteria value={password} />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Continuer la démo
            </Button>
            <Button type="submit" disabled={loading || !isPasswordValid(password)}>
              {loading ? "Création…" : "Créer et conserver mes données"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
