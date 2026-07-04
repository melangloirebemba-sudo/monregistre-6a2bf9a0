// Gestion du thème clair/sombre.
// - Persistance dans localStorage ("theme": "light" | "dark" | "system")
// - Repli automatique sur prefers-color-scheme
// - Applique la classe `dark` sur <html>
import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "monregistre.theme";

export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const v = window.localStorage.getItem(STORAGE_KEY);
  return v === "light" || v === "dark" || v === "system" ? v : "system";
}

export function resolveTheme(t: Theme): "light" | "dark" {
  if (t !== "system") return t;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(t);
  document.documentElement.classList.toggle("dark", resolved === "dark");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", resolved === "dark" ? "#0f1220" : "#f5f0e8");
}

export function setTheme(t: Theme) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, t);
  applyTheme(t);
  window.dispatchEvent(new CustomEvent("theme-change", { detail: t }));
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => getStoredTheme());

  useEffect(() => {
    applyTheme(theme);
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<Theme>).detail;
      if (detail) setThemeState(detail);
    };
    window.addEventListener("theme-change", onChange);
    // Suit les changements OS quand mode "system"
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onMq = () => {
      if (getStoredTheme() === "system") applyTheme("system");
    };
    mq.addEventListener?.("change", onMq);
    return () => {
      window.removeEventListener("theme-change", onChange);
      mq.removeEventListener?.("change", onMq);
    };
  }, [theme]);

  return {
    theme,
    resolved: resolveTheme(theme),
    setTheme: (t: Theme) => {
      setTheme(t);
      setThemeState(t);
    },
  };
}

/** Script inline à injecter dans <head> pour éviter le flash clair→sombre. */
export const THEME_INIT_SCRIPT = `
(function(){try{
  var k='${STORAGE_KEY}';
  var t=localStorage.getItem(k)||'system';
  var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);
  if(d)document.documentElement.classList.add('dark');
}catch(e){}})();
`;
