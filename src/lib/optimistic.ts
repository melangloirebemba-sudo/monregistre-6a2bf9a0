// Utilitaires de mise à jour optimiste pour les caches TanStack Query qui
// contiennent des listes triées (notes, absences…). Chaque helper renvoie
// un « snapshot » [queryKey, previousData][] permettant de restaurer
// l'état exact en cas d'échec (`onError`).
import type { QueryClient, QueryKey } from "@tanstack/react-query";

type WithId = { id: string };

export type ListSnapshot<T> = Array<[QueryKey, T[] | undefined]>;

/**
 * Applique une transformation à toutes les entrées de cache dont la clé
 * commence par `prefix`. Retourne un snapshot pour rollback.
 */
export function patchLists<T extends WithId>(
  qc: QueryClient,
  prefix: QueryKey,
  transform: (list: T[], key: QueryKey) => T[],
): ListSnapshot<T> {
  const entries = qc.getQueriesData<T[]>({ queryKey: prefix });
  const snapshot: ListSnapshot<T> = [];
  for (const [key, data] of entries) {
    snapshot.push([key, data]);
    if (!data) continue;
    qc.setQueryData<T[]>(key, transform(data, key));
  }
  return snapshot;
}

export function rollbackLists<T>(qc: QueryClient, snapshot: ListSnapshot<T>) {
  for (const [key, data] of snapshot) {
    qc.setQueryData<T[]>(key, data);
  }
}

/**
 * Insère ou remplace `row` dans toutes les listes en cache. `sort` conserve
 * l'ordre attendu par la requête (typiquement `date` desc). `keyMatches`
 * peut filtrer les caches où la ligne n'a plus sa place après l'édition
 * (ex : classeId dans la queryKey ne correspond plus).
 */
export function upsertInLists<T extends WithId>(
  qc: QueryClient,
  prefix: QueryKey,
  row: T,
  opts: {
    sort?: (a: T, b: T) => number;
    keyMatches?: (row: T, key: QueryKey) => boolean;
  } = {},
): ListSnapshot<T> {
  return patchLists<T>(qc, prefix, (list, key) => {
    const keep = opts.keyMatches ? opts.keyMatches(row, key) : true;
    const without = list.filter((r) => r.id !== row.id);
    if (!keep) return without;
    const next = [...without, row];
    return opts.sort ? next.sort(opts.sort) : next;
  });
}

/**
 * Insère/remplace plusieurs lignes d'un coup dans les listes en cache.
 * Plus efficace qu'un boucle sur `upsertInLists` (un seul snapshot par clé).
 */
export function upsertManyInLists<T extends WithId>(
  qc: QueryClient,
  prefix: QueryKey,
  rows: T[],
  opts: {
    sort?: (a: T, b: T) => number;
    keyMatches?: (row: T, key: QueryKey) => boolean;
  } = {},
): ListSnapshot<T> {
  return patchLists<T>(qc, prefix, (list, key) => {
    const ids = new Set(rows.map((r) => r.id));
    const without = list.filter((r) => !ids.has(r.id));
    const toAdd = opts.keyMatches
      ? rows.filter((r) => opts.keyMatches!(r, key))
      : rows;
    const next = [...without, ...toAdd];
    return opts.sort ? next.sort(opts.sort) : next;
  });
}

export function removeFromLists<T extends WithId>(
  qc: QueryClient,
  prefix: QueryKey,
  id: string,
): ListSnapshot<T> {
  return patchLists<T>(qc, prefix, (list) => list.filter((r) => r.id !== id));
}
