import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { profilQueryOptions } from "@/lib/queries/profil";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Bloque l'accès aux utilisateurs marqués « suspendu ». Le back-end les bannit
 * aussi via `auth.users.banned_until` — ce garde-fou UI empêche l'accès en cas
 * de session déjà ouverte au moment de la suspension.
 */
export function SuspendedGate() {
  const { data: profil } = useQuery(profilQueryOptions());
  const navigate = useNavigate();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const isSuspended = (profil as any)?.statut === "suspendu";

  if (!isSuspended) return null;

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.info("Session fermée.");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <Dialog open>
      <DialogContent onInteractOutside={(e) => e.preventDefault()} className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Ban className="h-5 w-5" /> Compte suspendu
          </DialogTitle>
          <DialogDescription>
            Votre compte a été suspendu par l'administrateur. Contactez le support
            pour plus d'informations.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="destructive" onClick={handleSignOut}>Se déconnecter</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
