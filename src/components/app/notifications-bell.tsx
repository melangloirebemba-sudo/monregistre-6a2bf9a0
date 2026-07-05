import { Bell, CheckCheck } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useChangelog } from "@/lib/changelog";
import { cn } from "@/lib/utils";

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

export function NotificationsBell({ variant = "topbar" }: NotificationsBellProps) {
  const { entries, unreadCount, markRead, markAllRead } = useChangelog();

  const buttonBase =
    variant === "sidebar"
      ? "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-foreground/70 hover:bg-white/5 hover:text-ink-foreground w-full"
      : "relative shrink-0 rounded-full p-2 text-ink-foreground/70 hover:bg-white/5 hover:text-ink-foreground";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button aria-label="Notifications" className={buttonBase}>
          <Bell className={variant === "sidebar" ? "h-4 w-4 shrink-0" : "h-5 w-5"} />
          {variant === "sidebar" && <span className="truncate">Notifications</span>}
          {unreadCount > 0 && (
            <span
              className={cn(
                "absolute grid min-w-[18px] h-[18px] place-items-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground",
                variant === "sidebar" ? "right-3 top-1/2 -translate-y-1/2" : "-top-0.5 -right-0.5",
              )}
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[calc(100vw-2rem)] max-w-sm p-0">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Nouveautés</div>
            <div className="text-xs text-muted-foreground">
              {unreadCount > 0
                ? `${unreadCount} non lue${unreadCount > 1 ? "s" : ""}`
                : "Tout est à jour"}
            </div>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-teal hover:bg-teal/10"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tout lire
            </button>
          )}
        </div>
        <ul className="max-h-80 divide-y overflow-y-auto">
          {entries.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted-foreground">
              Aucune notification
            </li>
          )}
          {entries.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => markRead(e.id)}
                className={cn(
                  "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/50",
                  !e.read && "bg-teal/5",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    e.read ? "bg-muted-foreground/30" : "bg-teal",
                  )}
                  aria-hidden
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{e.title}</span>
                    <span className="shrink-0 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {formatDate(e.date)}
                    </span>
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {e.description}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
