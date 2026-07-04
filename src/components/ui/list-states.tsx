import { SearchX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ListSkeletonProps {
  rows?: number;
  className?: string;
  itemClassName?: string;
}

export function ListSkeleton({ rows = 5, className, itemClassName }: ListSkeletonProps) {
  return (
    <ul
      className={cn("space-y-2", className)}
      aria-busy="true"
      aria-live="polite"
      aria-label="Chargement en cours"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <li
          key={i}
          className={cn(
            "card-elevated flex items-center gap-3 p-3",
            itemClassName,
          )}
        >
          <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-3/5" />
          </div>
          <Skeleton className="h-6 w-12 shrink-0 rounded-full" />
        </li>
      ))}
    </ul>
  );
}

interface NoResultsProps {
  query?: string;
  onReset?: () => void;
  resetLabel?: string;
  title?: string;
  description?: string;
  className?: string;
}

export function NoResults({
  query,
  onReset,
  resetLabel = "Réinitialiser les filtres",
  title = "Aucun résultat",
  description,
  className,
}: NoResultsProps) {
  const desc =
    description ??
    (query && query.trim().length > 0
      ? `Aucune correspondance pour « ${query.trim()} ».`
      : "Aucun élément ne correspond à votre recherche ou vos filtres.");
  return (
    <div
      role="status"
      className={cn(
        "card-elevated flex flex-col items-center gap-3 p-6 text-center",
        className,
      )}
    >
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
        <SearchX className="h-5 w-5" aria-hidden="true" />
      </span>
      <div>
        <div className="font-display text-base font-semibold text-foreground">
          {title}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
      </div>
      {onReset && (
        <Button size="sm" variant="outline" onClick={onReset}>
          {resetLabel}
        </Button>
      )}
    </div>
  );
}
