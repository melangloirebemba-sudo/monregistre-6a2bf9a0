import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { toFrench } from "@/lib/errors";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookMarked, Sparkles, PlayCircle } from "lucide-react";
import { PasswordCriteria, PASSWORD_MIN_LENGTH, isPasswordValid } from "@/components/app/password-criteria";
import { resolveLandingPath } from "@/lib/auth-landing";
import { startDemo, isDemoMode } from "@/lib/demo";

const searchSchema = z.object({
  next: z.string().optional(),
  tab: z.enum(["signin", "signup"]).optional(),
  from: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Connexion — MonRegistre" },
      {
        name: "description",
        content: "Connectez-vous à MonRegistre ou essayez la démo interactive.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next, tab, from } = Route.useSearch();
  const [demoLoading, setDemoLoading] = useState(false);

  const goToLanding = async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    // En mode démo, on file directement sur l'accueil sans passer par
    // le résolveur de landing (l'utilisateur anonyme n'est ni admin ni enseignant établi).
    if (isDemoMode()) {
      navigate({ to: "/accueil", replace: true });
      return;
    }
    const target = await resolveLandingPath(data.user.id, next);
    navigate({ to: target, replace: true });
  };

  useEffect(() => {
    void goToLanding();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next]);

  const handleStartDemo = async () => {
    setDemoLoading(true);
    try {
      await startDemo();
      toast.success("Bienvenue dans la démo !");
      navigate({ to: "/accueil", replace: true });
    } catch (e) {
      toast.error(toFrench(e));
    } finally {
      setDemoLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full hero-gradient">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-full bg-gold text-gold-foreground shadow-soft">
            <BookMarked className="h-5 w-5" />
          </div>
          <div>
            <div className="font-display text-2xl font-semibold text-ink-foreground">
              MonRegistre
            </div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-ink-foreground/70">
              Registre de l'enseignant
            </div>
          </div>
        </div>

        <div className="card-elevated p-6">
          <h1 className="font-display text-2xl text-foreground">Bienvenue</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connectez-vous, créez votre compte, ou essayez la démo interactive.
          </p>

          {from === "demo" && (
            <div className="mt-4 rounded-lg border border-gold/40 bg-gold/10 p-3 text-sm text-foreground">
              <div className="flex items-start gap-2">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
                <div>
                  <p className="font-semibold">Prêt à passer à la vraie chose ?</p>
                  <p className="mt-0.5 text-muted-foreground">
                    Créez votre compte enseignant pour conserver vos données et débloquer toutes
                    les fonctionnalités.
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            type="button"
            variant="outline"
            className="mt-4 w-full"
            onClick={handleStartDemo}
            disabled={demoLoading}
          >
            <Sparkles className="mr-2 h-4 w-4" />
            {demoLoading ? "Préparation de la démo…" : "Essayer la démo"}
          </Button>

          <div className="my-4 flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            <span>ou</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Tabs defaultValue={tab === "signup" ? "signup" : "signin"} className="mt-2">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Créer un compte</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              <SignInForm onDone={goToLanding} />
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <SignUpForm onDone={goToLanding} />
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-6 text-center text-xs text-ink-foreground/60">
          En continuant, vous acceptez d'utiliser MonRegistre pour organiser vos données pédagogiques.
        </p>
      </div>
    </div>
  );
}


function SignInForm({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(toFrench(error));
      return;
    }
    toast.success("Bienvenue !");
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="si-email">Email</Label>
        <Input
          id="si-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="si-password">Mot de passe</Label>
        <Input
          id="si-password"
          type="password"
          autoComplete="current-password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <Button type="submit" disabled={loading} className="w-full">
        {loading ? "Connexion…" : "Se connecter"}
      </Button>
    </form>
  );
}


function SignUpForm({ onDone }: { onDone: () => void }) {
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
    const emailRedirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { nom_affiche: nom, telephone: tel || null },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(toFrench(error));
      return;
    }
    if (!data.session) {
      toast.success("Compte créé. Vérifiez votre email pour confirmer.");
      return;
    }
    toast.success("Compte créé — bienvenue !");
    onDone();
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="su-nom">Nom affiché</Label>
        <Input
          id="su-nom"
          type="text"
          required
          value={nom}
          onChange={(e) => setNom(e.target.value)}
          placeholder="Emmanuel Mendy"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email">Email</Label>
        <Input
          id="su-email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-tel">Numéro WhatsApp</Label>
        <Input
          id="su-tel"
          type="tel"
          autoComplete="tel"
          required
          value={telephone}
          onChange={(e) => setTelephone(e.target.value)}
          placeholder="+242 06 000 00 00"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-password">Mot de passe</Label>
        <Input
          id="su-password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordCriteria value={password} />
      </div>
      <Button type="submit" disabled={loading || !isPasswordValid(password)} className="w-full">
        {loading ? "Création…" : "Créer mon compte"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Déjà un compte ?{" "}
        <Link to="/auth" className="text-teal underline-offset-2 hover:underline">
          Connectez-vous
        </Link>
      </p>
    </form>
  );
}
