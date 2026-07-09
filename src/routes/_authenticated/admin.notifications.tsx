import { createFileRoute } from "@tanstack/react-router";
import { toFrench } from "@/lib/errors";
import { useEffect, useMemo, useState } from "react";
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
  Send,
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
  MailCheck,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VirtualList } from "@/components/ui/virtual-list";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  sendAdminBroadcastNow,
  scheduleAdminBroadcast,
  cancelScheduledBroadcast,
  triggerNotificationHook,
  listAllUsers,
  listBroadcastReaders,
  deleteBroadcast,
  clearBroadcastHistory,
  previewBroadcastRecipients,
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
  const listReadersFn = useServerFn(listBroadcastReaders);
  const deleteBroadcastFn = useServerFn(deleteBroadcast);
  const clearHistoryFn = useServerFn(clearBroadcastHistory);
  const previewFn = useServerFn(previewBroadcastRecipients);

  const [showPreview, setShowPreview] = useState(false);
  const [lastResult, setLastResult] = useState<{
    sent: number;
    failed: number;
    total: number;
    details: Array<{
      user_id: string;
      nom_affiche: string | null;
      email: string | null;
      status: "sent" | "failed";
      error?: string;
    }>;
  } | null>(null);

  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  // Realtime : refléter en direct les nouvelles diffusions, les changements de
  // statut (envoyée/échec/annulée) et les lectures des destinataires.
  useEffect(() => {
    const ch = supabase
      .channel(`admin-notifications-realtime:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "scheduled_notifications" },
        () => qc.invalidateQueries({ queryKey: ["admin-scheduled-notifications"] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_notifications" },
        () => qc.invalidateQueries({ queryKey: ["broadcast-readers"] }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const submitting = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        body: body.trim() || null,
        category,
        href: href.trim() || null,
        target_type: targetType,
        target_value: targetType === "all" ? null : targetValue.trim() || null,
        send_at: mode === "schedule" ? new Date(sendAt).toISOString() : null,
      };
      return mode === "now"
        ? sendNow({ data: payload })
        : scheduleFn({ data: payload });
    },
    onSuccess: (res) => {
      if (mode === "now") {
        const r = res as {
          recipients?: number;
          sent?: number;
          failed?: number;
          details?: Array<{
            user_id: string;
            nom_affiche: string | null;
            email: string | null;
            status: "sent" | "failed";
            error?: string;
          }>;
        };
        const sent = r.sent ?? r.recipients ?? 0;
        const failed = r.failed ?? 0;
        setLastResult({
          sent,
          failed,
          total: r.recipients ?? 0,
          details: r.details ?? [],
        });
        if (failed === 0) {
          toast.success(`Notification envoyée à ${sent} destinataire(s)`);
        } else {
          toast.error(`Envoi partiel : ${sent} succès, ${failed} échec(s)`);
        }
      } else {
        toast.success("Notification programmée");
      }
      setShowPreview(false);
      setTitle("");
      setBody("");
      setHref("");
      setTargetValue("");
      invalidate();
    },
    onError: (e: Error) => {
      setShowPreview(false);
      toast.error(toFrench(e));
    },
  });



  const removeBroadcast = useMutation({
    mutationFn: async (id: string) => deleteBroadcastFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Notification supprimée");
      invalidate();
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const clearHistory = useMutation({
    mutationFn: async () => clearHistoryFn({ data: { include_pending: false } }),
    onSuccess: () => {
      toast.success("Historique effacé");
      invalidate();
    },
    onError: (e: Error) => toast.error(toFrench(e)),
  });

  const canSubmit = title.trim().length > 0 &&
    (targetType === "all" || targetValue.trim().length > 0);

  const previewQuery = useQuery({
    queryKey: ["admin-broadcast-preview", targetType, targetValue],
    queryFn: () =>
      previewFn({
        data: {
          target_type: targetType,
          target_value: targetType === "all" ? null : targetValue.trim() || null,
        },
      }),
    enabled: showPreview && canSubmit,
    staleTime: 15_000,
  });

  const cancel = useMutation({
    mutationFn: async (id: string) => cancelFn({ data: { id } }),
    onSuccess: () => {
      toast.success("Notification annulée");
      invalidate();
    },
    onError: (e: Error) => toast.error(toFrench(e)),
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
    onError: (e: Error) => toast.error(toFrench(e)),
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
              <div className="max-h-60 rounded-lg border border-border/60 bg-background/50">
                {usersLoading ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    Chargement des utilisateurs…
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="p-3 text-center text-xs text-muted-foreground">
                    Aucun utilisateur trouvé.
                  </div>
                ) : (
                  <VirtualList
                    items={filteredUsers}
                    estimateSize={52}
                    overscan={8}
                    className="max-h-60"
                    getItemKey={(u) => u.user_id}
                    renderItem={(u) => {
                      const selected = targetValue === (u.email ?? u.user_id);
                      const label = u.nom_affiche
                        || [u.prenom, u.nom_famille].filter(Boolean).join(" ")
                        || u.email
                        || u.user_id;
                      return (
                        <button
                          type="button"
                          onClick={() => setTargetValue(u.email ?? u.user_id)}
                          className={`flex w-full items-center justify-between gap-3 border-b border-border/40 px-3 py-2 text-left text-xs transition hover:bg-muted/50 ${
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
                      );
                    }}
                  />
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
          {!showPreview ? (
            <Button
              type="button"
              className="w-full"
              disabled={!canSubmit}
              onClick={() => {
                setLastResult(null);
                setShowPreview(true);
              }}
            >
              <Eye className="mr-1.5 h-3.5 w-3.5" />
              Aperçu avant {mode === "now" ? "envoi" : "programmation"}
            </Button>
          ) : (
            <div className="space-y-3">
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="mb-2 text-[11px] uppercase tracking-wider text-muted-foreground">
                  Aperçu du message
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gold/20 px-2 py-0.5 text-[10px] font-medium text-foreground">
                    {CATEGORY_LABELS[category]}
                  </span>
                  {mode === "schedule" ? (
                    <span className="text-[11px] text-muted-foreground">
                      Programmé pour <b className="text-foreground">{new Date(sendAt).toLocaleString("fr-FR")}</b>
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground">Envoi immédiat</span>
                  )}
                </div>
                <div className="mt-2 text-sm font-semibold text-foreground">
                  {title.trim() || <span className="italic text-muted-foreground">Sans titre</span>}
                </div>
                {body.trim() && (
                  <div className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {body.trim()}
                  </div>
                )}
                {href.trim() && (
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    Lien : <code className="rounded bg-background/60 px-1">{href.trim()}</code>
                  </div>
                )}
              </div>
              <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                    Destinataires
                  </div>
                  {previewQuery.isFetching && (
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                  )}
                </div>
                {previewQuery.isLoading ? (
                  <div className="text-xs text-muted-foreground">Calcul en cours…</div>
                ) : previewQuery.error ? (
                  <div className="text-xs text-destructive">
                    {toFrench(previewQuery.error)}
                  </div>
                ) : (
                  <>
                    <div className="text-sm font-semibold text-foreground">
                      {previewQuery.data?.total ?? 0} destinataire(s)
                    </div>
                    {(previewQuery.data?.recipients?.length ?? 0) > 0 && (
                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto">
                        {previewQuery.data!.recipients.slice(0, 20).map((r) => (
                          <li
                            key={r.user_id}
                            className="flex items-center justify-between gap-2 rounded-md bg-background/50 px-2 py-1 text-[11px]"
                          >
                            <span className="truncate text-foreground">
                              {r.nom_affiche || r.email || r.user_id}
                            </span>
                            {r.email && (
                              <span className="truncate text-muted-foreground">{r.email}</span>
                            )}
                          </li>
                        ))}
                        {previewQuery.data!.total > 20 && (
                          <li className="px-2 text-[11px] text-muted-foreground">
                            … et {previewQuery.data!.total - 20} autre(s)
                          </li>
                        )}
                      </ul>
                    )}
                  </>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={submitting.isPending}
                  onClick={() => setShowPreview(false)}
                >
                  Modifier
                </Button>
                <Button
                  type="button"
                  className="flex-1"
                  disabled={submitting.isPending || (previewQuery.data?.total ?? 0) === 0}
                  onClick={() => submitting.mutate()}
                >
                  {submitting.isPending
                    ? "Envoi…"
                    : mode === "now"
                      ? "Confirmer l'envoi"
                      : "Confirmer la programmation"}
                </Button>
              </div>
            </div>
          )}

          {lastResult && mode === "now" && (
            <SendResultPanel result={lastResult} onClose={() => setLastResult(null)} />
          )}
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
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground">Historique & programmées</h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-2 text-[11px] text-muted-foreground">
              <span>En attente : <b className="text-foreground">{stats.pending}</b></span>
              <span>Envoyées : <b className="text-foreground">{stats.sent}</b></span>
              {stats.failed > 0 && (
                <span className="text-destructive">Échecs : <b>{stats.failed}</b></span>
              )}
            </div>
            {(stats.sent > 0 || stats.failed > 0) && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={clearHistory.isPending}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive"
                  >
                    <Eraser className="mr-1.5 h-3.5 w-3.5" />
                    Vider
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="border-destructive/20">
                  <AlertDialogHeader>
                    <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-4 ring-destructive/5">
                      <Eraser className="h-6 w-6 text-destructive" />
                    </div>
                    <AlertDialogTitle className="text-center">
                      Vider l'historique des notifications ?
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center">
                      Cette action effacera <b className="text-foreground">{stats.sent + stats.failed}</b> entrée(s)
                      (envoyées et échecs). Les notifications <b className="text-foreground">programmées</b> seront
                      conservées. Cette opération est irréversible.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuler</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearHistory.mutate()}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      <Eraser className="mr-1.5 h-3.5 w-3.5" />
                      Vider l'historique
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
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
              const isExpanded = expandedId === row.id;
              const canShowReaders = row.status === "sent";
              return (
                <li
                  key={row.id}
                  className="rounded-xl border border-border/60 bg-background/50 p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
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
                    <div className="flex shrink-0 items-center gap-1">
                      {canShowReaders && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedId(isExpanded ? null : row.id)}
                          aria-label="Voir les lecteurs"
                          title="Voir les lecteurs"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronRight className="h-3.5 w-3.5" />
                          )}
                        </Button>
                      )}
                      {row.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => cancel.mutate(row.id)}
                          disabled={cancel.isPending}
                          aria-label="Annuler"
                          title="Annuler"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={removeBroadcast.isPending}
                            aria-label="Supprimer"
                            title="Supprimer"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-destructive/20">
                          <AlertDialogHeader>
                            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-4 ring-destructive/5">
                              <Trash2 className="h-6 w-6 text-destructive" />
                            </div>
                            <AlertDialogTitle className="text-center">
                              Supprimer cette notification ?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-center">
                              <span className="mb-2 block truncate rounded-md bg-muted/50 px-3 py-1.5 text-sm font-medium text-foreground">
                                « {row.title} »
                              </span>
                              L'entrée d'historique et les notifications distribuées correspondantes
                              seront définitivement supprimées. Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => removeBroadcast.mutate(row.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  {row.error && (
                    <div className="mt-2 rounded-md bg-destructive/10 p-2 text-[11px] text-destructive">
                      {row.error}
                    </div>
                  )}
                  {isExpanded && canShowReaders && (
                    <ReadersPanel id={row.id} loader={listReadersFn} />
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

type ReadersLoader = (args: { data: { id: string } }) => Promise<{
  total: number;
  read: number;
  readers: Array<{ user_id: string; nom_affiche: string | null; email: string | null; read_at: string | null }>;
}>;

function ReadersPanel({ id, loader }: { id: string; loader: ReadersLoader }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["broadcast-readers", id],
    queryFn: () => loader({ data: { id } }),
    staleTime: 15_000,
  });

  if (isLoading) {
    return (
      <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
        Chargement des destinataires…
      </div>
    );
  }
  if (error) {
    return (
      <div className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
        {toFrench(error)}
      </div>
    );
  }
  if (!data || data.total === 0) {
    return (
      <div className="mt-3 rounded-lg border border-dashed border-border/60 p-3 text-center text-xs text-muted-foreground">
        Aucun destinataire retrouvé pour cette diffusion.
      </div>
    );
  }
  return (
    <div className="mt-3 rounded-lg border border-border/60 bg-background/40 p-3">
      <div className="mb-2 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Lecture : <b className="text-foreground">{data.read}</b> / {data.total}
        </span>
        <span>{Math.round((data.read / data.total) * 100)}%</span>
      </div>
      <VirtualList
        items={data.readers}
        estimateSize={44}
        overscan={8}
        className="max-h-56"
        getItemKey={(r) => r.user_id}
        renderItem={(r) => (
          <div className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/40">
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium text-foreground">
                {r.nom_affiche || r.email || r.user_id}
              </div>
              {r.email && r.nom_affiche && (
                <div className="truncate text-[10px] text-muted-foreground">{r.email}</div>
              )}
            </div>
            {r.read_at ? (
              <span className="inline-flex items-center gap-1 text-[10px] text-teal">
                <Eye className="h-3 w-3" />
                {new Date(r.read_at).toLocaleString("fr-FR")}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                <EyeOff className="h-3 w-3" />
                Non lue
              </span>
            )}
          </div>
        )}
      />

    </div>
  );
}

function SendResultPanel({
  result,
  onClose,
}: {
  result: {
    sent: number;
    failed: number;
    total: number;
    details: Array<{
      user_id: string;
      nom_affiche: string | null;
      email: string | null;
      status: "sent" | "failed";
      error?: string;
    }>;
  };
  onClose: () => void;
}) {
  const allOk = result.failed === 0 && result.sent > 0;
  const partial = result.failed > 0 && result.sent > 0;
  const allFail = result.failed > 0 && result.sent === 0;

  return (
    <div
      className={`mt-3 rounded-xl border p-3 ${
        allOk
          ? "border-teal/40 bg-teal/10"
          : allFail
            ? "border-destructive/40 bg-destructive/10"
            : "border-gold/40 bg-gold/10"
      }`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          {allOk ? (
            <MailCheck className="h-4 w-4 text-teal" />
          ) : allFail ? (
            <XCircle className="h-4 w-4 text-destructive" />
          ) : (
            <AlertCircle className="h-4 w-4 text-gold" />
          )}
          <div>
            <div className="text-sm font-semibold text-foreground">
              {allOk
                ? "Notification envoyée avec succès"
                : allFail
                  ? "Envoi échoué"
                  : "Envoi partiel"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {result.sent} succès · {result.failed} échec(s) · {result.total} au total
            </div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Fermer">
          <XCircle className="h-3.5 w-3.5" />
        </Button>
      </div>
      {result.details.length > 0 && (
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md bg-background/40 p-1">
          {result.details.map((d) => (
            <li
              key={d.user_id}
              className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs hover:bg-muted/40"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-medium text-foreground">
                  {d.nom_affiche || d.email || d.user_id}
                </div>
                {d.email && d.nom_affiche && (
                  <div className="truncate text-[10px] text-muted-foreground">{d.email}</div>
                )}
                {d.status === "failed" && d.error && (
                  <div className="truncate text-[10px] text-destructive">{toFrench(d.error)}</div>
                )}
              </div>
              {d.status === "sent" ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-teal">
                  <CheckCircle2 className="h-3 w-3" />
                  Envoyée
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                  <XCircle className="h-3 w-3" />
                  Échec
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Silence unused import warning
void useQuery;


