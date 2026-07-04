import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Crown, School, GraduationCap, Users, FileText, BookOpen, Save, Infinity as InfinityIcon } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type PlanLimit } from "@/lib/admin-api";
import { PLAN_LABELS, type AppPlan } from "@/lib/queries/admin";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/admin/plans")({
  head: () => ({ meta: [{ title: "Plans & limites — Console admin" }, { name: "robots", content: "noindex" }] }),
  component: PlansPage,
});

const UNLIMITED = 2147483647;

const PLAN_TONE: Record<AppPlan, string> = {
  gratuit: "border-muted",
  lite: "border-gold/50",
  premium: "border-teal/60",
};
const PLAN_BADGE: Record<AppPlan, string> = {
  gratuit: "bg-muted text-muted-foreground",
  lite: "bg-gold/25 text-ink",
  premium: "bg-teal text-cream",
};

function PlansPage() {
  const qc = useQueryClient();
  const { data: plans = [], isLoading, error } = useQuery({
    queryKey: ["admin-plan-limits"],
    queryFn: () => adminApi.plansList(),
    staleTime: 15_000,
  });

  return (
    <div className="space-y-5 px-4 py-5 sm:px-5 sm:py-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Backoffice</div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">
          <Crown className="h-6 w-6 shrink-0 text-gold sm:h-7 sm:w-7" />
          <span className="truncate">Plans & limites</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configurez les limites de chaque plan. Les changements s'appliquent immédiatement côté serveur.
        </p>
      </header>

      {isLoading && <div className="card-elevated p-6 text-sm text-muted-foreground">Chargement…</div>}
      {error && <div className="card-elevated p-6 text-sm text-destructive">Erreur : {(error as Error).message}</div>}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(["gratuit", "lite", "premium"] as AppPlan[]).map((p) => {
          const row = plans.find((x) => x.plan === p);
          if (!row) return null;
          return <PlanCard key={p} row={row} onSaved={() => qc.invalidateQueries({ queryKey: ["admin-plan-limits"] })} />;
        })}
      </div>

      <div className="card-elevated p-4 text-sm text-muted-foreground">
        <p>
          <strong className="text-foreground">Astuce :</strong> pour « illimité », laissez le champ vide ou entrez 0.
          Les limites sont vérifiées par des déclencheurs Postgres à chaque création.
        </p>
      </div>
    </div>
  );
}

function PlanCard({ row, onSaved }: { row: PlanLimit; onSaved: () => void }) {
  const [ecoles, setEcoles] = useState("");
  const [classes, setClasses] = useState("");
  const [eleves, setEleves] = useState("");
  const [bulletins, setBulletins] = useState(row.bulletins_pdf);
  const [rapports, setRapports] = useState(row.rapports);
  const [progression, setProgression] = useState(row.progression);

  useEffect(() => {
    setEcoles(row.max_ecoles >= UNLIMITED ? "" : String(row.max_ecoles));
    setClasses(row.max_classes_par_ecole >= UNLIMITED ? "" : String(row.max_classes_par_ecole));
    setEleves(row.max_eleves >= UNLIMITED ? "" : String(row.max_eleves));
    setBulletins(row.bulletins_pdf);
    setRapports(row.rapports);
    setProgression(row.progression);
  }, [row]);

  const save = useMutation({
    mutationFn: async () => {
      const toNum = (s: string) => {
        const t = s.trim();
        if (t === "" || t === "0") return UNLIMITED;
        const n = Number(t);
        if (!Number.isFinite(n) || n < 0) throw new Error("Valeur invalide");
        return Math.floor(n);
      };
      return adminApi.plansUpdate({
        plan: row.plan,
        max_ecoles: toNum(ecoles),
        max_classes_par_ecole: toNum(classes),
        max_eleves: toNum(eleves),
        bulletins_pdf: bulletins,
        rapports,
        progression,
      });
    },
    onSuccess: () => { toast.success(`Plan ${PLAN_LABELS[row.plan]} mis à jour`); onSaved(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className={`card-elevated border-2 p-5 ${PLAN_TONE[row.plan]}`}>
      <div className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${PLAN_BADGE[row.plan]}`}>
        {PLAN_LABELS[row.plan]}
      </div>

      <div className="mt-4 space-y-3">
        <NumField icon={School} label="Écoles max" value={ecoles} onChange={setEcoles} placeholder="Illimité" />
        <NumField icon={GraduationCap} label="Classes par école" value={classes} onChange={setClasses} placeholder="Illimité" />
        <NumField icon={Users} label="Élèves max" value={eleves} onChange={setEleves} placeholder="Illimité" />

        <div className="pt-2 border-t space-y-2.5">
          <ToggleRow icon={FileText} label="Bulletins PDF" checked={bulletins} onChange={setBulletins} />
          <ToggleRow icon={FileText} label="Rapports" checked={rapports} onChange={setRapports} />
          <ToggleRow icon={BookOpen} label="Progression pédagogique" checked={progression} onChange={setProgression} />
        </div>
      </div>

      <Button className="mt-4 w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        <Save className="mr-1.5 h-4 w-4" /> {save.isPending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </div>
  );
}

function NumField({ icon: Icon, label, value, onChange, placeholder }: {
  icon: typeof School; label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      <div className="relative">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
        />
        {value.trim() === "" && (
          <InfinityIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        )}
      </div>
    </div>
  );
}

function ToggleRow({ icon: Icon, label, checked, onChange }: {
  icon: typeof FileText; label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="flex items-center gap-1.5 text-foreground">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" /> {label}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
