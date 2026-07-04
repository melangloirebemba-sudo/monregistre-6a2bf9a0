import * as React from "react";
import { DEFAULT_PAGE_SIZE } from "@/components/ui/data-pagination";

/**
 * Unified hook to manage search, filters, sort and pagination on a
 * client-side dataset. Guarantees coherence between filtered/sorted results
 * and the current page (auto-reset when inputs change, safe page clamping).
 *
 * Typical usage:
 *
 *   const pq = usePaginatedQuery({
 *     data: eleves,
 *     search: q,
 *     searchFields: (e) => [e.nom, e.prenom],
 *     filters: [
 *       (e) => ecoleFilter === "all" || e.ecole_id === ecoleFilter,
 *       (e) => classeFilter === "all" || e.classe_id === classeFilter,
 *     ],
 *     sort: (a, b) => a.nom.localeCompare(b.nom),
 *     sortKey: sortOrder,   // any serialisable dep that identifies the sort
 *   });
 *
 *   pq.items        // page slice (already filtered + sorted)
 *   pq.filtered     // full filtered+sorted array
 *   pq.totalCount   // raw dataset length
 *   pq.filteredCount
 *   pq.page / pq.setPage / pq.pageSize / pq.setPageSize / pq.totalPages
 *   pq.start / pq.end
 *   pq.isEmpty      // no results after filters
 *   pq.hasQuery     // any active search/filter
 */
export interface UsePaginatedQueryOptions<T> {
  data: readonly T[] | undefined;
  search?: string;
  searchFields?: (item: T) => Array<string | null | undefined>;
  filters?: Array<(item: T) => boolean>;
  sort?: (a: T, b: T) => number;
  /** Serialisable dep (e.g. "nom-asc") — changing it resets the page to 1. */
  sortKey?: string | number | null;
  defaultPageSize?: number;
  /** Extra dependencies that should reset pagination to page 1 when they change. */
  resetDeps?: React.DependencyList;
}

export interface UsePaginatedQueryResult<T> {
  items: T[];
  filtered: T[];
  totalCount: number;
  filteredCount: number;
  page: number;
  setPage: (p: number) => void;
  pageSize: number;
  setPageSize: (s: number) => void;
  totalPages: number;
  start: number;
  end: number;
  isEmpty: boolean;
  hasQuery: boolean;
}

export function usePaginatedQuery<T>({
  data,
  search = "",
  searchFields,
  filters,
  sort,
  sortKey = null,
  defaultPageSize = DEFAULT_PAGE_SIZE,
  resetDeps = [],
}: UsePaginatedQueryOptions<T>): UsePaginatedQueryResult<T> {
  const source = data ?? [];
  const normalizedSearch = search.trim().toLowerCase();
  const hasSearch = normalizedSearch.length > 0;
  const hasFilter = !!filters && filters.length > 0;
  const hasQuery = hasSearch || hasFilter;

  const filtered = React.useMemo(() => {
    let out: T[] = source as T[];
    if (hasFilter) {
      out = out.filter((it) => filters!.every((f) => f(it)));
    }
    if (hasSearch && searchFields) {
      out = out.filter((it) =>
        searchFields(it).some((v) =>
          (v ?? "").toString().toLowerCase().includes(normalizedSearch),
        ),
      );
    }
    if (sort) {
      out = [...out].sort(sort);
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, normalizedSearch, hasSearch, hasFilter, sort, sortKey]);

  const [pageSize, setPageSize] = React.useState<number>(defaultPageSize);
  const [page, setPage] = React.useState<number>(1);

  const filteredCount = filtered.length;
  const totalPages = Math.max(1, Math.ceil(filteredCount / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const end = Math.min(start + pageSize, filteredCount);

  // Reset to page 1 whenever the underlying query shape changes.
  React.useEffect(() => {
    setPage(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedSearch, pageSize, sortKey, filteredCount === 0, ...resetDeps]);

  const items = React.useMemo(
    () => filtered.slice(start, end),
    [filtered, start, end],
  );

  return {
    items,
    filtered,
    totalCount: source.length,
    filteredCount,
    page: safePage,
    setPage,
    pageSize,
    setPageSize,
    totalPages,
    start,
    end,
    isEmpty: filteredCount === 0,
    hasQuery,
  };
}
