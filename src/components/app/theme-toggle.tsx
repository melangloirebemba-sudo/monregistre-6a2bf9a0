import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme, type Theme } from "@/lib/theme";

/** Sélecteur de thème segmenté : Clair / Sombre / Système. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const options: Array<{ value: Theme; label: string; Icon: typeof Sun }> = [
    { value: "light", label: "Clair", Icon: Sun },
    { value: "dark", label: "Sombre", Icon: Moon },
    { value: "system", label: "Auto", Icon: Monitor },
  ];
  return (
    <div
      role="radiogroup"
      aria-label="Thème"
      className="inline-flex rounded-full border border-input bg-cream-deep/40 p-1"
    >
      {options.map(({ value, label, Icon }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={[
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              active
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            ].join(" ")}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
