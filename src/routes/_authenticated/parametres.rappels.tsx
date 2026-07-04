import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, ArrowLeft, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  useReminderPrefs,
  setReminderPrefs,
  resetReminderPrefs,
} from "@/lib/reminders-prefs";

export const Route = createFileRoute("/_authenticated/parametres/rappels")({
  head: () => ({
    meta: [
      { title: "Rappels — Paramètres" },
      {
        name: "description",
        content: "Activez chaque type de rappel et ajustez la fréquence sur l'Accueil.",
      },
    ],
  }),
  component: RappelsPrefsPage,
});

function RappelsPrefsPage() {
  const prefs = useReminderPrefs();

  return (
    <div className="px-5 pb-24 pt-5">
      <div className="mb-6">
        <Link
          to="/parametres"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Retour aux paramètres
        </Link>
        <div className="mt-3 flex items-center gap-2 text-gold">
          <Bell className="h-4 w-4" />
          <span className="text-[11px] font-semibold uppercase tracking-[0.22em]">
            Rappels
          </span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
          Préférences des rappels
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez les alertes affichées sur l'Accueil et ajustez leur seuil.
        </p>
      </div>

      <div className="card-elevated divide-y divide-border">
        <ToggleRow
          title="Aucune période définie"
          description="Alerter tant qu'aucune période (trimestre / semestre) n'est configurée."
          checked={prefs.noPeriodes}
          onChange={(v) => setReminderPrefs({ noPeriodes: v })}
        />
        <ToggleRow
          title="Classes sans aucune note"
          description="Alerter pour chaque classe qui n'a pas encore de note enregistrée."
          checked={prefs.noNotes}
          onChange={(v) => setReminderPrefs({ noNotes: v })}
        />

        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-foreground">Classes sans note récente</div>
              <p className="text-xs text-muted-foreground">
                Alerter si la dernière note d'une classe dépasse le seuil.
              </p>
            </div>
            <Switch
              checked={prefs.staleNotes}
              onCheckedChange={(v) => setReminderPrefs({ staleNotes: v })}
            />
          </div>
          <div className={prefs.staleNotes ? "" : "pointer-events-none opacity-50"}>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Seuil</Label>
              <span className="text-sm font-semibold tabular-nums">
                {prefs.staleNotesDays} jour{prefs.staleNotesDays > 1 ? "s" : ""}
              </span>
            </div>
            <Slider
              min={3}
              max={60}
              step={1}
              value={[prefs.staleNotesDays]}
              onValueChange={([v]) => setReminderPrefs({ staleNotesDays: v })}
              disabled={!prefs.staleNotes}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>3 j</span>
              <span>60 j</span>
            </div>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium text-foreground">
                Absences non justifiées
              </div>
              <p className="text-xs text-muted-foreground">
                Alerter pour les absences non justifiées sur une fenêtre récente.
              </p>
            </div>
            <Switch
              checked={prefs.absencesUnj}
              onCheckedChange={(v) => setReminderPrefs({ absencesUnj: v })}
            />
          </div>
          <div className={prefs.absencesUnj ? "" : "pointer-events-none opacity-50"}>
            <div className="mb-2 flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Fenêtre</Label>
              <span className="text-sm font-semibold tabular-nums">
                {prefs.absencesWindowDays} jour{prefs.absencesWindowDays > 1 ? "s" : ""}
              </span>
            </div>
            <Slider
              min={1}
              max={30}
              step={1}
              value={[prefs.absencesWindowDays]}
              onValueChange={([v]) => setReminderPrefs({ absencesWindowDays: v })}
              disabled={!prefs.absencesUnj}
            />
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>1 j</span>
              <span>30 j</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex justify-end">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            resetReminderPrefs();
            toast.success("Préférences réinitialisées");
          }}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Réinitialiser
        </Button>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Les préférences sont stockées sur cet appareil.
      </p>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <div className="font-medium text-foreground">{title}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
