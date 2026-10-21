import { safeFetch } from "@/lib/server/safe-fetch";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/api";

/**
 * Favicon proxy for links typed in the prompt box. Keeps visitors' IPs and prompts away from
 * third-party favicon services and lets the CSP stay `img-src 'self'`.
 * Only raster formats are returned (never SVG, which could carry script on direct navigation).
 */

const HOST_RE = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/i;
const MAX_BYTES = 256 * 1024;
const TTL = 24 * 3600_000;

type Entry = { data: Buffer | null; mime: string; at: number };
declare global {
  var __forgedFavicons: Map<string, Entry> | undefined;
}
const cache = (globalThis.__forgedFavicons ??= new Map());

const FALLBACK = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#7d8da6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;

function sniff(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x00 && buf[1] === 0x00 && (buf[2] === 0x01 || buf[2] === 0x02) && buf[3] === 0x00) return "image/x-icon";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 4).toString("latin1") === "GIF8") return "image/gif";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

async function tryImage(url: string): Promise<{ data: Buffer; mime: string } | null> {
  try {
    const res = await safeFetch(url, { maxBytes: MAX_BYTES, timeoutMs: 5000, maxRedirects: 3, headers: { Accept: "image/*" } });
    if (!res.ok) return null;
    const mime = sniff(res.buffer);
    return mime ? { data: res.buffer, mime } : null;
  } catch {
    return null;
  }
}

async function resolveFavicon(host: string): Promise<{ data: Buffer; mime: string } | null> {
  const direct = await tryImage(`https://${host}/favicon.ico`);
  if (direct) return direct;
  try {
    const page = await safeFetch(`https://${host}/`, { maxBytes: 512 * 1024, timeoutMs: 6000, maxRedirects: 3, headers: { Accept: "text/html" } });
    const html = page.text().slice(0, 200_000);
    const links = [...html.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]);
    const candidates = links
      .filter((l) => /\brel\s*=\s*["']?[^"'>]*\b(icon|apple-touch-icon)\b/i.test(l))
      .map((l) => l.match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1])
      .filter((h): h is string => Boolean(h) && !/\.svg(\?|$)/i.test(h!) && !h!.startsWith("data:"));
    for (const href of candidates.slice(0, 4)) {
      const abs = new URL(href, page.url).toString();
      const img = await tryImage(abs);
      if (img) return img;
    }
  } catch {}
  return null;
}

function respond(entry: Entry) {
  const headers = {
    "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
  };
  if (!entry.data) return new Response(FALLBACK, { headers: { ...headers, "Content-Type": "image/svg+xml" } });
  return new Response(new Uint8Array(entry.data), { headers: { ...headers, "Content-Type": entry.mime } });
}

export async function GET(req: Request) {
  const host = (new URL(req.url).searchParams.get("host") || "").toLowerCase().replace(/\.$/, "");
  if (!HOST_RE.test(host)) return respond({ data: null, mime: "", at: 0 });

  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < TTL) return respond(hit);

  const limit = rateLimit(`favicon:${clientIp(req) ?? "unknown"}`, 60, 60_000);
  if (!limit.ok) return respond({ data: null, mime: "", at: 0 });

  const found = await resolveFavicon(host);
  const entry: Entry = { data: found?.data ?? null, mime: found?.mime ?? "", at: Date.now() };
  if (cache.size > 3000) cache.delete(cache.keys().next().value!);
  cache.set(host, entry);
  return respond(entry);
}
