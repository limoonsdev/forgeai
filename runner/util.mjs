// Shared helpers for the Forged runner (plain ESM, no build step).
import { timingSafeEqual } from "node:crypto";

export const env = (name, fallback) => {
  const v = process.env[name];
  return v === undefined || v === "" ? fallback : v;
};

export function log(...args) {
  console.log(new Date().toISOString(), "[runner]", ...args);
}

export function shellQuote(s) {
  return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

export function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Paths are confined to the project root. */
export function safeRelativePath(p) {
  const cleaned = String(p).replace(/\\/g, "/").replace(/^\.\/+/, "").replace(/\/+/g, "/").trim();
  if (!cleaned || cleaned.startsWith("/") || cleaned.length > 300) return null;
  const segments = cleaned.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "")) return null;
  if (["node_modules", ".next", ".git"].includes(segments[0])) return null;
  return cleaned;
}

export const PROJECT_ID_RE = /^[a-z0-9]{8,32}$/;
export const SUBDOMAIN_RE = /^(?!p-)[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export async function readBody(req, max = 60 * 1024 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > max) throw Object.assign(new Error("Body too large"), { status: 413 });
    chunks.push(c);
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  return raw ? JSON.parse(raw) : {};
}

export function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(body), "Cache-Control": "no-store" });
  res.end(body);
}
