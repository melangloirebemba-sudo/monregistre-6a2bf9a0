import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Phone, Lock, CheckCircle2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { useServerFn } from "@tanstack/react-start";
import {
  requestPasswordResetOtp,
  resetPasswordWithOtp,
} from "@/lib/otp.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OtpCodeInput } from "@/components/app/otp-code-input";
import {
  PasswordCriteria,
  PASSWORD_MIN_LENGTH,
  isPasswordValid,
} from "@/components/app/password-criteria";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Réinitialiser le mot de passe — MonRegistre" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPasswordPage,
});

type Step = "phone" | "verify";

function ResetPasswordPage() {
  const navigate = useNavigate();
  const requestOtp = useServerFn(requestPasswordResetOtp);
  const resetPwd = useServerFn(resetPasswordWithOtp);

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  // If a user reached this page from an old email link with a session, log out first.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) supabase.auth.signOut().catch(() => {});
    });
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function sendCode() {
    if (!/^\+?[\d\s().-]{6,20}$/.test(phone.trim())) {
      toast.error("Numéro invalide");
      return;
    }
    setLoading(true);
    try {
      await requestOtp({ data: { phone: phone.trim() } });
      toast.success("Si ce numéro existe, un code vient d'être envoyé par SMS.");
      setStep("verify");
      setCooldown(60);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur d'envoi");
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent) {
    e.preventDefault();
    if (code.length !== 6) return toast.error("Code à 6 chiffres requis");
    if (!isPasswordValid(pwd)) {
      return toast.error(`Mot de passe trop court (${PASSWORD_MIN_LENGTH} caractères min.)`);
    }
    if (pwd !== pwd2) return toast.error("Les mots de passe ne correspondent pas");
    setLoading(true);
    try {
      await resetPwd({ data: { phone: phone.trim(), code, newPassword: pwd } });
      setDone(true);
      toast.success("Mot de passe mis à jour. Vous pouvez vous connecter.");
      setTimeout(() => navigate({ to: "/auth" }), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Code invalide");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="card-elevated w-full max-w-sm space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-teal" />
          <h1 className="font-display text-lg font-semibold text-foreground">
            Mot de passe oublié
          </h1>
        </div>

        {done ? (
          <div className="flex items-center gap-2 rounded-lg bg-teal/10 p-3 text-sm text-teal">
            <CheckCircle2 className="h-4 w-4" />
            Mot de passe mis à jour, redirection…
          </div>
        ) : step === "phone" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendCode();
            }}
            className="space-y-3"
          >
            <p className="text-sm text-muted-foreground">
              Entrez le numéro de téléphone associé à votre compte. Nous vous enverrons un
              code à 6 chiffres par SMS.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="phone">Numéro de téléphone</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+242 06 000 00 00"
                  className="pl-9"
                />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Envoi…" : "Envoyer le code"}
            </Button>
            <Link
              to="/auth"
              className="mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              Retour à la connexion
            </Link>
          </form>
        ) : (
          <form onSubmit={submitReset} className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Un code a été envoyé au <span className="font-medium text-foreground">{phone}</span>.
              Entrez-le ci-dessous et choisissez un nouveau mot de passe.
            </p>
            <OtpCodeInput value={code} onChange={setCode} />
            <div className="space-y-1.5">
              <Label htmlFor="pwd">Nouveau mot de passe</Label>
              <Input
                id="pwd"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                required
                value={pwd}
                onChange={(e) => setPwd(e.target.value)}
              />
              <PasswordCriteria value={pwd} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pwd2">Confirmer</Label>
              <Input
                id="pwd2"
                type="password"
                autoComplete="new-password"
                minLength={PASSWORD_MIN_LENGTH}
                required
                value={pwd2}
                onChange={(e) => setPwd2(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Vérification…" : "Réinitialiser"}
            </Button>
            <div className="flex items-center justify-between text-xs">
              <button
                type="button"
                onClick={() => {
                  setStep("phone");
                  setCode("");
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                Changer de numéro
              </button>
              <button
                type="button"
                onClick={sendCode}
                disabled={cooldown > 0 || loading}
                className="text-teal disabled:cursor-not-allowed disabled:text-muted-foreground"
              >
                {cooldown > 0 ? `Renvoyer (${cooldown}s)` : "Renvoyer le code"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
