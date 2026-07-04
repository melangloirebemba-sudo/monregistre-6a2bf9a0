import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

export function usePagination(
  totalCount: number,
  defaultSize: number = DEFAULT_PAGE_SIZE,
  resetDeps: React.DependencyList = [],
) {
  const [pageSize, setPageSize] = React.useState<number>(defaultSize);
  const [page, setPage] = React.useState<number>(1);
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, totalCount);

  // Reset on total, page size, or external dep change (filters, sort…)
  React.useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalCount, pageSize, ...resetDeps]);

  return {
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    start,
    end,
    slice<T>(arr: T[]): T[] {
      return arr.slice(start, end);
    },
  };
}

interface DataPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  totalCount: number;
  filteredCount?: number;
  start: number;
  end: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  itemLabel?: string;
  className?: string;
}

export function DataPagination({
  page,
  totalPages,
  pageSize,
  totalCount,
  filteredCount,
  start,
  end,
  onPageChange,
  onPageSizeChange,
  itemLabel = "éléments",
  className,
}: DataPaginationProps) {
  // Coherence with loading / empty states: no data → no pagination bar.
  if (totalCount === 0 || (filteredCount !== undefined && filteredCount === 0)) {
    return null;
  }
  const showingFrom = start + 1;
  const total = filteredCount ?? totalCount;
  const singlePage = totalPages <= 1;
  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between pt-2",
        className,
      )}
    >
      <div className="text-xs text-muted-foreground">
        {showingFrom}–{end} sur <span className="font-semibold text-foreground">{total}</span>{" "}
        {itemLabel}
        {filteredCount !== undefined && filteredCount !== totalCount && (
          <> (filtrés sur {totalCount})</>
        )}
      </div>
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground hidden sm:inline">Par page</span>
          <Select
            value={String(pageSize)}
            onValueChange={(v) => onPageSizeChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[72px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZE_OPTIONS.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(Math.max(1, page - 1))}
            disabled={page <= 1}
            aria-label="Page précédente"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs tabular-nums px-1 min-w-[60px] text-center">
            {page} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            disabled={page >= totalPages}
            aria-label="Page suivante"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
