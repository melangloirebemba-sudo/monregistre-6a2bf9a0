import { useMemo, useRef, useState } from "react";
import { Check, ChevronsUpDown, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

function norm(v: string) {
  return v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function useFiltered(options: string[], query: string) {
  return useMemo(() => {
    const q = norm(query);
    if (!q) return options;
    return options.filter((o) => norm(o).includes(q));
  }, [options, query]);
}

interface BaseProps {
  options: string[];
  placeholder?: string;
  emptyLabel?: string;
  disabled?: boolean;
  id?: string;
}

/** ComboBox créable à sélection unique. */
export function Combobox({
  value,
  onChange,
  options,
  placeholder = "Sélectionner…",
  disabled,
  id,
}: BaseProps & { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const filtered = useFiltered(options, query);
  const exact = filtered.some((o) => norm(o) === norm(query));
  const canCreate = query.trim().length > 0 && !exact;

  const commit = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQuery("");
      }}
    >
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="truncate">{value || placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <div className="border-b p-2">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                if (filtered[0] && !canCreate) commit(filtered[0]);
                else if (canCreate) commit(query.trim());
              }
            }}
            placeholder="Rechercher ou créer…"
            className="h-9"
          />
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {filtered.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => commit(o)}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
            >
              <Check className={cn("h-4 w-4 shrink-0", value === o ? "opacity-100" : "opacity-0")} />
              <span className="truncate">{o}</span>
            </button>
          ))}
          {canCreate && (
            <button
              type="button"
              onClick={() => commit(query.trim())}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span className="truncate">Créer : « {query.trim()} »</span>
            </button>
          )}
          {filtered.length === 0 && !canCreate && (
            <p className="px-2 py-3 text-center text-sm text-muted-foreground">Aucune suggestion</p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** ComboBox créable à sélection multiple. */
export function MultiCombobox({
  values,
  onChange,
  options,
  placeholder = "Sélectionner…",
  disabled,
  id,
}: BaseProps & { values: string[]; onChange: (v: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const filtered = useFiltered(options, query);
  const exact =
    filtered.some((o) => norm(o) === norm(query)) || values.some((v) => norm(v) === norm(query));
  const canCreate = query.trim().length > 0 && !exact;

  const toggle = (v: string) => {
    const has = values.some((x) => norm(x) === norm(v));
    onChange(has ? values.filter((x) => norm(x) !== norm(v)) : [...values, v]);
    setQuery("");
    inputRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <Popover
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setQuery("");
        }}
      >
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            role="combobox"
            disabled={disabled}
            className={cn(
              "w-full justify-between font-normal",
              values.length === 0 && "text-muted-foreground",
            )}
          >
            <span className="truncate">
              {values.length === 0 ? placeholder : `${values.length} sélectionnée(s)`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <div className="border-b p-2">
            <Input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (canCreate) toggle(query.trim());
                  else if (filtered[0]) toggle(filtered[0]);
                }
              }}
              placeholder="Rechercher ou créer…"
              className="h-9"
            />
          </div>
          <div className="max-h-56 overflow-y-auto p-1">
            {filtered.map((o) => {
              const active = values.some((x) => norm(x) === norm(o));
              return (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggle(o)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <Check className={cn("h-4 w-4 shrink-0", active ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{o}</span>
                </button>
              );
            })}
            {canCreate && (
              <button
                type="button"
                onClick={() => toggle(query.trim())}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary hover:bg-accent"
              >
                <Plus className="h-4 w-4 shrink-0" />
                <span className="truncate">Créer : « {query.trim()} »</span>
              </button>
            )}
            {filtered.length === 0 && !canCreate && (
              <p className="px-2 py-3 text-center text-sm text-muted-foreground">
                Aucune suggestion
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {v}
              <button
                type="button"
                aria-label={`Retirer ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="opacity-60 hover:opacity-100"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
