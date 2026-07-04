import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type EcoleOption = { id: string; nom: string };

type EcoleFilterProps = {
  value: string;
  onValueChange: (value: string) => void;
  ecoles: EcoleOption[];
  /** Valeur représentant « aucun filtre ». Par défaut "all". */
  emptyValue?: string;
  /** Libellé de l'option « aucun filtre ». Passez `null` pour retirer l'option. */
  emptyLabel?: string | null;
  /** Placeholder du trigger. */
  placeholder?: string;
  className?: string;
  disabled?: boolean;
};

/**
 * Sélecteur d'école partagé — comportement identique sur toutes les pages.
 * Utilisé dans Élèves, Classes, Notes, Absences, Rapports.
 */
export function EcoleFilter({
  value,
  onValueChange,
  ecoles,
  emptyValue = "all",
  emptyLabel = "Toutes les écoles",
  placeholder = "École",
  className,
  disabled,
}: EcoleFilterProps) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {emptyLabel !== null && (
          <SelectItem value={emptyValue}>{emptyLabel}</SelectItem>
        )}
        {ecoles.map((e) => (
          <SelectItem key={e.id} value={e.id}>
            {e.nom}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type EcoleBadgeProps = {
  name: string | null | undefined;
  fallback?: string;
  className?: string;
};

/**
 * Badge « École » — pastille teal identique sur toutes les listes.
 */
export function EcoleBadge({
  name,
  fallback = "École ?",
  className = "",
}: EcoleBadgeProps) {
  return (
    <span
      className={`rounded-sm bg-teal/10 px-1.5 py-0.5 font-medium text-teal ${className}`}
    >
      {name ?? fallback}
    </span>
  );
}

type EcoleGroupHeaderProps = {
  name: string | null | undefined;
  count: number;
  fallback?: string;
};

/**
 * En-tête de groupe « École » pour les listes groupées.
 */
export function EcoleGroupHeader({
  name,
  count,
  fallback = "École ?",
}: EcoleGroupHeaderProps) {
  return (
    <h2 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      <span className="h-1.5 w-1.5 rounded-full bg-teal" />
      {name ?? fallback}
      <span className="ml-auto text-[10px] font-normal">{count}</span>
    </h2>
  );
}
