import "server-only";
import dns from "node:dns";
import net from "node:net";
import ipaddr from "ipaddr.js";
import { Agent, fetch as undiciFetch } from "undici";

/**
 * SSRF-safe HTTP client for every server-side fetch of a user-supplied URL
 * (web_fetch tool, favicons, skill imports, Figma/GitHub downloads…).
 * The IP is validated at connect time, so DNS rebinding cannot reach internal services.
 */

export class UnsafeUrlError extends Error {}

export function isPublicIp(ip: string) {
  try {
    const addr = ipaddr.process(ip);
    return addr.range() === "unicast";
  } catch {
    return false;
  }
}

function safeLookup(
  hostname: string,
  options: dns.LookupOptions,
  callback: (err: NodeJS.ErrnoException | null, address: string | dns.LookupAddress[], family?: number) => void,
) {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "", 4);
    const list = (addresses as dns.LookupAddress[]).filter((a) => isPublicIp(a.address));
    if (!list.length) return callback(Object.assign(new Error(`Blocked non-public address for ${hostname}`), { code: "EBLOCKED" }), "", 4);
    if (options.all) return callback(null, list);
    callback(null, list[0].address, list[0].family);
  });
}

const agent = new Agent({
  connect: { lookup: safeLookup as never, timeout: 8000 },
  headersTimeout: 15_000,
  bodyTimeout: 20_000,
});

export type SafeFetchOptions = {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  maxBytes?: number;
  timeoutMs?: number;
  allowHttp?: boolean;
  maxRedirects?: number;
};

export async function safeFetch(input: string, opts: SafeFetchOptions = {}) {
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }
  const maxRedirects = opts.maxRedirects ?? 4;
  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (url.protocol !== "https:" && !(opts.allowHttp && url.protocol === "http:")) throw new UnsafeUrlError("Only https URLs are allowed");
    if (url.username || url.password) throw new UnsafeUrlError("Credentials in URLs are not allowed");
    if (net.isIP(url.hostname) && !isPublicIp(url.hostname)) throw new UnsafeUrlError("Private addresses are not allowed");
    if (/^(localhost|.*\.local|.*\.internal|.*\.localhost)$/i.test(url.hostname)) throw new UnsafeUrlError("Local hosts are not allowed");
    const res = await undiciFetch(url, {
      method: opts.method ?? "GET",
      headers: { "User-Agent": "ForgedBot/1.0 (+https://forged.dev)", ...opts.headers },
      body: opts.body,
      redirect: "manual",
      dispatcher: agent,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 15_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      await res.body?.cancel();
      continue;
    }
    const max = opts.maxBytes ?? 2_000_000;
    const declared = Number(res.headers.get("content-length") || 0);
    if (declared > max) {
      await res.body?.cancel();
      throw new UnsafeUrlError(`Response too large (${declared} bytes)`);
    }
    const chunks: Uint8Array[] = [];
    let total = 0;
    if (res.body) {
      for await (const chunk of res.body) {
        total += chunk.byteLength;
        if (total > max) throw new UnsafeUrlError("Response too large");
        chunks.push(chunk);
      }
    }
    const buffer = Buffer.concat(chunks);
    return { status: res.status, ok: res.ok, url: url.toString(), headers: res.headers, buffer, text: () => buffer.toString("utf8") };
  }
  throw new UnsafeUrlError("Too many redirects");
}
