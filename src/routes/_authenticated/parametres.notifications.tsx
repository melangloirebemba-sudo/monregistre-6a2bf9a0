import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, BellOff, RotateCcw, Mail, MessageSquare, MonitorSmartphone, Smartphone } from "lucide-react";
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
  NOTIF_CATEGORY_DESCRIPTIONS,
  CATEGORIES_WITH_EMAIL_SMS,
  REMINDER_FREQUENCY_LABELS,
  DEFAULT_NOTIFICATIONS_PREFS,
  ALL_PUSH_KINDS,
  PUSH_KIND_LABELS,
  PUSH_KIND_DESCRIPTIONS,
  type NotifCategory,
  type NotifChannel,
  type ReminderFrequency,
  type DefaultFilter,
  type PushKind,
} from "@/lib/notifications-prefs";
import { PushToggle } from "@/components/app/push-toggle";

export const Route = createFileRoute("/_authenticated/parametres/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Paramètres" },
      {
        name: "description",
        content:
          "Activez ou désactivez chaque type de notification, choisissez le canal (in-app, email, SMS) et la fréquence des rappels.",
      },
    ],
  }),
  component: NotificationsPrefsPage,
});

const CATEGORY_ORDER: NotifCategory[] = [
  "admin",
  "reactivation",
  "security",
  "billing",
  "account",
  "feature",
  "fix",
];
const FREQUENCY_ORDER: ReminderFrequency[] = ["off", "immediate", "daily", "weekly"];

const CHANNEL_META: Record<NotifChannel, { label: string; icon: typeof Mail }> = {
  inApp: { label: "In-app", icon: MonitorSmartphone },
  email: { label: "Email", icon: Mail },
  sms: { label: "SMS", icon: MessageSquare },
};

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
          Choisissez les types de notifications, les canaux (in-app, email, SMS) et la fréquence des rappels.
        </p>
      </div>

      <div className="mt-4">
        <PushToggle />
      </div>

      <section
        className={`mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft ${!prefs.enabled ? "opacity-60" : ""}`}
      >
        <div className="flex items-start gap-2 text-gold">
          <Smartphone className="mt-0.5 h-4 w-4" />
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Notifications push mobiles
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Choisissez quels types de notifications vous voulez recevoir sur votre téléphone.
              Nécessite l'activation ci-dessus.
            </p>
          </div>
        </div>
        <div className="mt-4 space-y-2">
          {ALL_PUSH_KINDS.map((k) => {
            const active = prefs.push[k];
            return (
              <div
                key={k}
                className="flex items-start justify-between gap-3 rounded-xl border border-border/60 bg-background/50 p-3.5"
              >
                <div className="min-w-0">
                  <Label htmlFor={`push-${k}`} className="text-sm font-medium text-foreground">
                    {PUSH_KIND_LABELS[k]}
                  </Label>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {PUSH_KIND_DESCRIPTIONS[k]}
                  </p>
                </div>
                <Switch
                  id={`push-${k}`}
                  disabled={!prefs.enabled}
                  checked={active}
                  onCheckedChange={(v) =>
                    setNotificationsPrefs({
                      push: { [k]: v } as Partial<Record<PushKind, boolean>> as Record<PushKind, boolean>,
                    })
                  }
                  aria-label={`Push ${PUSH_KIND_LABELS[k]}`}
                />
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-foreground">
              Recevoir les notifications
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Active ou désactive globalement la cloche de notifications.
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
        <h2 className="text-sm font-semibold text-foreground">Types & canaux</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Pour chaque catégorie, choisissez si vous la recevez et par quel canal.
          Email et SMS ne sont disponibles que pour certaines catégories.
        </p>
        <div className="mt-4 space-y-4">
          {CATEGORY_ORDER.map((cat) => {
            const enabled = prefs.enabled && prefs.categories[cat];
            const chans = prefs.channels[cat];
            const emailSmsAvailable = CATEGORIES_WITH_EMAIL_SMS.includes(cat);
            return (
              <div
                key={cat}
                className="rounded-xl border border-border/60 bg-background/50 p-3.5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Label
                      htmlFor={`cat-${cat}`}
                      className="text-sm font-medium text-foreground"
                    >
                      {NOTIF_CATEGORY_LABELS[cat]}
                    </Label>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {NOTIF_CATEGORY_DESCRIPTIONS[cat]}
                    </p>
                  </div>
                  <Switch
                    id={`cat-${cat}`}
                    disabled={!prefs.enabled}
                    checked={prefs.categories[cat]}
                    onCheckedChange={(v) =>
                      setNotificationsPrefs({
                        categories: { [cat]: v } as Record<NotifCategory, boolean>,
                      })
                    }
                  />
                </div>

                <div className="mt-3 grid grid-cols-3 gap-2">
                  {(["inApp", "email", "sms"] as NotifChannel[]).map((ch) => {
                    const meta = CHANNEL_META[ch];
                    const Icon = meta.icon;
                    const available = ch === "inApp" || emailSmsAvailable;
                    const active = chans[ch];
                    const disabled = !enabled || !available;
                    return (
                      <button
                        key={ch}
                        type="button"
                        disabled={disabled}
                        onClick={() =>
                          setNotificationsPrefs({
                            channels: {
                              [cat]: { [ch]: !active },
                            } as never,
                          })
                        }
                        className={[
                          "flex flex-col items-center gap-1 rounded-lg border px-2 py-2 text-[11px] font-medium transition-colors",
                          disabled
                            ? "cursor-not-allowed border-dashed border-border/50 text-muted-foreground/50"
                            : active
                              ? "border-teal bg-teal/10 text-teal"
                              : "border-border bg-background text-muted-foreground hover:text-foreground",
                        ].join(" ")}
                        aria-pressed={active}
                        aria-label={`${meta.label} pour ${NOTIF_CATEGORY_LABELS[cat]}`}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{meta.label}</span>
                        {!available && (
                          <span className="text-[9px] uppercase tracking-wider">
                            N/A
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-4 rounded-lg border border-dashed border-border/70 bg-muted/40 p-3 text-[11px] text-muted-foreground">
          Les canaux email et SMS sont enregistrés comme préférences. La diffusion externe (email/SMS) est en cours de déploiement — pour l'instant, seules les notifications in-app sont affichées dans la cloche.
        </p>
      </section>

      <section
        className={`mt-4 rounded-2xl border border-border bg-card p-5 shadow-soft ${!prefs.enabled ? "opacity-60" : ""}`}
      >
        <h2 className="text-sm font-semibold text-foreground">Filtre par défaut dans la cloche</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Catégorie sélectionnée à l'ouverture de la cloche.
        </p>
        <div className="mt-4">
          <Select
            value={prefs.defaultFilter}
            disabled={!prefs.enabled}
            onValueChange={(v) =>
              setNotificationsPrefs({ defaultFilter: v as DefaultFilter })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes les catégories</SelectItem>
              {CATEGORY_ORDER.filter((c) => prefs.categories[c]).map((c) => (
                <SelectItem key={c} value={c}>
                  {NOTIF_CATEGORY_LABELS[c]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
