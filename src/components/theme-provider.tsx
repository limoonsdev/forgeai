"use client";

import * as React from "react";
import { THEME_KEY as STORAGE_KEY } from "@/lib/theme-script";

export type Theme = "dark" | "light" | "system";

type Ctx = { theme: Theme; resolved: "dark" | "light"; setTheme: (t: Theme) => void };
const ThemeContext = React.createContext<Ctx | null>(null);

function resolve(theme: Theme): "dark" | "light" {
  if (theme === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }
  return theme;
}


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
