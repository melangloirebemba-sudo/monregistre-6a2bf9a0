import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  BellRing,
  CalendarClock,
  Trash2,
  RefreshCw,
  Zap,
  CheckCircle2,
  XCircle,
  Clock,
  Users,
  Crown,
  User,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  Eraser,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  scheduleAdminBroadcast,
  cancelScheduledBroadcast,
  triggerNotificationHook,
  listAllUsers,
  listBroadcastReaders,
  deleteBroadcast,
  clearBroadcastHistory,
} from "@/lib/admin-notifications.functions";

export const Route = createFileRoute("/_authenticated/admin/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Console admin" },
      { name: "robots", content: "noindex" },
    ],
  }),
  loader: ({ context }) => {
    context.queryClient.ensureQueryData(scheduledQueryOptions());
  },
  component: AdminNotificationsPage,
});

function scheduledQueryOptions() {
  return {
    queryKey: ["admin-scheduled-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("scheduled_notifications")
        .select("*")
        .order("send_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      return data ?? [];
    },
    staleTime: 10_000,
  };
}

type Target = "all" | "plan" | "user";
type Category = "admin" | "feature" | "fix" | "billing" | "security" | "account" | "reactivation";

const CATEGORY_LABELS: Record<Category, string> = {
  admin: "Administratif",
  feature: "Nouveauté",
  fix: "Amélioration",
  billing: "Facturation",
  security: "Sécurité",
  account: "Compte",
  reactivation: "Réactivation",
};

const STATUS_META: Record<
  string,
  { label: string; className: string; Icon: typeof Clock }
> = {
  pending: { label: "Programmée", className: "bg-gold/20 text-foreground", Icon: Clock },
  sent: { label: "Envoyée", className: "bg-teal/20 text-teal", Icon: CheckCircle2 },
  failed: { label: "Échec", className: "bg-destructive/15 text-destructive", Icon: XCircle },
  cancelled: { label: "Annulée", className: "bg-muted text-muted-foreground", Icon: XCircle },
};

function toLocalInputValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function AdminNotificationsPage() {
  const qc = useQueryClient();
  const { data: scheduled } = useSuspenseQuery(scheduledQueryOptions());

  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Category>("admin");
  const [href, setHref] = useState("");
  const [targetType, setTargetType] = useState<Target>("all");
  const [targetValue, setTargetValue] = useState("");
  const [sendAt, setSendAt] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    return toLocalInputValue(d);
  });
  const [mode, setMode] = useState<"now" | "schedule">("now");

  const sendNow = useServerFn(sendAdminBroadcastNow);
  const scheduleFn = useServerFn(scheduleAdminBroadcast);
  const cancelFn = useServerFn(cancelScheduledBroadcast);
  const triggerFn = useServerFn(triggerNotificationHook);
  const listUsersFn = useServerFn(listAllUsers);

  const [userSearch, setUserSearch] = useState("");
  const { data: usersList = [], isLoading: usersLoading } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: () => listUsersFn(),
    enabled: targetType === "user",
    staleTime: 60_000,
  });

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return usersList.slice(0, 50);
    return usersList
      .filter((u) => {
        const hay = `${u.email ?? ""} ${u.nom_affiche ?? ""} ${u.prenom ?? ""} ${u.nom_famille ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 50);
  }, [usersList, userSearch]);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-scheduled-notifications"] });
  };

  const submitting = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        body: body.trim() || null,
        category,
        href: href.trim() || null,
        target_type: targetType,
        target_value: targetType === "all" ? null : targetValue.trim() || null,
        send_at:
          mode === "schedule" ? new Date(sendAt).toISOString() : null,
      };
      if (mode === "now") {
        return sendNow({ data: payload });
      }
      return scheduleFn({ data: payload });
    },
    onSuccess: (res) => {
      if (mode === "now") {
        const r = res as { recipients?: number };
        toast.success(
          `Notification envoyée à ${r.recipients ?? 0} destinataire(s)`,
        );
      } else {
        toast.success("Notification programmée");
      }
      setTitle("");
      setBody("");
      setHref("");
      setTargetValue("");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSubmit = title.trim().length > 0 &&
    (targetType === "all" || targetValue.trim().length > 0);

  const cancel = useMutation({
    mutationFn: async (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Notification annulée");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const trigger = useMutation({
    mutationFn: async (hook: string) =>
      triggerFn({
        data: {
          hook: hook as
            | "schedule-daily-reminders"
            | "license-expiry-reminders"
            | "relay-inapp-notifications"
            | "dispatch-scheduled-notifications",
        },
      }),
    onSuccess: (res, hook) => {
      const r = res as { ok: boolean; status: number };
      if (r.ok) toast.success(`Tâche « ${hook} » exécutée`);
      else toast.error(`Échec (${r.status})`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const stats = useMemo(() => {
    const list = scheduled ?? [];
    return {
      pending: list.filter((r) => r.status === "pending").length,
      sent: list.filter((r) => r.status === "sent").length,
      failed: list.filter((r) => r.status === "failed").length,
    };
  }, [scheduled]);

  return (
    <div className="space-y-5 px-4 py-5 sm:px-5 sm:py-6">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
          Backoffice
        </div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">
          <BellRing className="h-6 w-6 shrink-0 text-gold sm:h-7 sm:w-7" />
          <span className="truncate">Notifications</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Composez, envoyez et programmez des notifications pour tous les enseignants ou une audience précise.
        </p>
      </header>

      {/* Compose */}
      <section className="card-elevated space-y-4 p-4 sm:p-5">
        <h2 className="text-sm font-semibold text-foreground">Composer</h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label htmlFor="notif-title">Titre</Label>
            <Input
              id="notif-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex : Maintenance programmée dimanche"
              maxLength={120}
            />
          </div>

          <div className="sm:col-span-2">
            <Label htmlFor="notif-body">Message</Label>
            <Textarea
              id="notif-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Détails de la notification (facultatif)"
              rows={3}
              maxLength={1000}
            />
          </div>

          <div>
            <Label>Catégorie</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as Category)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="notif-href">Lien (facultatif)</Label>
            <Input
              id="notif-href"
              value={href}
              onChange={(e) => setHref(e.target.value)}
              placeholder="/accueil"
            />
          </div>

          <div>
            <Label>Destinataires</Label>
            <Select value={targetType} onValueChange={(v) => setTargetType(v as Target)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="inline-flex items-center gap-2">
                    <Users className="h-3.5 w-3.5" /> Tous les utilisateurs
                  </span>
                </SelectItem>
                <SelectItem value="plan">
                  <span className="inline-flex items-center gap-2">
                    <Crown className="h-3.5 w-3.5" /> Par plan
                  </span>
                </SelectItem>
                <SelectItem value="user">
                  <span className="inline-flex items-center gap-2">
                    <User className="h-3.5 w-3.5" /> Un utilisateur
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {targetType === "plan" && (
            <div>
              <Label>Plan cible</Label>
              <Select value={targetValue} onValueChange={setTargetValue}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un plan…" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gratuit">Gratuit</SelectItem>
                  <SelectItem value="lite">Lite</SelectItem>
                  <SelectItem value="premium">Premium</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          {targetType === "user" && (
            <div className="sm:col-span-2">
              <Label htmlFor="notif-user">Destinataire</Label>
              <Input
                id="notif-user-search"
                type="search"
                autoComplete="off"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Rechercher par nom ou email…"
                className="mb-2"
              />
              <div className="max-h-60 overflow-y-auto rounded-lg border border-border/60 bg-background/50">
                {usersLoading ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    Chargement des utilisateurs…
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </div>
                ) : (
                  <ul className="divide-y divide-border/40">
                    {filteredUsers.map((u) => {
                      const selected = targetValue === (u.email ?? u.user_id);
                      const label = u.nom_affiche
                        || [u.prenom, u.nom_famille].filter(Boolean).join(" ")
                        || u.email
                        || u.user_id;
                      return (
                        <li key={u.user_id}>
                          <button
                            type="button"
                            onClick={() => setTargetValue(u.email ?? u.user_id)}
                            className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs transition hover:bg-muted/50 ${
                              selected ? "bg-gold/10 text-foreground" : "text-foreground"
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{label}</div>
                              <div className="truncate text-[11px] text-muted-foreground">
                                {u.email ?? "email non renseigné"}
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1.5">
                              {u.plan && (
                                <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                                  {u.plan}
                                </span>
                              )}
                              {u.statut && u.statut !== "actif" && (
                                <span className="rounded-full bg-destructive/15 px-1.5 py-0.5 text-[10px] text-destructive">
                                  {u.statut}
                                </span>
                              )}
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {targetValue
                  ? <>Sélectionné : <b className="text-foreground">{targetValue}</b></>
                  : "Cliquez sur un utilisateur pour le sélectionner."}
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-background/50 p-3">
          <div className="mb-3 flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "now" ? "default" : "outline"}
              onClick={() => setMode("now")}
            >
              <Send className="mr-1.5 h-3.5 w-3.5" />
              Envoyer maintenant
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "schedule" ? "default" : "outline"}
              onClick={() => setMode("schedule")}
            >
              <CalendarClock className="mr-1.5 h-3.5 w-3.5" />
              Programmer
            </Button>
          </div>
          {mode === "schedule" && (
            <div className="mb-3">
              <Label htmlFor="notif-when">Date & heure d'envoi</Label>
              <Input
                id="notif-when"
                type="datetime-local"
                value={sendAt}
                onChange={(e) => setSendAt(e.target.value)}
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Le service dispatch vérifie les notifications programmées toutes les 5 minutes.
              </p>
            </div>
          )}
          <Button
            type="button"
            className="w-full"
            disabled={!canSubmit || submitting.isPending}
            onClick={() => submitting.mutate()}
          >
            {submitting.isPending
              ? "Envoi…"
              : mode === "now"
                ? "Envoyer immédiatement"
                : "Programmer l'envoi"}
          </Button>
        </div>
      </section>

      {/* Manual triggers */}
      <section className="card-elevated space-y-3 p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <Zap className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold text-foreground">Tâches automatiques</h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Exécutez manuellement les tâches habituellement déclenchées par pg_cron.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            {
              key: "schedule-daily-reminders",
              label: "Résumé des cours de demain",
            },
            {
              key: "license-expiry-reminders",
              label: "Rappels d'expiration de licence",
            },
            {
              key: "relay-inapp-notifications",
              label: "Relais push des notifications in-app",
            },
            {
              key: "dispatch-scheduled-notifications",
              label: "Dispatch des notifications programmées",
            },
          ].map((t) => (
            <Button
              key={t.key}
              variant="outline"
              size="sm"
              disabled={trigger.isPending}
              onClick={() => trigger.mutate(t.key)}
              className="justify-start"
            >
              <RefreshCw className="mr-2 h-3.5 w-3.5" />
              {t.label}
            </Button>
          ))}
        </div>
      </section>

      {/* History */}
      <section className="card-elevated p-4 sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Historique & programmées</h2>
          <div className="flex gap-2 text-[11px] text-muted-foreground">
            <span>En attente : <b className="text-foreground">{stats.pending}</b></span>
            <span>Envoyées : <b className="text-foreground">{stats.sent}</b></span>
            {stats.failed > 0 && (
              <span className="text-destructive">Échecs : <b>{stats.failed}</b></span>
            )}
          </div>
        </div>
        {scheduled.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            Aucune notification pour le moment.
          </div>
        ) : (
          <ul className="space-y-2">
            {scheduled.map((row) => {
              const meta = STATUS_META[row.status] ?? STATUS_META.pending;
              const StatusIcon = meta.Icon;
              return (
                <li
                  key={row.id}
                  className="rounded-xl border border-border/60 bg-background/50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${meta.className}`}
                        >
                          <StatusIcon className="h-3 w-3" />
                          {meta.label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {CATEGORY_LABELS[(row.category as Category) ?? "admin"] ?? row.category}
                        </span>
                      </div>
                      <div className="mt-1 truncate text-sm font-medium text-foreground">
                        {row.title}
                      </div>
                      {row.body && (
                        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                          {row.body}
                        </div>
                      )}
                      <div className="mt-1 text-[11px] text-muted-foreground">
                        {row.status === "pending" ? "Envoi prévu " : "Envoi "}
                        <b>{new Date(row.send_at).toLocaleString("fr-FR")}</b>
                        {typeof row.recipients_count === "number" && (
                          <> · {row.recipients_count} destinataire(s)</>
                        )}
                        {row.target_type !== "all" && (
                          <> · cible : {row.target_type} {row.target_value ? `= ${row.target_value}` : ""}</>
                        )}
                      </div>
                    </div>
                    {row.status === "pending" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancel.mutate(row.id)}
                        disabled={cancel.isPending}
                        aria-label="Annuler"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                  {row.error && (
                    <div className="mt-2 rounded-md bg-destructive/10 p-2 text-[11px] text-destructive">
                      {row.error}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

// Silence unused import warning when useQuery not used
void useQuery;
