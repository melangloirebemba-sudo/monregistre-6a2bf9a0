import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BookMarked } from "lucide-react";
import { PasswordCriteria, PASSWORD_MIN_LENGTH, isPasswordValid } from "@/components/app/password-criteria";

const searchSchema = z.object({
  next: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Connexion — MonRegistre" },
      {
        name: "description",
        content: "Connectez-vous à MonRegistre pour gérer vos classes, notes et emplois du temps.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const target = safeNext(next);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: target, replace: true });
    });
  }, [navigate, target]);

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
            Connectez-vous ou créez votre compte enseignant.
          </p>

          <Tabs defaultValue="signin" className="mt-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Connexion</TabsTrigger>
              <TabsTrigger value="signup">Créer un compte</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-4">
              <SignInForm onDone={() => navigate({ to: target, replace: true })} />
            </TabsContent>
            <TabsContent value="signup" className="mt-4">
              <SignUpForm onDone={() => navigate({ to: target, replace: true })} />
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

function safeNext(next: string | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/accueil";
  return next;
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
      toast.error(error.message);
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
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const emailRedirectTo =
      typeof window !== "undefined" ? window.location.origin : undefined;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: { nom_affiche: nom },
      },
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
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
