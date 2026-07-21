import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { endDemo, isDemoMode } from "@/lib/demo";

export function DemoBanner() {
  const navigate = useNavigate();
  const [demo, setDemo] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    setDemo(isDemoMode());
    const onStorage = () => setDemo(isDemoMode());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!demo) return null;

  const handleEnd = async () => {
    await endDemo();
    setConfirmOpen(false);
    setDemo(false);
    navigate({ to: "/auth", search: { tab: "signup", from: "demo" } as never, replace: true });
  };

  return (
    <>
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-gold/40 bg-gold/15 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-gold" />
          <span>
            <strong>Mode démo</strong> — vos données ne seront pas conservées.
          </span>
        </div>
        <Button size="sm" variant="default" onClick={() => setConfirmOpen(true)}>
          Terminer la démo &amp; créer mon compte
        </Button>
      </div>
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Terminer la démo ?</AlertDialogTitle>
            <AlertDialogDescription>
              Vous allez être redirigé vers la création de compte. Les données de démonstration
              seront supprimées et vous repartirez d'un espace vierge.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <X className="mr-2 h-4 w-4" />
              Continuer la démo
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleEnd}>Créer mon compte</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
