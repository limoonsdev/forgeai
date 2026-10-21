import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Credits are stored as integer micro-dollars (1 USD = 1_000_000). */
export const MICROS_PER_USD = 1_000_000;

export function usdToMicros(usd: number) {
  return Math.round(usd * MICROS_PER_USD);
}

export function formatCredits(micros: number, opts: { precise?: boolean } = {}) {
  const usd = micros / MICROS_PER_USD;
  const abs = Math.abs(usd);
  const digits = opts.precise ? (abs > 0 && abs < 0.01 ? 4 : 2) : 2;
  return `${usd < 0 ? "-" : ""}$${abs.toFixed(digits)}`;
}

export function formatTokens(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
}

export function timeAgo(date: Date | string | number) {
  const d = new Date(date).getTime();
  const s = Math.max(1, Math.floor((Date.now() - d) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(date).toLocaleDateString();
}

export function slugify(input: string) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

export function absoluteUrl(path = "") {
  const base = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
