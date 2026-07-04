import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Search, KeyRound, Trash2, Ban, CheckCircle2, Crown } from "lucide-react";
import { toast } from "sonner";
import { adminApi, type AdminUser, type PlanLimit } from "@/lib/admin-api";
import { PLAN_LABELS, type AppPlan } from "@/lib/queries/admin";

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

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return users;
    return users.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        (u.nom_affiche ?? "").toLowerCase().includes(term),
    );
  }, [users, q]);

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

  const delAcc = useMutation({
    mutationFn: (userId: string) => adminApi.deleteUser(userId),
    onSuccess: () => { toast.success("Compte supprimé"); invalidate(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [pwdTarget, setPwdTarget] = useState<AdminUser | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [delTarget, setDelTarget] = useState<AdminUser | null>(null);

  return (
    <div className="space-y-5 px-5 py-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Espace administrateur</div>
          <h1 className="mt-1 flex items-center gap-2 font-display text-3xl font-semibold text-foreground">
            <Users className="h-7 w-7 text-teal" /> Gestion des utilisateurs
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gérez les comptes, les plans et les statuts de tous les enseignants.
          </p>
        </div>
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
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher par email ou nom…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Liste */}
      <div className="card-elevated overflow-hidden">
        {isLoading && <div className="p-6 text-sm text-muted-foreground">Chargement…</div>}
        {error && <div className="p-6 text-sm text-destructive">Erreur : {(error as Error).message}</div>}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Aucun utilisateur.</div>
        )}
        <ul className="divide-y divide-border">
          {filtered.map((u) => (
            <li key={u.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium text-foreground">{u.nom_affiche || u.email}</span>
                    {u.roles.includes("admin") && (
                      <Badge className="bg-teal text-cream">
                        <Crown className="mr-1 h-3 w-3" /> Admin
                      </Badge>
                    )}
                    {u.statut === "suspendu" && (
                      <Badge variant="destructive">Suspendu</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                  <div className="mt-1 text-[11px] text-muted-foreground">
                    Créé le {new Date(u.created_at).toLocaleDateString("fr-FR")}
                    {u.last_sign_in_at && (
                      <> · Dernière connexion {new Date(u.last_sign_in_at).toLocaleDateString("fr-FR")}</>
                    )}
                  </div>
                  <PlanLimitsBadges limit={limitsByPlan.get(u.plan)} />
                </div>


                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1.5">
                    <Label className="sr-only">Plan</Label>
                    <Select
                      value={u.plan}
                      onValueChange={(v) =>
                        changePlan.mutate({ userId: u.id, plan: v as AppPlan })
                      }
                    >
                      <SelectTrigger className="h-8 w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gratuit">{PLAN_LABELS.gratuit}</SelectItem>
                        <SelectItem value="lite">{PLAN_LABELS.lite}</SelectItem>
                        <SelectItem value="premium">{PLAN_LABELS.premium}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      toggleSuspend.mutate({ userId: u.id, suspendre: u.statut !== "suspendu" })
                    }
                  >
                    {u.statut === "suspendu" ? (
                      <><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Réactiver</>
                    ) : (
                      <><Ban className="mr-1 h-3.5 w-3.5" /> Suspendre</>
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setPwdTarget(u); setNewPwd(""); }}
                  >
                    <KeyRound className="mr-1 h-3.5 w-3.5" /> Mot de passe
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setDelTarget(u)}
                    disabled={u.roles.includes("admin")}
                    title={u.roles.includes("admin") ? "Impossible de supprimer un admin" : undefined}
                  >
                    <Trash2 className="mr-1 h-3.5 w-3.5" /> Supprimer
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Dialog reset password */}
      <Dialog open={!!pwdTarget} onOpenChange={(v) => !v && setPwdTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-teal" /> Réinitialiser le mot de passe
            </DialogTitle>
            <DialogDescription>
              Nouveau mot de passe pour <strong>{pwdTarget?.email}</strong>.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="new-pwd">Nouveau mot de passe (min. 8 caractères)</Label>
            <Input
              id="new-pwd"
              type="text"
              value={newPwd}
              onChange={(e) => setNewPwd(e.target.value)}
              placeholder="Mot de passe temporaire"
              autoComplete="new-password"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPwdTarget(null)}>Annuler</Button>
            <Button
              disabled={newPwd.length < 8 || resetPwd.isPending}
              onClick={() => {
                if (!pwdTarget) return;
                resetPwd.mutate({ userId: pwdTarget.id, newPassword: newPwd });
                setPwdTarget(null);
              }}
            >
              Réinitialiser
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

