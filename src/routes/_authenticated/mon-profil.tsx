import { createFileRoute } from "@tanstack/react-router";
import { toFrench } from "@/lib/errors";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { UserCircle2, KeyRound } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { profilQueryOptions } from "@/lib/queries/profil";
import { requireUserId } from "@/lib/queries/data";
import { supabase } from "@/integrations/supabase/client";
import {
  requestPhoneVerificationOtp,
  confirmPhoneVerification,
  requestPhoneChangeOtp,
  confirmPhoneChange,
} from "@/lib/otp.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpCodeInput } from "@/components/app/otp-code-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { PasswordCriteria, PASSWORD_MIN_LENGTH, isPasswordValid } from "@/components/app/password-criteria";
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

  // Phone verification / change dialogs
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);

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

  const currentPhone = profil?.telephone ?? "";
  // const isVerified = !!profil?.telephone_verifie;
  const phoneChanged = telephone.trim() !== (currentPhone ?? "").trim();

  const save = useMutation({
    mutationFn: async () => {
      const uid = await requireUserId();
      const nomAffiche = `${prenom.trim()} ${nomFamille.trim()}`.trim() || profil?.nom_affiche || "Enseignant";
      const inits =
        initiales.trim().slice(0, 2).toUpperCase() ||
        `${prenom.trim().charAt(0)}${nomFamille.trim().charAt(0)}`.toUpperCase() ||
        "EM";
      // Do NOT include telephone in this patch — phone changes go through OTP flow.
      const patch = {
        prenom: prenom.trim() || null,
        nom_famille: nomFamille.trim() || null,
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
    onError: (e: Error) => toast.error(toFrench(e)),
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
            {matiere ? `Enseignant de : ${matiere}` : "Enseignant"}
            {etablissement ? ` • ${etablissement}` : ""}
          </div>
          {currentPhone && (
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <span className="text-muted-foreground">{currentPhone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Phone verification hidden — system not deployed yet */}

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
            <div className="flex gap-2">
              <Input
                id="tel"
                type="tel"
                value={telephone}
                onChange={(e) => setTelephone(e.target.value)}
                placeholder="+242 06 000 00 00"
              />
            </div>
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

      <ChangePasswordCard />

      {/* Phone verification dialogs hidden — system not deployed yet */}
    </div>
  );
}

function VerifyPhoneDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const req = useServerFn(requestPhoneVerificationOtp);
  const confirm = useServerFn(confirmPhoneVerification);
  const [step, setStep] = useState<"idle" | "sent">("idle");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep("idle");
      setCode("");
      setCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function send() {
    setLoading(true);
    try {
      await req();
      toast.success("Code envoyé par SMS");
      setStep("sent");
      setCooldown(60);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (code.length !== 6) return toast.error("Code à 6 chiffres requis");
    setLoading(true);
    try {
      await confirm({ data: { code } });
      toast.success("Numéro vérifié");
      qc.invalidateQueries({ queryKey: ["profil"] });
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vérifier mon numéro</DialogTitle>
          <DialogDescription>
            Nous envoyons un code à 6 chiffres au numéro enregistré dans votre profil.
          </DialogDescription>
        </DialogHeader>

        {step === "idle" ? (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Cliquez ci-dessous pour recevoir le code par SMS. La demande peut être renouvelée
              après 60 secondes.
            </p>
            <Button onClick={send} disabled={loading} className="w-full">
              {loading ? "Envoi…" : "Envoyer le code SMS"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <OtpCodeInput value={code} onChange={setCode} />
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={send}
                disabled={cooldown > 0 || loading}
                className="text-teal disabled:cursor-not-allowed disabled:text-muted-foreground"
              >
                {cooldown > 0 ? `Renvoyer (${cooldown}s)` : "Renvoyer le code"}
              </button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Annuler
              </Button>
              <Button onClick={submit} disabled={loading || code.length !== 6}>
                {loading ? "Vérification…" : "Confirmer"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChangePhoneDialog({
  open,
  onOpenChange,
  newPhone,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  newPhone: string;
  onSuccess: () => void;
}) {
  const req = useServerFn(requestPhoneChangeOtp);
  const confirm = useServerFn(confirmPhoneChange);
  const [step, setStep] = useState<"idle" | "sent">("idle");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (!open) {
      setStep("idle");
      setCode("");
      setCooldown(0);
    }
  }, [open]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function send() {
    setLoading(true);
    try {
      await req({ data: { newPhone } });
      toast.success("Code envoyé au nouveau numéro");
      setStep("sent");
      setCooldown(60);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur");
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    if (code.length !== 6) return toast.error("Code à 6 chiffres requis");
    setLoading(true);
    try {
      await confirm({ data: { newPhone, code } });
      toast.success("Numéro mis à jour et vérifié");
      onSuccess();
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vérifier le nouveau numéro</DialogTitle>
          <DialogDescription>
            Un code sera envoyé à <span className="font-medium">{newPhone}</span>. Le numéro
            ne sera enregistré qu'après confirmation.
          </DialogDescription>
        </DialogHeader>

        {step === "idle" ? (
          <div className="space-y-3">
            <Button onClick={send} disabled={loading} className="w-full">
              {loading ? "Envoi…" : "Envoyer le code SMS"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <OtpCodeInput value={code} onChange={setCode} />
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={send}
                disabled={cooldown > 0 || loading}
                className="text-teal disabled:cursor-not-allowed disabled:text-muted-foreground"
              >
                {cooldown > 0 ? `Renvoyer (${cooldown}s)` : "Renvoyer le code"}
              </button>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Annuler
              </Button>
              <Button onClick={submit} disabled={loading || code.length !== 6}>
                {loading ? "Vérification…" : "Confirmer et enregistrer"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordCard() {
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isPasswordValid(pwd)) {
      toast.error(`Mot de passe trop court (${PASSWORD_MIN_LENGTH} caractères min.)`);
      return;
    }
    if (pwd !== pwd2) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: pwd });
    setLoading(false);
    if (error) {
      toast.error(toFrench(error));
      return;
    }
    setPwd("");
    setPwd2("");
    toast.success("Mot de passe mis à jour");
  }

  return (
    <form onSubmit={onSubmit} className="card-elevated space-y-4 p-5 mt-4">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <KeyRound className="h-4 w-4" />
        Changer mon mot de passe
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pwd">Nouveau mot de passe</Label>
        <Input
          id="new-pwd"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={pwd}
          onChange={(e) => setPwd(e.target.value)}
          required
        />
        <PasswordCriteria value={pwd} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="new-pwd2">Confirmer le nouveau mot de passe</Label>
        <Input
          id="new-pwd2"
          type="password"
          autoComplete="new-password"
          minLength={PASSWORD_MIN_LENGTH}
          value={pwd2}
          onChange={(e) => setPwd2(e.target.value)}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={loading || !isPasswordValid(pwd) || pwd !== pwd2}
        className="w-full"
      >
        {loading ? "Enregistrement…" : "Mettre à jour le mot de passe"}
      </Button>
    </form>
  );
}
