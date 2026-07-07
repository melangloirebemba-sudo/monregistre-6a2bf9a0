import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Settings2, ChevronRight, Trash2 } from "lucide-react";
import { Link, useRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNotificationCenter, type NotificationItem } from "@/lib/changelog";
import {
  useNotificationsPrefs,
  NOTIF_CATEGORY_LABELS,
  type NotifCategory,
} from "@/lib/notifications-prefs";
import { cn } from "@/lib/utils";

// État partagé entre toutes les instances de la cloche (topbar + sidebar) et
// entre rafales Realtime :
// - `bellOpenCount` : nombre de popovers ouvertes (0 = toutes fermées).
// - `seenIds` : ids déjà annoncés (ou pré-existants) — un item ne toast qu'une
//   seule fois par session, même si Realtime rejoue l'événement.
// - `toastInit` : au tout premier rendu on ne toast rien (les notifications
//   déjà présentes ne sont pas des « nouveautés »).
// - `pending` / `flushTimer` : coalescing des rafales Realtime en un unique
//   toast (fenêtre courte de 250 ms).
let bellOpenCount = 0;
const seenIds = new Set<string>();
let toastInit = false;
const pending = new Map<string, NotificationItem>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

interface NotificationsBellProps {
  variant?: "topbar" | "sidebar";
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

type Filter = "all" | NotifCategory;

export function NotificationsBell({ variant = "topbar" }: NotificationsBellProps) {
  const { items, unreadCount, markRead, markAllRead, enabled } =
    useNotificationCenter();
  const prefs = useNotificationsPrefs();
  const [filter, setFilter] = useState<Filter>(prefs.defaultFilter);

  // Si la catégorie par défaut change (via réglages ou realtime) et qu'elle
  // est encore activée, on aligne le filtre affiché.
  useEffect(() => {
    if (prefs.defaultFilter === "all" || prefs.categories[prefs.defaultFilter]) {
      setFilter(prefs.defaultFilter);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.defaultFilter]);

  // Si la catégorie active a été désactivée entre-temps, retomber sur « Toutes ».
  useEffect(() => {
    if (filter !== "all" && !prefs.categories[filter]) {
      setFilter("all");
    }
  }, [prefs.categories, filter]);

  // Contrôle l'ouverture pour savoir si l'utilisateur voit déjà la liste
  // (on n'affiche pas de toast dans ce cas).
  const [open, setOpen] = useState(false);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open === wasOpen.current) return;
    bellOpenCount += open ? 1 : -1;
    wasOpen.current = open;
    return () => {
      // Au démontage, si l'instance était ouverte on décrémente aussi.
      if (wasOpen.current) {
        bellOpenCount -= 1;
        wasOpen.current = false;
      }
    };
  }, [open]);

  const router = useRouter();

  // Toast pour toute nouvelle notification (activée par les préférences) qui
  // arrive alors qu'aucune cloche n'est ouverte. Les rafales Realtime sont
  // coalescées dans une fenêtre courte pour éviter les doublons.
  useEffect(() => {
    if (!enabled) return;
    if (!toastInit) {
      // Premier passage : on marque tout comme déjà vu, sans toaster.
      for (const it of items) seenIds.add(`${it.source}:${it.id}`);
      toastInit = true;
      return;
    }
    let queued = false;
    for (const it of items) {
      const key = `${it.source}:${it.id}`;
      if (seenIds.has(key)) continue;
      seenIds.add(key);
      if (it.read || !prefs.categories[it.category]) continue;
      pending.set(key, it);
      queued = true;
    }
    if (!queued) return;

    if (flushTimer) return; // un flush est déjà programmé
    flushTimer = setTimeout(() => {
      flushTimer = null;
      const batch = Array.from(pending.values());
      pending.clear();
      if (batch.length === 0 || bellOpenCount > 0) return;
      const first = batch[0];
      if (batch.length === 1) {
        toast(first.title, {
          id: `notif:${first.source}:${first.id}`,
          description: first.description || undefined,
          action: first.href
            ? {
                label: "Ouvrir",
                onClick: () => router.navigate({ href: first.href! }),
              }
            : undefined,
        });
      } else {
        toast(`${batch.length} nouvelles notifications`, {
          id: `notif:bulk:${batch.map((b) => `${b.source}:${b.id}`).sort().join(",")}`,
          description: first.title,
        });
      }
    }, 250);
  }, [items, enabled, prefs.categories, router]);


  // Chips visibles : seulement les catégories activées dans les préférences.
  const activeCats = (Object.keys(prefs.categories) as NotifCategory[]).filter(
    (c) => prefs.categories[c],
  );

  const filtered = filter === "all" ? items : items.filter((n) => n.category === filter);
  const filteredUnread = filtered.filter((n) => !n.read).length;

  const buttonBase =
    variant === "sidebar"
      ? "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-foreground/70 hover:bg-white/5 hover:text-ink-foreground w-full"
      : "relative shrink-0 rounded-full p-2 text-ink-foreground/70 hover:bg-white/5 hover:text-ink-foreground";

  const chipBase =
    "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button aria-label="Notifications" className={buttonBase}>
          <Bell className={variant === "sidebar" ? "h-4 w-4 shrink-0" : "h-5 w-5"} />
          {variant === "sidebar" && <span className="truncate">Notifications</span>}
          {enabled && unreadCount > 0 && (
            <span
              className={cn(
                "absolute grid min-w-[18px] h-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground",
                variant === "sidebar"
                  ? "right-3 top-1/2 -translate-y-1/2"
                  : "-top-0.5 -right-0.5",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold">Notifications</div>
            <div className="text-xs text-muted-foreground">
              {!enabled
                ? "Notifications désactivées"
                : unreadCount > 0
                  ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                  : "Tout est à jour"}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {enabled && filteredUnread > 0 && (
              <button
                onClick={() => markAllRead(filter === "all" ? undefined : filter)}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal hover:bg-teal/10"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Tout lire
              </button>
            )}
            <Link
              to="/parametres/notifications"
              aria-label="Réglages des notifications"
              className="inline-flex items-center rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </Link>
          </div>
        </div>

        {enabled && activeCats.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto border-b bg-muted/30 px-3 py-2">
            <button
              onClick={() => setFilter("all")}
              className={cn(
                chipBase,
                filter === "all"
                  ? "border-teal bg-teal text-cream"
                  : "border-border bg-background text-muted-foreground hover:text-foreground",
              )}
            >
              Toutes
            </button>
            {activeCats.map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={cn(
                  chipBase,
                  filter === cat
                    ? "border-teal bg-teal text-cream"
                    : "border-border bg-background text-muted-foreground hover:text-foreground",
                )}
              >
                {NOTIF_CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>
        )}

        <ul className="max-h-80 divide-y overflow-y-auto">
          {filtered.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              {!enabled
                ? "Réactivez les notifications dans les réglages."
                : "Aucune notification"}
            </li>
          )}
          {filtered.map((item: NotificationItem) => {
            const content = (
              <>
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    item.read ? "bg-muted-foreground/30" : "bg-teal",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{item.title}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatDate(item.date)}
                    </span>
                  </span>
                  {item.description && (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {item.description}
                    </span>
                  )}
                </span>
                {item.href && (
                  <ChevronRight
                    className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                )}
              </>
            );
            const rowClass = cn(
              "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
              !item.read && "bg-teal/5",
            );
            return (
              <li key={`${item.source}:${item.id}`}>
                {item.href ? (
                  <Link
                    to={item.href}
                    onClick={() => markRead(item)}
                    className={rowClass}
                  >
                    {content}
                  </Link>
                ) : (
                  <button onClick={() => markRead(item)} className={rowClass}>
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
