import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sparkles, LogOut } from "lucide-react";
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
import { DemoConversionDialog } from "@/components/app/demo-conversion-dialog";

export function DemoBanner() {
  const navigate = useNavigate();
  const [demo, setDemo] = useState(false);
  const [convertOpen, setConvertOpen] = useState(false);
  const [quitOpen, setQuitOpen] = useState(false);

  useEffect(() => {
    setDemo(isDemoMode());
    const onStorage = () => setDemo(isDemoMode());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  if (!demo) return null;

  const handleQuit = async () => {
    await endDemo();
    setQuitOpen(false);
    setDemo(false);
    navigate({ to: "/auth", replace: true });
  };

  return (
    <>
      <div className="sticky top-0 z-40 flex flex-wrap items-center justify-between gap-2 border-b border-gold/40 bg-gold/15 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 text-foreground">
          <Sparkles className="h-4 w-4 text-gold" />
          <span>
            <strong>Mode démo</strong> — créez un compte pour conserver vos données.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={() => setQuitOpen(true)}>
            <LogOut className="mr-1 h-4 w-4" />
            Quitter
          </Button>
          <Button size="sm" variant="default" onClick={() => setConvertOpen(true)}>
            Créer mon compte
          </Button>
        </div>
      </div>

      <DemoConversionDialog open={convertOpen} onOpenChange={setConvertOpen} />

      <AlertDialog open={quitOpen} onOpenChange={setQuitOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Quitter la démo ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les données de démonstration seront perdues. Créez plutôt votre compte pour les
              conserver.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuer la démo</AlertDialogCancel>
            <AlertDialogAction onClick={handleQuit}>Quitter sans conserver</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
