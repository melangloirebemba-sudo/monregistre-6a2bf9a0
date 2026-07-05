import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, BellOff, RotateCcw } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  useNotificationsPrefs,
  setNotificationsPrefs,
  NOTIF_CATEGORY_LABELS,
  REMINDER_FREQUENCY_LABELS,
  DEFAULT_NOTIFICATIONS_PREFS,
  type NotifCategory,
  type ReminderFrequency,
  type DefaultFilter,
} from "@/lib/notifications-prefs";

export const Route = createFileRoute("/_authenticated/parametres/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Paramètres" },
      {
        name: "description",
        content:
          "Activez ou désactivez chaque type de notification et choisissez la fréquence des rappels.",
      },
    ],
  }),
  component: NotificationsPrefsPage,
});

const CATEGORY_ORDER: NotifCategory[] = ["feature", "fix", "account", "billing"];
const FREQUENCY_ORDER: ReminderFrequency[] = ["off", "immediate", "daily", "weekly"];

function NotificationsPrefsPage() {
  const prefs = useNotificationsPrefs();

  const handleReset = () => {
    setNotificationsPrefs(DEFAULT_NOTIFICATIONS_PREFS);
    toast.success("Préférences réinitialisées");
  };

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
            Notifications
          </span>
        </div>
        <h1 className="mt-1 font-display text-3xl font-semibold text-foreground">
          Réglages des notifications
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Choisissez les types de notifications à recevoir et la fréquence des rappels.
        </p>
      </div>

      <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Recevoir les notifications
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Active ou désactive globalement la cloche de nouveautés.
            </p>
          </div>
          <Switch
            checked={prefs.enabled}
            onCheckedChange={(v) => {
              setNotificationsPrefs({ enabled: v });
              toast.success(v ? "Notifications activées" : "Notifications désactivées");
            }}
            aria-label="Activer les notifications"
          />
        </div>
      </section>

      <section
        className={`mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft ${!prefs.enabled ? "opacity-60" : ""}`}
      >
        <h2 className="text-sm font-semibold text-foreground">Types de notifications</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Recevez uniquement les catégories qui vous intéressent.
        </p>
        <div className="mt-4 space-y-3">
          {CATEGORY_ORDER.map((cat) => (
            <div key={cat} className="flex items-center justify-between gap-3">
              <Label
                htmlFor={`cat-${cat}`}
                className="text-sm font-medium text-foreground"
              >
                {NOTIF_CATEGORY_LABELS[cat]}
              </Label>
              <Switch
                id={`cat-${cat}`}
                disabled={!prefs.enabled}
                checked={prefs.categories[cat]}
                onCheckedChange={(v) =>
                  setNotificationsPrefs({ categories: { [cat]: v } as Record<NotifCategory, boolean> })
                }
              />
            </div>
          ))}
        </div>
      </section>

      <section
        className={`mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft ${!prefs.enabled ? "opacity-60" : ""}`}
      >
        <h2 className="text-sm font-semibold text-foreground">Fréquence des rappels</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          À quelle fréquence vous rappeler les notifications non lues.
        </p>
        <div className="mt-4">
          <Select
            value={prefs.reminderFrequency}
            disabled={!prefs.enabled}
            onValueChange={(v) =>
              setNotificationsPrefs({ reminderFrequency: v as ReminderFrequency })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_ORDER.map((f) => (
                <SelectItem key={f} value={f}>
                  {REMINDER_FREQUENCY_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="mt-4 flex items-center justify-between gap-4 rounded-2xl border border-dashed border-border bg-muted/30 p-5">
        <div className="flex items-start gap-3">
          {prefs.enabled ? (
            <Bell className="mt-0.5 h-4 w-4 text-muted-foreground" />
          ) : (
            <BellOff className="mt-0.5 h-4 w-4 text-muted-foreground" />
          )}
          <div>
            <p className="text-sm font-medium text-foreground">Réinitialiser</p>
            <p className="text-xs text-muted-foreground">
              Revenir aux réglages par défaut.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleReset}>
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Réinitialiser
        </Button>
      </section>
    </div>
  );
}
