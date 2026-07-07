import * as React from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * VirtualList — rend uniquement les lignes visibles pour réduire drastiquement
 * le coût de rendu sur les grandes listes (lecteurs, élèves, notes…).
 *
 * Usage :
 *   <VirtualList
 *     items={rows}
 *     estimateSize={56}
 *     renderItem={(row) => <MyRow row={row} />}
 *     className="max-h-96"
 *   />
 */
export interface VirtualListProps<T> {
  items: readonly T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  /** Hauteur estimée en px (peut être approximative, ajustée dynamiquement). */
  estimateSize: number;
  /** Nombre de lignes à rendre hors-écran. */
  overscan?: number;
  className?: string;
  /** Clé stable pour éviter les remounts. */
  getItemKey?: (item: T, index: number) => string | number;
}

export function VirtualList<T>({
  items,
  renderItem,
  estimateSize,
  overscan = 6,
  className,
  getItemKey,
}: VirtualListProps<T>) {
  const parentRef = React.useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index]!, index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={className}
      style={{ overflowY: "auto", contain: "strict" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualItems.map((v) => {
          const item = items[v.index];
          if (item === undefined) return null;
          return (
            <div
              key={v.key}
              data-index={v.index}
              ref={virtualizer.measureElement}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                transform: `translateY(${v.start}px)`,
              }}
            >
              {renderItem(item, v.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}
