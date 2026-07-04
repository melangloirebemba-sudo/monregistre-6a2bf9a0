import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
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
  AlertCircle,
  History,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { DataPagination, usePagination } from "@/components/ui/data-pagination";
import { adminApi } from "@/lib/admin-api";
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

/* ------------------------------ Helpers ------------------------------ */

function humanizeAuthError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("email address") && m.includes("invalid")) return "Adresse e-mail invalide.";
  if (m.includes("already registered") || m.includes("already been registered") || m.includes("already exists"))
    return "Cette adresse e-mail est déjà utilisée par un autre compte.";
  if (m.includes("same as") || m.includes("should be different"))
    return "Le nouveau mot de passe doit être différent de l'ancien.";
  if (m.includes("weak") || m.includes("pwned") || m.includes("compromised") || m.includes("breach"))
    return "Ce mot de passe est trop faible ou compromis. Choisissez-en un autre.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Trop de tentatives. Veuillez patienter quelques minutes.";
  if (m.includes("network") || m.includes("failed to fetch"))
    return "Connexion interrompue. Vérifiez votre réseau et réessayez.";
  if (m.includes("password should be at least"))
    return "Mot de passe trop court (8 caractères minimum).";
  return msg || "Une erreur est survenue. Réessayez.";
}

function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return (
    <p className="mt-1 flex items-start gap-1 text-[11.5px] text-destructive">
      <AlertCircle className="mt-[1px] h-3 w-3 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/* ------------------------------ Page ------------------------------ */

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
      <PasswordChangesLogCard />
    </div>
  );
}

/* --------------------- Journal des changements MDP --------------------- */

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function sourceLabel(src: string): { label: string; tone: string } {
  switch (src) {
    case "self":
      return { label: "Auto-modification", tone: "bg-teal/15 text-teal" };
    case "admin-reset":
      return { label: "Réinit. par admin", tone: "bg-gold/20 text-gold" };
    case "reset":
      return { label: "Lien e-mail", tone: "bg-muted text-muted-foreground" };
    default:
      return { label: src, tone: "bg-muted text-muted-foreground" };
  }
}

type PeriodKey = "all" | "24h" | "7d" | "30d" | "90d";
type InitiatorKey = "all" | "self" | "other";
type SourceKey = "all" | "self" | "admin-reset" | "reset";

const PERIOD_MS: Record<Exclude<PeriodKey, "all">, number> = {
  "24h": 24 * 3600 * 1000,
  "7d": 7 * 24 * 3600 * 1000,
  "30d": 30 * 24 * 3600 * 1000,
  "90d": 90 * 24 * 3600 * 1000,
};

function PasswordChangesLogCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-password-changes"],
    queryFn: () => adminApi.passwordChangesList(200),
    staleTime: 15_000,
  });

  const [period, setPeriod] = useState<PeriodKey>("all");
  const [initiator, setInitiator] = useState<InitiatorKey>("all");
  const [source, setSource] = useState<SourceKey>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    if (!data) return [];
    const now = Date.now();
    const q = query.trim().toLowerCase();
    return data.filter((e) => {
      if (period !== "all") {
        const cutoff = now - PERIOD_MS[period];
        if (new Date(e.created_at).getTime() < cutoff) return false;
      }
      if (source !== "all" && e.source !== source) return false;
      if (initiator !== "all") {
        const isSelf = !!(e.changed_by && e.user_id && e.changed_by === e.user_id);
        if (initiator === "self" && !isSelf) return false;
        if (initiator === "other" && isSelf) return false;
      }
      if (q) {
        const hay =
          `${e.user_email ?? ""} ${e.changed_by_email ?? ""} ${e.source}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, period, initiator, source, query]);

  const hasFilters =
    period !== "all" || initiator !== "all" || source !== "all" || query.trim().length > 0;

  const resetFilters = () => {
    setPeriod("all");
    setInitiator("all");
    setSource("all");
    setQuery("");
  };

  return (
    <section className="card-elevated p-4 sm:p-5">
      <div className="flex items-center gap-2">
        <History className="h-5 w-5 text-teal" />
        <h2 className="font-display text-base font-semibold text-foreground">
          Journal des changements de mot de passe
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Historique des modifications de mot de passe des comptes administrateurs.
      </p>

      {/* Filters */}
      <div className="mt-4 space-y-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher par e-mail…"
            className="pl-8 pr-8"
            aria-label="Rechercher dans le journal"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Effacer la recherche"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">
              Période
            </Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les périodes</SelectItem>
                <SelectItem value="24h">Dernières 24 heures</SelectItem>
                <SelectItem value="7d">7 derniers jours</SelectItem>
                <SelectItem value="30d">30 derniers jours</SelectItem>
                <SelectItem value="90d">90 derniers jours</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">
              Initiateur
            </Label>
            <Select
              value={initiator}
              onValueChange={(v) => setInitiator(v as InitiatorKey)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="self">Par le compte lui-même</SelectItem>
                <SelectItem value="other">Par un autre admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-[11px] text-muted-foreground">
              Source
            </Label>
            <Select value={source} onValueChange={(v) => setSource(v as SourceKey)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes les sources</SelectItem>
                <SelectItem value="self">Auto-modification</SelectItem>
                <SelectItem value="admin-reset">Réinit. par admin</SelectItem>
                <SelectItem value="reset">Lien e-mail</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center justify-end pt-1 text-[11.5px] text-muted-foreground">
          {hasFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-md px-2 py-1 text-teal hover:bg-teal/10"
            >
              Réinitialiser les filtres
            </button>
          )}
        </div>
      </div>

      {isLoading && (
        <p className="mt-4 text-sm text-muted-foreground">Chargement…</p>
      )}
      {error && (
        <p className="mt-4 text-sm text-destructive">
          Erreur : {(error as Error).message}
        </p>
      )}

      {data && data.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-border/60 bg-cream-deep/20 p-4 text-center text-sm text-muted-foreground">
          Aucun changement de mot de passe enregistré pour l'instant.
        </p>
      )}

      {data && data.length > 0 && filtered.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-border/60 bg-cream-deep/20 p-4 text-center text-sm text-muted-foreground">
          Aucune entrée ne correspond aux filtres.
        </p>
      )}

      {filtered.length > 0 && (
        <>
          <PaginatedLog entries={filtered} totalCount={data?.length ?? 0} />
        </>
      )}
    </section>
  );
}

function PaginatedLog({
  entries,
  totalCount,
}: {
  entries: Array<{
    id: string;
    user_id: string | null;
    user_email: string | null;
    changed_by: string | null;
    changed_by_email: string | null;
    source: string;
    created_at: string;
  }>;
  totalCount: number;
}) {
  const pg = usePagination(entries.length);
  const paged = pg.slice(entries);
  return (
    <>
      <ul className="mt-4 divide-y divide-border/60 rounded-xl border border-border/60 bg-cream-deep/10">
        {paged.map((entry) => {
          const s = sourceLabel(entry.source);
          const isSelf =
            entry.changed_by && entry.user_id && entry.changed_by === entry.user_id;
          return (
            <li
              key={entry.id}
              className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  {entry.user_email ?? "(compte supprimé)"}
                </div>
                <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                  {isSelf ? (
                    <>Par lui-même</>
                  ) : (
                    <>
                      Par{" "}
                      <span className="text-foreground/80">
                        {entry.changed_by_email ?? "admin"}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 sm:flex-col sm:items-end sm:gap-0.5">
                <span
                  className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10.5px] font-medium ${s.tone}`}
                >
                  {s.label}
                </span>
                <time
                  dateTime={entry.created_at}
                  className="text-[11px] text-muted-foreground"
                >
                  {formatDate(entry.created_at)}
                  </time>
                </div>
              </li>
            );
          })}
      </ul>
      <DataPagination
        page={pg.page}
        totalPages={pg.totalPages}
        pageSize={pg.pageSize}
        totalCount={totalCount}
        filteredCount={entries.length}
        start={pg.start}
        end={pg.end}
        onPageChange={pg.setPage}
        onPageSizeChange={pg.setPageSize}
        itemLabel="entrées"
      />
    </>
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

const supportSchema = z.object({
  whatsapp_number: z
    .string()
    .trim()
    .min(1, "Le numéro WhatsApp est requis.")
    .refine((v) => /^\+?[\d\s().-]+$/.test(v), "Chiffres, espaces, +, -, ( ) uniquement.")
    .refine((v) => {
      const d = v.replace(/\D/g, "");
      return d.length >= 8 && d.length <= 15;
    }, "Le numéro doit contenir entre 8 et 15 chiffres."),
  whatsapp_display: z
    .string()
    .trim()
    .min(3, "Libellé trop court (3 caractères min.).")
    .max(40, "Libellé trop long (40 caractères max.)."),
  support_email: z
    .string()
    .trim()
    .min(1, "L'e-mail de support est requis.")
    .email("Adresse e-mail invalide."),
});

