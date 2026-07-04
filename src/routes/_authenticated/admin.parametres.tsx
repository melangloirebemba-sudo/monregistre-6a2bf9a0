import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Settings2,
  MessageCircle,
  Mail,
  Palette,
  Lock,
  AtSign,
  ShieldCheck,
  Save,
  KeyRound,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { adminApi, type AppSettings } from "@/lib/admin-api";
import { supabase } from "@/integrations/supabase/client";
import { updateSupportConfig } from "@/config/support";

export const Route = createFileRoute("/_authenticated/admin/parametres")({
  head: () => ({
    meta: [
      { title: "Paramètres — Console admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminSettingsPage,
});

function AdminSettingsPage() {
  return (
    <div className="space-y-5 px-4 py-5 sm:space-y-6 sm:px-5 sm:py-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Backoffice
        </div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">
          <Settings2 className="h-6 w-6 shrink-0 text-teal sm:h-7 sm:w-7" />
          <span className="truncate">Paramètres administrateur</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Thème d'affichage, coordonnées du support et sécurité de votre compte.
        </p>
      </header>

      <AppearanceCard />
      <SupportSettingsCard />
      <AdminAccountCard />
    </div>
  );
}

/* ----------------------- Apparence (mode sombre) ----------------------- */

function AppearanceCard() {
  return (
    <section className="card-elevated p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <Palette className="h-5 w-5 text-teal" />
        <h2 className="font-display text-base font-semibold text-foreground">
          Apparence
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Choisir le thème d'affichage. « Auto » suit les réglages de votre appareil.
      </p>
      <div className="mt-3">
        <ThemeToggle />
      </div>
    </section>
  );
}

/* ------------------------ Coordonnées du support ------------------------ */

function SupportSettingsCard() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: () => adminApi.settingsGet(),
    staleTime: 30_000,
  });

  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [whatsappDisplay, setWhatsappDisplay] = useState("");
  const [supportEmail, setSupportEmail] = useState("");

  useEffect(() => {
    if (!data) return;
    setWhatsappNumber(data.whatsapp_number);
    setWhatsappDisplay(data.whatsapp_display);
    setSupportEmail(data.support_email);
  }, [data]);

  const save = useMutation({
    mutationFn: () =>
      adminApi.settingsUpdate({
        whatsapp_number: whatsappNumber,
        whatsapp_display: whatsappDisplay,
        support_email: supportEmail,
      }),
    onSuccess: () => {
      updateSupportConfig({
        whatsappNumber: whatsappNumber.replace(/\D/g, ""),
        whatsappDisplay,
        supportEmail,
      });
      toast.success("Coordonnées du support enregistrées");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const dirty =
    !!data &&
    (whatsappNumber !== data.whatsapp_number ||
      whatsappDisplay !== data.whatsapp_display ||
      supportEmail !== data.support_email);

  return (
    <section className="card-elevated p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-teal" />
        <h2 className="font-display text-base font-semibold text-foreground">
          Coordonnées du support
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Numéro WhatsApp et adresse e-mail utilisés dans toute l'application
        (page Support, écrans de mise à niveau, etc.).
      </p>

      {isLoading && (
        <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
      )}
      {error && (
        <p className="mt-4 text-sm text-destructive">
          Erreur : {(error as Error).message}
        </p>
      )}

      {data && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="wa-number">Numéro WhatsApp (format international)</Label>
            <Input
              id="wa-number"
              inputMode="tel"
              placeholder="242069626540"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
            />
            <p className="text-[11px] text-muted-foreground">
              Sans « + », sans espaces. Ex : 242069626540
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa-display">Libellé affiché</Label>
            <Input
              id="wa-display"
              placeholder="+242 06 962 65 40"
              value={whatsappDisplay}
              onChange={(e) => setWhatsappDisplay(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="support-email" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> E-mail du support
            </Label>
            <Input
              id="support-email"
              type="email"
              placeholder="support@monregistre.app"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
            />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              disabled={!dirty || save.isPending}
              onClick={() => save.mutate()}
            >
              <Save className="mr-1.5 h-4 w-4" />
              {save.isPending ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------- Compte administrateur ------------------------- */

function AdminAccountCard() {
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentEmail(data.user?.email ?? "");
      setNewEmail(data.user?.email ?? "");
    });
  }, []);

  const updateEmail = useMutation({
    mutationFn: async () => {
      const email = newEmail.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new Error("Adresse e-mail invalide");
      }
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        "E-mail mis à jour. Un lien de confirmation a été envoyé aux deux adresses.",
      );
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updatePassword = useMutation({
    mutationFn: async () => {
      if (password.length < 8) throw new Error("Mot de passe trop court (8 caractères min.)");
      if (password !== passwordConfirm) throw new Error("Les mots de passe ne correspondent pas");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Mot de passe administrateur mis à jour");
      setPassword("");
      setPasswordConfirm("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="card-elevated p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-teal" />
        <h2 className="font-display text-base font-semibold text-foreground">
          Mon compte administrateur
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Modifier l'adresse e-mail de connexion et le mot de passe administrateur.
      </p>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Email */}
        <div className="space-y-2 rounded-xl border border-border/60 bg-cream-deep/20 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <AtSign className="h-4 w-4 text-teal" /> Adresse e-mail
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-email" className="text-xs">
              Nouvelle adresse (actuelle : {currentEmail || "…"})
            </Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            variant="secondary"
            disabled={
              updateEmail.isPending ||
              !newEmail.trim() ||
              newEmail.trim() === currentEmail
            }
            onClick={() => updateEmail.mutate()}
          >
            {updateEmail.isPending ? "Envoi…" : "Mettre à jour l'e-mail"}
          </Button>
        </div>

        {/* Password */}
        <div className="space-y-2 rounded-xl border border-border/60 bg-cream-deep/20 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Lock className="h-4 w-4 text-teal" /> Mot de passe
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-pwd" className="text-xs">
              Nouveau mot de passe
            </Label>
            <Input
              id="admin-pwd"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="admin-pwd2" className="text-xs">
              Confirmer
            </Label>
            <Input
              id="admin-pwd2"
              type="password"
              autoComplete="new-password"
              minLength={8}
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
            />
          </div>
          <Button
            className="w-full"
            variant="secondary"
            disabled={
              updatePassword.isPending ||
              password.length < 8 ||
              password !== passwordConfirm
            }
            onClick={() => updatePassword.mutate()}
          >
            <KeyRound className="mr-1.5 h-4 w-4" />
            {updatePassword.isPending ? "Enregistrement…" : "Changer le mot de passe"}
          </Button>
        </div>
      </div>

      <p className="mt-3 text-[11px] text-muted-foreground">
        Astuce : pour aider un enseignant à récupérer son compte, utilisez le
        bouton « Envoyer un lien de réinitialisation » sur sa fiche dans
        <em> Gérer les utilisateurs</em>.
      </p>
    </section>
  );
}

// Silencier les imports inutilisés selon le linter (les icônes sont utilisées ci-dessus).
export const _keep = { AppSettings } as unknown as { AppSettings?: AppSettings };
