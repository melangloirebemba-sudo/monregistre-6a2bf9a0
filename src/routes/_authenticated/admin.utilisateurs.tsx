import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, KeyRound, Trash2, Ban, CheckCircle2, Crown, ArrowUp, ArrowDown, ArrowUpDown, Sparkles, Clock, History, Mail } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type AdminUser, type PlanLimit, type PlanPeriode, type PlanActivation } from "@/lib/admin-api";
import { PLAN_LABELS, type AppPlan } from "@/lib/queries/admin";
import { PasswordCriteria, PASSWORD_MIN_LENGTH, isPasswordValid } from "@/components/app/password-criteria";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/admin/utilisateurs")({
  head: () => ({ meta: [{ title: "Utilisateurs — Console admin" }, { name: "robots", content: "noindex" }] }),
  component: AdminContent,
});

function AdminContent() {
  const qc = useQueryClient();

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => adminApi.listUsers(),
    staleTime: 15_000,
  });

  const { data: planLimits = [] } = useQuery({
    queryKey: ["admin-plan-limits"],
    queryFn: () => adminApi.plansList(),
    staleTime: 30_000,
  });
  const limitsByPlan = useMemo(() => {
    const m = new Map<AppPlan, PlanLimit>();
    for (const p of planLimits) m.set(p.plan, p);
    return m;
  }, [planLimits]);



  const [q, setQ] = useState("");
  type SortKey = "nom" | "email" | "plan" | "statut" | "created";
  const [sortKey, setSortKey] = useState<SortKey>("nom");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [sortMsg, setSortMsg] = useState("");

  const PLAN_ORDER: Record<AppPlan, number> = { gratuit: 0, lite: 1, premium: 2 };
  const SORT_LABELS: Record<SortKey, string> = {
    nom: "Nom",
    email: "Email",
    plan: "Plan",
    statut: "Statut",
    created: "Date de création",
  };

  const requestSort = (key: SortKey) => {
    const nextDir: "asc" | "desc" = sortKey === key && sortDir === "asc" ? "desc" : "asc";
    setSortKey(key);
    setSortDir(nextDir);
    setSortMsg(
      `Table triée par ${SORT_LABELS[key]}, ordre ${nextDir === "asc" ? "croissant" : "décroissant"}`,
    );
  };

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const base = !term
      ? users
      : users.filter(
          (u) =>
            u.email.toLowerCase().includes(term) ||
            (u.nom_affiche ?? "").toLowerCase().includes(term),
        );
    const collator = new Intl.Collator("fr", { sensitivity: "base" });
    const cmp = (a: AdminUser, b: AdminUser) => {
      switch (sortKey) {
        case "email":
          return collator.compare(a.email, b.email);
        case "plan":
          return PLAN_ORDER[a.plan] - PLAN_ORDER[b.plan];
        case "statut":
          return collator.compare(a.statut, b.statut);
        case "created":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "nom":
        default:
          return collator.compare(a.nom_affiche ?? a.email, b.nom_affiche ?? b.email);
      }
    };
    const sorted = [...base].sort(cmp);
    return sortDir === "asc" ? sorted : sorted.reverse();
  }, [users, q, sortKey, sortDir]);

  const stats = useMemo(() => {
    return {
      total: users.length,
      admins: users.filter((u) => u.roles.includes("admin")).length,
      gratuit: users.filter((u) => u.plan === "gratuit").length,
      lite: users.filter((u) => u.plan === "lite").length,
      premium: users.filter((u) => u.plan === "premium").length,
      suspendus: users.filter((u) => u.statut === "suspendu").length,
    };
  }, [users]);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-users"] });

  const changePlan = useMutation({
    mutationFn: (v: { userId: string; plan: AppPlan }) => adminApi.updatePlan(v.userId, v.plan),
    onSuccess: () => { toast.success("Plan mis à jour"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const activatePlan = useMutation({
    mutationFn: (v: { userId: string; plan: "lite" | "premium"; periode: PlanPeriode }) =>
      adminApi.activatePlan(v.userId, v.plan, v.periode),
    onSuccess: (r, v) => {
      const d = new Date(r.plan_expires_at).toLocaleDateString("fr-FR");
      toast.success(`Plan activé — expire le ${d}`);
      invalidate();
      qc.invalidateQueries({ queryKey: ["admin-activations", v.userId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleSuspend = useMutation({
    mutationFn: (v: { userId: string; suspendre: boolean }) => adminApi.setSuspension(v.userId, v.suspendre),
    onSuccess: (_r, v) => {
      toast.success(v.suspendre ? "Compte suspendu" : "Compte réactivé");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetPwd = useMutation({
    mutationFn: (v: { userId: string; newPassword: string }) => adminApi.resetPassword(v.userId, v.newPassword),
    onSuccess: () => toast.success("Mot de passe réinitialisé"),
    onError: (e: Error) => toast.error(e.message),
  });

  const sendResetEmail = useMutation({
    mutationFn: (userId: string) =>
      adminApi.sendPasswordResetEmail(userId, `${window.location.origin}/reset-password`),
    onSuccess: (r) => toast.success(`Lien de réinitialisation envoyé à ${r.email}`),
    onError: (e: Error) => toast.error(e.message),
  });

  const delAcc = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => { toast.success("Compte supprimé"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [pwdTarget, setPwdTarget] = useState<AdminUser | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [delTarget, setDelTarget] = useState<AdminUser | null>(null);
  const [activateTarget, setActivateTarget] = useState<AdminUser | null>(null);
  const [activatePlanChoice, setActivatePlanChoice] = useState<"lite" | "premium">("lite");
  const [activatePeriodeChoice, setActivatePeriodeChoice] = useState<PlanPeriode>("mensuelle");
  const [historyTarget, setHistoryTarget] = useState<AdminUser | null>(null);

  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>) => {
    const key = e.key;
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) return;
    const rows = Array.from(
      tbodyRef.current?.querySelectorAll<HTMLTableRowElement>('tr[tabindex="0"]') ?? [],
    );
    const current = e.currentTarget;
    const idx = rows.indexOf(current);
    if (idx === -1) return;
    e.preventDefault();
    let next = idx;
    if (key === "ArrowDown") next = Math.min(rows.length - 1, idx + 1);
    else if (key === "ArrowUp") next = Math.max(0, idx - 1);
    else if (key === "Home") next = 0;
    else if (key === "End") next = rows.length - 1;
    rows[next]?.focus();
  };

  return (
    <div className="space-y-5 px-4 py-5 sm:px-5 sm:py-5">
      <header>
        <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Espace administrateur</div>
        <h1 className="mt-1 flex items-center gap-2 font-display text-xl font-semibold text-foreground sm:text-2xl lg:text-3xl">
          <Users className="h-6 w-6 shrink-0 text-teal sm:h-7 sm:w-7" />
          <span className="truncate">Gestion des utilisateurs</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Gérez les comptes, les plans et les statuts de tous les enseignants.
        </p>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        <Stat label="Total" value={stats.total} />
        <Stat label="Admins" value={stats.admins} />
        <Stat label="Gratuit" value={stats.gratuit} />
        <Stat label="Lite" value={stats.lite} />
        <Stat label="Premium" value={stats.premium} />
        <Stat label="Suspendus" value={stats.suspendus} tone={stats.suspendus > 0 ? "warn" : undefined} />
      </div>

      {/* Recherche */}
      <div className="card-elevated p-4">
        <div className="relative">
          <Label htmlFor="admin-users-search" className="sr-only">
            Rechercher un utilisateur
          </Label>
          <Search aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="admin-users-search"
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par email ou nom…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Annonce de tri (lecteurs d'écran) */}
      <p className="sr-only" role="status" aria-live="polite">{sortMsg}</p>

      {/* Table des utilisateurs */}
      <div className="card-elevated overflow-hidden">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Chargement…</div>}
        {error && <div className="p-6 text-sm text-destructive">Erreur : {(error as Error).message}</div>}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Aucun utilisateur.</div>
        )}

        {!isLoading && !error && filtered.length > 0 && (
          <>
            {/* Cartes empilées — mobile */}
            <ul className="divide-y divide-border sm:hidden">
              {filtered.map((u) => {
                const displayName = u.nom_affiche || u.email;
                const isAdmin = u.roles.includes("admin");
                const suspended = u.statut === "suspendu";
                return (
                  <li key={u.id} className="space-y-3 p-4">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="truncate font-medium text-foreground">{displayName}</span>
                          {isAdmin && (
                            <Badge className="bg-teal text-cream">
                              <Crown aria-hidden="true" className="mr-1 h-3 w-3" /> Admin
                            </Badge>
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">{u.email}</div>
                      </div>
                      {suspended ? (
                        <Badge variant="destructive" className="shrink-0">Suspendu</Badge>
                      ) : (
                        <Badge className="shrink-0 bg-teal/15 text-teal hover:bg-teal/20">Actif</Badge>
                      )}
                    </div>

                    <PlanLimitsBadges limit={limitsByPlan.get(u.plan)} />

                    <div className="space-y-1">
                      <Label htmlFor={`plan-m-${u.id}`} className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Plan
                      </Label>
                      <Select
                        value={u.plan}
                        onValueChange={(v) => changePlan.mutate({ userId: u.id, plan: v as AppPlan })}
                      >
                        <SelectTrigger id={`plan-m-${u.id}`} className="h-9 w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="gratuit">{PLAN_LABELS.gratuit}</SelectItem>
                          <SelectItem value="lite">{PLAN_LABELS.lite}</SelectItem>
                          <SelectItem value="premium">{PLAN_LABELS.premium}</SelectItem>
                        </SelectContent>
                      </Select>
                      {u.plan !== "gratuit" && u.plan_expires_at && (
                        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock aria-hidden="true" className="h-3 w-3" />
                          <span>
                            {new Date(u.plan_expires_at).getTime() <= Date.now()
                              ? "Expiré"
                              : `Expire le ${new Date(u.plan_expires_at).toLocaleDateString("fr-FR")}`}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="text-[11px] text-muted-foreground">
                      Créé le {new Date(u.created_at).toLocaleDateString("fr-FR")}
                      {u.last_sign_in_at && (
                        <> · Vu {new Date(u.last_sign_in_at).toLocaleDateString("fr-FR")}</>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={suspended ? `Réactiver le compte de ${displayName}` : `Suspendre le compte de ${displayName}`}
                        onClick={() => toggleSuspend.mutate({ userId: u.id, suspendre: !suspended })}
                      >
                        {suspended ? (
                          <><CheckCircle2 aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Réactiver</>
                        ) : (
                          <><Ban aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Suspendre</>
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Activer un plan pour ${displayName}`}
                        onClick={() => {
                          setActivateTarget(u);
                          setActivatePlanChoice(u.plan === "premium" ? "premium" : "lite");
                          setActivatePeriodeChoice(u.plan_periode ?? "mensuelle");
                        }}
                      >
                        <Sparkles aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Activer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Voir l'historique d'activations de ${displayName}`}
                        onClick={() => setHistoryTarget(u)}
                      >
                        <History aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Historique
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label={`Réinitialiser le mot de passe de ${displayName}`}
                        onClick={() => { setPwdTarget(u); setNewPwd(""); }}
                      >
                        <KeyRound aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Mot de passe
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        aria-label={`Supprimer le compte de ${displayName}`}
                        className="col-span-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDelTarget(u)}
                        disabled={isAdmin}
                        title={isAdmin ? "Impossible de supprimer un admin" : undefined}
                      >
                        <Trash2 aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Supprimer
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Table — tablette & desktop */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <caption className="sr-only">
                  Liste des utilisateurs enseignants — utilisez les flèches haut et bas pour parcourir les lignes,
                  Tab pour atteindre les actions, et activez un en-tête pour trier.
                </caption>
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <SortableHeader label="Nom" sortKey="nom" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                    <SortableHeader label="Email" sortKey="email" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                    <SortableHeader label="Plan" sortKey="plan" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                    <SortableHeader label="Statut" sortKey="statut" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                    <SortableHeader label="Créé le" sortKey="created" currentKey={sortKey} dir={sortDir} onSort={requestSort} />
                    <th scope="col" className="px-3 py-2 text-right">
                      <span className="sr-only">Actions</span>
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody ref={tbodyRef} className="divide-y divide-border">
                  {filtered.map((u, i) => {
                    const displayName = u.nom_affiche || u.email;
                    const isAdmin = u.roles.includes("admin");
                    const suspended = u.statut === "suspendu";
                    return (
                      <tr
                        key={u.id}
                        tabIndex={0}
                        onKeyDown={onRowKeyDown}
                        aria-label={`${displayName}, ${u.email}, plan ${PLAN_LABELS[u.plan]}, ${suspended ? "suspendu" : "actif"}`}
                        aria-rowindex={i + 2}
                        className="align-top outline-none focus-visible:bg-teal/10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal"
                      >
                        <th scope="row" className="px-3 py-3 font-normal text-foreground">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="truncate font-medium">{displayName}</span>
                            {isAdmin && (
                              <Badge className="bg-teal text-cream">
                                <Crown aria-hidden="true" className="mr-1 h-3 w-3" /> Admin
                              </Badge>
                            )}
                          </div>
                          <PlanLimitsBadges limit={limitsByPlan.get(u.plan)} />
                        </th>
                        <td className="px-3 py-3 text-muted-foreground">
                          <span className="block truncate">{u.email}</span>
                        </td>
                        <td className="px-3 py-3">
                          <Label htmlFor={`plan-${u.id}`} className="sr-only">
                            Plan de {displayName}
                          </Label>
                          <Select
                            value={u.plan}
                            onValueChange={(v) => changePlan.mutate({ userId: u.id, plan: v as AppPlan })}
                          >
                            <SelectTrigger id={`plan-${u.id}`} className="h-8 w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="gratuit">{PLAN_LABELS.gratuit}</SelectItem>
                              <SelectItem value="lite">{PLAN_LABELS.lite}</SelectItem>
                              <SelectItem value="premium">{PLAN_LABELS.premium}</SelectItem>
                            </SelectContent>
                          </Select>
                          {u.plan !== "gratuit" && u.plan_expires_at && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                              <Clock aria-hidden="true" className="h-3 w-3" />
                              <span>
                                {new Date(u.plan_expires_at).getTime() <= Date.now()
                                  ? "Expiré"
                                  : `Expire le ${new Date(u.plan_expires_at).toLocaleDateString("fr-FR")}`}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          {suspended ? (
                            <Badge variant="destructive">Suspendu</Badge>
                          ) : (
                            <Badge className="bg-teal/15 text-teal hover:bg-teal/20">Actif</Badge>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString("fr-FR")}
                          {u.last_sign_in_at && (
                            <div className="text-[11px]">
                              Vu {new Date(u.last_sign_in_at).toLocaleDateString("fr-FR")}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-wrap items-center justify-end gap-1.5">
                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={suspended ? `Réactiver le compte de ${displayName}` : `Suspendre le compte de ${displayName}`}
                              onClick={() => toggleSuspend.mutate({ userId: u.id, suspendre: !suspended })}
                            >
                              {suspended ? (
                                <><CheckCircle2 aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Réactiver</>
                              ) : (
                                <><Ban aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Suspendre</>
                              )}
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Activer un plan pour ${displayName}`}
                              onClick={() => {
                                setActivateTarget(u);
                                setActivatePlanChoice(u.plan === "premium" ? "premium" : "lite");
                                setActivatePeriodeChoice(u.plan_periode ?? "mensuelle");
                              }}
                            >
                              <Sparkles aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Activer
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Voir l'historique d'activations de ${displayName}`}
                              onClick={() => setHistoryTarget(u)}
                            >
                              <History aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Historique
                            </Button>

                            <Button
                              size="sm"
                              variant="outline"
                              aria-label={`Réinitialiser le mot de passe de ${displayName}`}
                              onClick={() => { setPwdTarget(u); setNewPwd(""); }}
                            >
                              <KeyRound aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Mot de passe
                            </Button>

                            <Button
                              size="sm"
                              variant="ghost"
                              aria-label={`Supprimer le compte de ${displayName}`}
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              onClick={() => setDelTarget(u)}
                              disabled={isAdmin}
                              title={isAdmin ? "Impossible de supprimer un admin" : undefined}
                            >
                              <Trash2 aria-hidden="true" className="mr-1 h-3.5 w-3.5" /> Supprimer
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>


      {/* Dialog activer un plan */}
      <Dialog open={!!activateTarget} onOpenChange={(v) => !v && setActivateTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-teal" aria-hidden="true" /> Activer un plan
            </DialogTitle>
            <DialogDescription>
              Activation d'un plan payant pour <strong>{activateTarget?.email}</strong>.
              La date d'expiration est calculée automatiquement.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="activate-plan">Plan</Label>
              <Select value={activatePlanChoice} onValueChange={(v) => setActivatePlanChoice(v as "lite" | "premium")}>
                <SelectTrigger id="activate-plan"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="lite">{PLAN_LABELS.lite}</SelectItem>
                  <SelectItem value="premium">{PLAN_LABELS.premium}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="activate-periode">Période</Label>
              <Select value={activatePeriodeChoice} onValueChange={(v) => setActivatePeriodeChoice(v as PlanPeriode)}>
                <SelectTrigger id="activate-periode"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="mensuelle">Mensuelle — 30 jours</SelectItem>
                  <SelectItem value="trimestrielle">Trimestrielle — 90 jours</SelectItem>
                  <SelectItem value="annuelle">Annuelle — 300 jours</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg border border-border bg-background/60 p-3 text-xs text-ink/80">
              {(() => {
                const days = activatePeriodeChoice === "mensuelle" ? 30 : activatePeriodeChoice === "trimestrielle" ? 90 : 300;
                const exp = new Date(Date.now() + days * 86_400_000).toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
                return (
                  <>
                    Récapitulatif : plan <strong>{PLAN_LABELS[activatePlanChoice]}</strong> pour <strong>{days} jours</strong> — expire le <strong>{exp}</strong>.
                  </>
                );
              })()}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setActivateTarget(null)}>Annuler</Button>
            <Button
              disabled={activatePlan.isPending}
              onClick={() => {
                if (!activateTarget) return;
                activatePlan.mutate(
                  { userId: activateTarget.id, plan: activatePlanChoice, periode: activatePeriodeChoice },
                  { onSuccess: () => setActivateTarget(null) },
                );
              }}
            >
              {activatePlan.isPending ? "Activation…" : "Confirmer l'activation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog historique d'activations */}
      <HistoryDialog
        target={historyTarget}
        onClose={() => setHistoryTarget(null)}
      />



      {/* Dialog reset password */}
      <Dialog open={!!pwdTarget} onOpenChange={(v) => !v && setPwdTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal" /> Réinitialiser le mot de passe
            </DialogTitle>
            <DialogDescription>
              Deux options pour <strong>{pwdTarget?.email}</strong>.
            </DialogDescription>
          </DialogHeader>

          {/* Option 1 : lien e-mail */}
          <div className="rounded-xl border border-border/60 bg-cream-deep/20 p-3">
            <div className="flex items-start gap-2">
              <Mail className="mt-0.5 h-4 w-4 text-teal" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">
                  Envoyer un lien de réinitialisation par e-mail
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  L'utilisateur reçoit un lien pour choisir lui-même son mot de passe.
                </p>
              </div>
            </div>
            <Button
              className="mt-2 w-full"
              variant="secondary"
              disabled={sendResetEmail.isPending || !pwdTarget}
              onClick={() => {
                if (!pwdTarget) return;
                sendResetEmail.mutate(pwdTarget.id, {
                  onSuccess: () => setPwdTarget(null),
                });
              }}
            >
              {sendResetEmail.isPending ? "Envoi…" : "Envoyer le lien"}
            </Button>
          </div>

          {/* Option 2 : reset immédiat */}
          <div className="mt-3 space-y-2 rounded-xl border border-border/60 p-3">
            <p className="text-sm font-semibold text-foreground">
              Définir un mot de passe temporaire
            </p>
            <Label htmlFor="new-pwd" className="text-xs">Nouveau mot de passe</Label>
            <Input
              id="new-pwd"
              type="text"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Mot de passe temporaire"
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
            />
            <PasswordCriteria value={newPwd} />
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwdTarget(null)}>Fermer</Button>
            <Button
              disabled={!isPasswordValid(newPwd) || resetPwd.isPending}
              onClick={() => {
                if (!pwdTarget) return;
                resetPwd.mutate({ userId: pwdTarget.id, newPassword: newPwd });
                setPwdTarget(null);
              }}
            >
              Définir le mot de passe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Alert dialog delete */}
      <AlertDialog open={!!delTarget} onOpenChange={(v) => !v && setDelTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer ce compte ?</AlertDialogTitle>
            <AlertDialogDescription>
              Cette action est <strong>irréversible</strong>. Toutes les données ({delTarget?.email}) seront supprimées définitivement.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (!delTarget) return;
                delAcc.mutate(delTarget.id);
                setDelTarget(null);
              }}
            >
              Supprimer définitivement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "warn" }) {
  return (
    <div className={`card-elevated p-3 ${tone === "warn" ? "border-destructive/40" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold ${tone === "warn" ? "text-destructive" : "text-foreground"}`}>{value}</div>
    </div>
  );
}

const UNLIMITED = 2147483647;
function fmt(n: number | undefined) {
  if (n === undefined) return "—";
  return n >= UNLIMITED ? "∞" : String(n);
}
function PlanLimitsBadges({ limit }: { limit: PlanLimit | undefined }) {
  if (!limit) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        Écoles {fmt(limit.max_ecoles)}
      </span>
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        Classes/école {fmt(limit.max_classes_par_ecole)}
      </span>
      <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
        Élèves {fmt(limit.max_eleves)}
      </span>
      {limit.bulletins_pdf && <span className="rounded bg-teal/15 text-teal px-1.5 py-0.5 text-[10px]">Bulletins</span>}
      {limit.rapports && <span className="rounded bg-teal/15 text-teal px-1.5 py-0.5 text-[10px]">Rapports</span>}
      {limit.progression && <span className="rounded bg-teal/15 text-teal px-1.5 py-0.5 text-[10px]">Progression</span>}
    </div>
  );
}

type SortKey = "nom" | "email" | "plan" | "statut" | "created";

function SortableHeader({
  label,
  sortKey,
  currentKey,
  dir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = currentKey === sortKey;
  const ariaSort: "ascending" | "descending" | "none" = active
    ? dir === "asc"
      ? "ascending"
      : "descending"
    : "none";
  const Icon = !active ? ArrowUpDown : dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={ariaSort} className="px-3 py-2">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal"
        aria-label={
          active
            ? `Trier par ${label}, actuellement ${dir === "asc" ? "croissant" : "décroissant"}. Cliquez pour inverser.`
            : `Trier par ${label}`
        }
      >
        {label}
        <Icon aria-hidden="true" className="h-3 w-3" />
      </button>
    </th>
  );
}

const PERIODE_LABEL: Record<PlanPeriode, string> = {
  mensuelle: "Mensuelle (30 j)",
  trimestrielle: "Trimestrielle (90 j)",
  annuelle: "Annuelle (300 j)",
};

function HistoryDialog({ target, onClose }: { target: AdminUser | null; onClose: () => void }) {
  const enabled = !!target;
  const { data: activations = [], isLoading, error } = useQuery({
    queryKey: ["admin-activations", target?.id],
    queryFn: () => adminApi.activationsList(target!.id),
    enabled,
    staleTime: 10_000,
  });

  const fmtDateTime = (iso: string | null) =>
    iso ? new Date(iso).toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
  const fmtDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR") : "—";

  return (
    <Dialog open={enabled} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5 shrink-0 text-teal" aria-hidden="true" /> Historique des activations
          </DialogTitle>
          <DialogDescription className="break-words">
            Journal des activations de plan pour <strong>{target?.nom_affiche || target?.email}</strong>.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading && <div className="p-4 text-sm text-muted-foreground">Chargement…</div>}
          {error && <div className="p-4 text-sm text-destructive">Erreur : {(error as Error).message}</div>}
          {!isLoading && !error && activations.length === 0 && (
            <div className="p-4 text-sm text-muted-foreground">Aucune activation enregistrée.</div>
          )}
          {!isLoading && !error && activations.length > 0 && (
            <ol className="space-y-2">
              {activations.map((a: PlanActivation) => (
                <li key={a.id} className="rounded-lg border border-border bg-background/60 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <Badge className="bg-teal/15 text-teal hover:bg-teal/20">
                        {PLAN_LABELS[a.plan]}
                      </Badge>
                      {a.periode && (
                        <span className="text-xs text-muted-foreground">{PERIODE_LABEL[a.periode]}</span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(a.created_at)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <div>
                      Début : <span className="text-foreground">{fmtDate(a.plan_started_at)}</span>
                    </div>
                    <div>
                      Expire : <span className="text-foreground">{fmtDate(a.plan_expires_at)}</span>
                    </div>
                    <div className="min-w-0 sm:col-span-2">
                      Activé par :{" "}
                      <span className="text-foreground break-all">{a.activated_by_email ?? "—"}</span>
                    </div>
                    {a.note && (
                      <div className="min-w-0 sm:col-span-2 break-words">Note : <span className="text-foreground">{a.note}</span></div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}