type SupportErrors = Partial<Record<keyof z.infer<typeof supportSchema>, string>>;

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
  const [errors, setErrors] = useState<SupportErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!data) return;
    setWhatsappNumber(data.whatsapp_number);
    setWhatsappDisplay(data.whatsapp_display);
    setSupportEmail(data.support_email);
  }, [data]);

  const validate = (): z.infer<typeof supportSchema> | null => {
    const parsed = supportSchema.safeParse({
      whatsapp_number: whatsappNumber,
      whatsapp_display: whatsappDisplay,
      support_email: supportEmail,
    });
    if (parsed.success) {
      setErrors({});
      return parsed.data;
    }
    const errs: SupportErrors = {};
    for (const issue of parsed.error.issues) {
      const k = issue.path[0] as keyof SupportErrors;
      if (k && !errs[k]) errs[k] = issue.message;
    }
    setErrors(errs);
    return null;
  };

  // Live validation once a field has been touched.
  useEffect(() => {
    if (!Object.keys(touched).length) return;
    validate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [whatsappNumber, whatsappDisplay, supportEmail]);

  const save = useMutation({
    mutationFn: async () => {
      const clean = validate();
      if (!clean) throw new Error("Corrigez les champs en rouge avant d'enregistrer.");
      const digits = clean.whatsapp_number.replace(/\D/g, "");
      await adminApi.settingsUpdate({
        whatsapp_number: digits,
        whatsapp_display: clean.whatsapp_display,
        support_email: clean.support_email,
      });
      return { digits, display: clean.whatsapp_display, email: clean.support_email };
    },
    onSuccess: (r) => {
      updateSupportConfig({
        whatsappNumber: r.digits,
        whatsappDisplay: r.display,
        supportEmail: r.email,
      });
      toast.success("Coordonnées du support enregistrées");
      qc.invalidateQueries({ queryKey: ["admin-settings"] });
    },
    onError: (e: Error) => toast.error(humanizeAuthError(e.message)),
  });

  const dirty =
    !!data &&
    (whatsappNumber !== data.whatsapp_number ||
      whatsappDisplay !== data.whatsapp_display ||
      supportEmail !== data.support_email);

  const hasErrors = Object.keys(errors).length > 0;

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
          <div className="space-y-1">
            <Label htmlFor="wa-number">Numéro WhatsApp (format international)</Label>
            <Input
              id="wa-number"
              inputMode="tel"
              placeholder="242069626540"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              onBlur={() => {
                setTouched((t) => ({ ...t, whatsapp_number: true }));
                validate();
              }}
              aria-invalid={!!errors.whatsapp_number}
              className={errors.whatsapp_number ? "border-destructive focus-visible:ring-destructive/40" : ""}
            />
            <p className="text-[11px] text-muted-foreground">
              Sans « + », sans espaces. Ex : 242069626540
            </p>
            <FieldError>{errors.whatsapp_number}</FieldError>
          </div>
          <div className="space-y-1">
            <Label htmlFor="wa-display">Libellé affiché</Label>
            <Input
              id="wa-display"
              placeholder="+242 06 962 65 40"
              value={whatsappDisplay}
              onChange={(e) => setWhatsappDisplay(e.target.value)}
              onBlur={() => {
                setTouched((t) => ({ ...t, whatsapp_display: true }));
                validate();
              }}
              aria-invalid={!!errors.whatsapp_display}
              className={errors.whatsapp_display ? "border-destructive focus-visible:ring-destructive/40" : ""}
            />
            <FieldError>{errors.whatsapp_display}</FieldError>
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="support-email" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5" /> E-mail du support
            </Label>
            <Input
              id="support-email"
              type="email"
              autoComplete="email"
              placeholder="support@monregistre.app"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              onBlur={() => {
                setTouched((t) => ({ ...t, support_email: true }));
                validate();
              }}
              aria-invalid={!!errors.support_email}
              className={errors.support_email ? "border-destructive focus-visible:ring-destructive/40" : ""}
            />
            <FieldError>{errors.support_email}</FieldError>
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              disabled={!dirty || save.isPending || hasErrors}
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

/** Password policy: rules + strength score 0..4 aligned with server side (8 char min).
 *  Supabase HIBP gives the definitive rejection on submit. */
type PasswordRule = { key: string; label: string; ok: boolean };
type PasswordAnalysis = {
  rules: PasswordRule[];
  requiredOk: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  label: string;
  color: string;
  hint?: string;
};

const COMMON_PASSWORDS = new Set([
  "password", "motdepasse", "azerty", "azerty123", "qwerty", "qwerty123",
  "12345678", "123456789", "1234567890", "abcdef", "abcdefgh",
  "admin", "admin123", "administrator", "welcome", "iloveyou", "monregistre",
]);

function analyzePassword(pwd: string): PasswordAnalysis {
  const hasLen = pwd.length >= 8;
  const hasLower = /[a-z]/.test(pwd);
  const hasUpper = /[A-Z]/.test(pwd);
  const hasDigit = /\d/.test(pwd);
  const hasSymbol = /[^A-Za-z0-9]/.test(pwd);
  const hasNoSpace = pwd.length === 0 || !/^\s|\s$/.test(pwd);
  const classes = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;

  const rules: PasswordRule[] = [
    { key: "len", label: "Au moins 8 caractères", ok: hasLen },
    { key: "case", label: "Minuscule et majuscule", ok: hasLower && hasUpper },
    { key: "digit", label: "Au moins un chiffre", ok: hasDigit },
    { key: "sym", label: "Au moins un symbole (!?@#…)", ok: hasSymbol },
    { key: "space", label: "Sans espace en début ou fin", ok: hasNoSpace },
  ];

  // Baseline "acceptable" = length + at least 2 classes + no leading/trailing space.
  const requiredOk = hasLen && classes >= 2 && hasNoSpace;

  // Strength score
  let raw = 0;
  if (hasLen) raw++;
  if (pwd.length >= 12) raw++;
  if (pwd.length >= 16) raw++;
  raw += Math.max(0, classes - 1); // up to +3
  if (COMMON_PASSWORDS.has(pwd.toLowerCase())) raw = 0;
  if (/^(.)\1+$/.test(pwd)) raw = Math.min(raw, 1); // "aaaaaaa"
  if (/^(0123|1234|2345|3456|4567|5678|6789|abcd|qwer|azer)/i.test(pwd))
    raw = Math.min(raw, 1);

  const score = (Math.max(0, Math.min(4, raw)) as 0 | 1 | 2 | 3 | 4);
  const labels = ["Très faible", "Faible", "Moyen", "Bon", "Excellent"];
  const colors = [
    "bg-destructive",
    "bg-destructive/80",
    "bg-gold",
    "bg-teal/80",
    "bg-teal",
  ];

  let hint: string | undefined;
  if (!hasLen) hint = "8 caractères minimum.";
  else if (classes < 2) hint = "Mélangez lettres, chiffres et/ou symboles.";
  else if (!hasNoSpace) hint = "Retirez les espaces en début ou fin.";
  else if (COMMON_PASSWORDS.has(pwd.toLowerCase())) hint = "Mot de passe trop courant.";

  return { rules, requiredOk, score, label: labels[score], color: colors[score], hint };
}

function PasswordStrengthMeter({ analysis, empty }: { analysis: PasswordAnalysis; empty: boolean }) {
  const filled = empty ? 0 : analysis.score + 1;
  return (
    <div className="space-y-2" aria-live="polite">
      <div className="flex items-center gap-1.5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < filled ? analysis.color : "bg-border/60"
            }`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Robustesse</span>
        <span
          className={`font-medium ${
            empty
              ? "text-muted-foreground"
              : analysis.score <= 1
              ? "text-destructive"
              : analysis.score === 2
              ? "text-gold"
              : "text-teal"
          }`}
        >
          {empty ? "—" : analysis.label}
        </span>
      </div>
    </div>
  );
}

function PasswordRulesList({ rules }: { rules: PasswordRule[] }) {
  return (
    <ul className="mt-1 grid gap-1 text-[11.5px]">
      {rules.map((r) => (
        <li
          key={r.key}
          className={`flex items-center gap-1.5 ${
            r.ok ? "text-teal" : "text-muted-foreground"
          }`}
        >
          <span
            aria-hidden
            className={`inline-flex h-3.5 w-3.5 items-center justify-center rounded-full text-[10px] font-bold ${
              r.ok
                ? "bg-teal/15 text-teal"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {r.ok ? "✓" : "•"}
          </span>
          {r.label}
        </li>
      ))}
    </ul>
  );
}

