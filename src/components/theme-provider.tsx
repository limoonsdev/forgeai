"use client";

import * as React from "react";

export type Theme = "dark" | "light" | "system";
const STORAGE_KEY = "forged-theme";

type Ctx = { theme: Theme; resolved: "dark" | "light"; setTheme: (t: Theme) => void };
const ThemeContext = React.createContext<Ctx | null>(null);

function resolve(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}

/** Inline script injected in <head> so the correct theme is applied before first paint. */
export const themeScript = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}')||'dark';var r=t==='system'?(matchMedia('(prefers-color-scheme: light)').matches?'light':'dark'):t;var c=document.documentElement.classList;r==='dark'?c.add('dark'):c.remove('dark');}catch(e){document.documentElement.classList.add('dark')}})();`;

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<Theme>("dark");
  const [resolved, setResolved] = React.useState<"dark" | "light">("dark");

  React.useEffect(() => {
    let stored: Theme = "dark";
    try {
      stored = (localStorage.getItem(STORAGE_KEY) as Theme) || "dark";
    } catch {}
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hydrate from localStorage once on mount
    setThemeState(stored);
    setResolved(resolve(stored));
  }, []);

  const setTheme = React.useCallback((t: Theme) => {
    setThemeState(t);
    const r = resolve(t);
    setResolved(r);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
    document.documentElement.classList.toggle("dark", r === "dark");
  }, []);

  return <ThemeContext.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = React.useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside ThemeProvider");
  return ctx;
}
