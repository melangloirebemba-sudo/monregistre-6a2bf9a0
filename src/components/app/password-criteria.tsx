import { Check, X } from "lucide-react";

export const PASSWORD_MIN_LENGTH = 6;

export interface PasswordCheck {
  label: string;
  test: (v: string) => boolean;
  required?: boolean;
}

const CHECKS: PasswordCheck[] = [
  { label: `Au moins ${PASSWORD_MIN_LENGTH} caractères`, test: (v) => v.length >= PASSWORD_MIN_LENGTH, required: true },
  { label: "Une lettre majuscule (A-Z)", test: (v) => /[A-Z]/.test(v) },
  { label: "Un chiffre (0-9)", test: (v) => /\d/.test(v) },
  { label: "Un caractère spécial (@, !, #, …)", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

export function isPasswordValid(v: string) {
  return CHECKS.filter((c) => c.required).every((c) => c.test(v));
}

interface Props {
  value: string;
  className?: string;
}

export function PasswordCriteria({ value, className }: Props) {
  return (
    <div
      className={
        "rounded-lg border border-border/60 bg-muted/40 p-3 text-xs " +
        (className ?? "")
      }
      aria-live="polite"
    >
      <div className="mb-1.5 font-medium text-foreground">Critères du mot de passe</div>
      <ul className="space-y-1">
        {CHECKS.map((c) => {
          const ok = c.test(value);
          return (
            <li key={c.label} className="flex items-center gap-2">
              {ok ? (
                <Check className="h-3.5 w-3.5 text-teal" />
              ) : (
                <X className="h-3.5 w-3.5 text-muted-foreground" />
              )}
              <span className={ok ? "text-foreground" : "text-muted-foreground"}>
                {c.label}
                {!c.required && (
                  <span className="ml-1 text-[10px] uppercase tracking-wide text-muted-foreground/70">
                    recommandé
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