function AdminAccountCard() {
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailError, setEmailError] = useState<string>("");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [pwdErrors, setPwdErrors] = useState<{ pwd?: string; confirm?: string }>({});

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentEmail(data.user?.email ?? "");
      setNewEmail(data.user?.email ?? "");
    });
  }, []);

  // Live-check email
  const validateEmail = (v: string): string => {
    const t = v.trim();
    if (!t) return "L'adresse e-mail est requise.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return "Adresse e-mail invalide.";
    if (t.toLowerCase() === currentEmail.toLowerCase())
      return "Cette adresse est identique à l'actuelle.";
    return "";
  };

  const pwdAnalysis = useMemo(() => analyzePassword(password), [password]);

  const validatePassword = (): boolean => {
    const errs: { pwd?: string; confirm?: string } = {};
    if (!pwdAnalysis.requiredOk) errs.pwd = pwdAnalysis.hint ?? "Mot de passe trop faible.";
    if (!passwordConfirm) errs.confirm = "Confirmez le mot de passe.";
    else if (passwordConfirm !== password) errs.confirm = "Les mots de passe ne correspondent pas.";
    setPwdErrors(errs);
    return !errs.pwd && !errs.confirm;
  };

  // Live re-validate as the user types
  useEffect(() => {
    if (password || passwordConfirm) validatePassword();
    else setPwdErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [password, passwordConfirm]);

  const updateEmail = useMutation({
    mutationFn: async () => {
      const err = validateEmail(newEmail);
      if (err) {
        setEmailError(err);
        throw new Error(err);
      }
      const { error } = await supabase.auth.updateUser({ email: newEmail.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      setEmailError("");
      toast.success(
        "E-mail mis à jour. Un lien de confirmation a été envoyé aux deux adresses.",
      );
    },
    onError: (e: Error) => {
      const msg = humanizeAuthError(e.message);
      setEmailError(msg);
      toast.error(msg);
    },
  });

  const qc = useQueryClient();
  const updatePassword = useMutation({
    mutationFn: async () => {
      if (!validatePassword()) throw new Error("Corrigez les champs en rouge.");
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      // Journalise en base (best-effort, ne bloque pas le succès UI).
      try {
        await adminApi.passwordChangesLog({ source: "self" });
      } catch (logErr) {
        console.warn("[admin] password change log failed", logErr);
      }
    },
    onSuccess: () => {
      toast.success("Mot de passe administrateur mis à jour");
      setPassword("");
      setPasswordConfirm("");
      setPwdErrors({});
      qc.invalidateQueries({ queryKey: ["admin-password-changes"] });
    },
    onError: (e: Error) => {
      const msg = humanizeAuthError(e.message);
      setPwdErrors((p) => ({ ...p, pwd: msg }));
      toast.error(msg);
    },
  });

  const emailDisabled =
    updateEmail.isPending ||
    !newEmail.trim() ||
    newEmail.trim().toLowerCase() === currentEmail.toLowerCase() ||
    !!validateEmail(newEmail);

  const pwdCanSubmit = useMemo(
    () =>
      !updatePassword.isPending &&
      password.length >= 8 &&
      passwordConfirm === password &&
      !pwdErrors.pwd &&
      !pwdErrors.confirm,
    [updatePassword.isPending, password, passwordConfirm, pwdErrors],
  );

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
          <div className="space-y-1">
            <Label htmlFor="admin-email" className="text-xs">
              Nouvelle adresse (actuelle : {currentEmail || "…"})
            </Label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="email"
              value={newEmail}
              onChange={(e) => {
                setNewEmail(e.target.value);
                setEmailError(validateEmail(e.target.value));
              }}
              onBlur={() => setEmailError(validateEmail(newEmail))}
              aria-invalid={!!emailError}
              className={emailError ? "border-destructive focus-visible:ring-destructive/40" : ""}
            />
            <FieldError>{emailError}</FieldError>
          </div>
          <Button
            className="w-full"
            variant="secondary"
            disabled={emailDisabled}
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
          <div className="space-y-1">
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
              aria-invalid={!!pwdErrors.pwd}
              className={pwdErrors.pwd ? "border-destructive focus-visible:ring-destructive/40" : ""}
            />
            <FieldError>{pwdErrors.pwd}</FieldError>
            <div className="pt-1">
              <PasswordStrengthMeter analysis={pwdAnalysis} empty={password.length === 0} />
            </div>
            <PasswordRulesList rules={pwdAnalysis.rules} />
          </div>
          <div className="space-y-1">
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
              aria-invalid={!!pwdErrors.confirm}
              className={pwdErrors.confirm ? "border-destructive focus-visible:ring-destructive/40" : ""}
            />
            <FieldError>{pwdErrors.confirm}</FieldError>
          </div>
          <Button
            className="w-full"
            variant="secondary"
            disabled={!pwdCanSubmit}
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
