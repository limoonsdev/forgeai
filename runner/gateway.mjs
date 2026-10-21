// Reverse proxy for previews (p-<projectId>.<preview domain>) and published apps (<sub>.<deploy domain>).
import http from "node:http";
import net from "node:net";
import { resolveDeployment } from "./deployments.mjs";
import { getSandbox } from "./sandboxes.mjs";
import { env, log, PROJECT_ID_RE, SUBDOMAIN_RE } from "./util.mjs";

const PREVIEW_DOMAIN = env("FORGED_PREVIEW_DOMAIN", "").toLowerCase();
const DEPLOY_DOMAIN = env("FORGED_DEPLOY_DOMAIN", PREVIEW_DOMAIN).toLowerCase();
const APP_URL = env("NEXT_PUBLIC_APP_URL", "https://forged.dev");
const TRUST_CF = env("TRUST_CLOUDFLARE", "0") === "1";
const RESERVED = new Set(["www", "app", "api", "admin", "mail", "smtp", "ftp", "status", "docs", "blog", "cdn", "static", "assets", "auth", "login"]);

const cache = new Map(); // host -> { target, at }
async function resolveTarget(host) {
  const hit = cache.get(host);
  if (hit && Date.now() - hit.at < 5000) return hit.target;
  let target = null;
  if (PREVIEW_DOMAIN && host.endsWith(`.${PREVIEW_DOMAIN}`)) {
    const label = host.slice(0, -PREVIEW_DOMAIN.length - 1);
    const m = label.match(/^p-([a-z0-9]+)$/);
    if (m && PROJECT_ID_RE.test(m[1])) {
      const sbx = await getSandbox(m[1]).catch(() => null);
      target = { kind: "preview", port: sbx?.port ?? null };
    }
  }
  if (!target && DEPLOY_DOMAIN && host.endsWith(`.${DEPLOY_DOMAIN}`)) {
    const sub = host.slice(0, -DEPLOY_DOMAIN.length - 1);
    if (SUBDOMAIN_RE.test(sub) && !RESERVED.has(sub)) {
      const dep = await resolveDeployment(sub).catch(() => null);
      target = { kind: "deploy", port: dep?.port ?? null, sub };
    }
  }
  cache.set(host, { target, at: Date.now() });
  return target;
}

/* Per-IP token buckets (layer-7 flood protection in addition to Caddy/Cloudflare). */
const buckets = new Map();
function allow(ip, kind) {
  const cap = kind === "preview" ? 900 : 400; // requests per 10s window
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b || now - b.start > 10_000) {
    b = { start: now, count: 0 };
    buckets.set(ip, b);
  }
  b.count++;
  return b.count <= cap;
}
setInterval(() => {
  const now = Date.now();
  for (const [k, b] of buckets) if (now - b.start > 20_000) buckets.delete(k);
  if (cache.size > 5000) cache.clear();
}, 30_000).unref();

function clientIp(req) {
  if (TRUST_CF && req.headers["cf-connecting-ip"]) return String(req.headers["cf-connecting-ip"]);
  const remote = req.socket.remoteAddress ?? "";
  if ((remote === "127.0.0.1" || remote === "::1" || remote === "::ffff:127.0.0.1") && req.headers["x-forwarded-for"]) {
    return String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  }
  return remote;
}

function page(res, status, title, body) {
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0f0d0c;color:#f3ede6;font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif}main{max-width:420px;padding:32px;text-align:center}h1{font-size:20px;margin:0 0 8px;letter-spacing:-.01em}p{color:#a39a91;margin:0 0 20px}a{color:#ff7a33}</style></head>
<body><main><h1>${title}</h1><p>${body}</p><a href="${APP_URL}">Forged.dev</a></main></body></html>`;
  res.writeHead(status, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "X-Robots-Tag": "noindex" });
  res.end(html);
}

const BADGE = `<a href="${APP_URL}/?ref=badge" target="_blank" rel="noopener" style="position:fixed;right:12px;bottom:12px;z-index:2147483647;display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;background:#141110;color:#f3ede6;font:600 12px/1 -apple-system,Segoe UI,Roboto,sans-serif;text-decoration:none;box-shadow:0 4px 20px rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.1)"><span style="width:8px;height:8px;border-radius:2px;background:#f2541b;display:inline-block"></span>Built with Forged</a>`;

/** Previews talk to `next dev`, which only trusts localhost origins for its dev endpoints (HMR). */
function rewriteForPreview(headers) {
  const out = { ...headers, host: "localhost:3000" };
  if (out.origin) out.origin = "http://localhost:3000";
  if (out.referer) {
    try {
      const u = new URL(String(out.referer));
      out.referer = `http://localhost:3000${u.pathname}${u.search}`;
    } catch {
      delete out.referer;
    }
  }
  return out;
}

function proxy(req, res, target) {
  let headers = { ...req.headers, "x-forwarded-host": req.headers.host, "x-forwarded-proto": "https" };
  if (target.kind === "preview") headers = rewriteForPreview(headers);
  if (target.kind === "deploy") headers["accept-encoding"] = "identity";
  const upstream = http.request({ host: "127.0.0.1", port: target.port, method: req.method, path: req.url, headers, timeout: 120_000 }, (up) => {
    const out = { ...up.headers };
    delete out["x-powered-by"];
    out["x-content-type-options"] = "nosniff";
    out["referrer-policy"] ??= "strict-origin-when-cross-origin";
    if (target.kind === "preview") out["x-robots-tag"] = "noindex, nofollow";
    const type = String(up.headers["content-type"] ?? "");
    if (target.kind === "deploy" && type.includes("text/html") && !up.headers["content-encoding"] && req.method === "GET") {
      const chunks = [];
      let size = 0;
      up.on("data", (c) => {
        size += c.length;
        if (size < 8 * 1024 * 1024) chunks.push(c);
      });
      up.on("end", () => {
        let body = Buffer.concat(chunks).toString("utf8");
        body = body.includes("</body>") ? body.replace(/<\/body>(?![\s\S]*<\/body>)/, `${BADGE}</body>`) : body + BADGE;
        delete out["content-length"];
        delete out["transfer-encoding"];
        out["content-length"] = String(Buffer.byteLength(body));
        res.writeHead(up.statusCode ?? 200, out);
        res.end(body);
      });
      return;
    }
    res.writeHead(up.statusCode ?? 502, out);
    up.pipe(res);
  });
  upstream.on("timeout", () => upstream.destroy(new Error("timeout")));
  upstream.on("error", () => {
    if (!res.headersSent) page(res, 502, "Starting up…", target.kind === "preview" ? "The dev server is restarting. Refresh in a few seconds." : "This app is restarting. Try again in a moment.");
    else res.destroy();
  });
  req.pipe(upstream);
}

export function startGateway(port, host = "127.0.0.1") {
  const server = http.createServer(async (req, res) => {
    const hostHeader = String(req.headers.host ?? "").toLowerCase().split(":")[0];
    const target = await resolveTarget(hostHeader);
    if (!target) return page(res, 404, "Not found", "There is nothing at this address.");
    if (!allow(clientIp(req), target.kind)) {
      res.writeHead(429, { "Retry-After": "10", "Content-Type": "text/plain" });
      return res.end("Too many requests");
    }
    if (!target.port) {
      return target.kind === "preview"
        ? page(res, 503, "This preview is asleep", "Open the project in Forged to wake its VM up.")
        : page(res, 404, "Not published", "This app isn't published right now.");
    }
    proxy(req, res, target);
  });

  // WebSocket upgrades (Next.js HMR in previews).
  server.on("upgrade", async (req, socket, head) => {
    const hostHeader = String(req.headers.host ?? "").toLowerCase().split(":")[0];
    const target = await resolveTarget(hostHeader).catch(() => null);
    if (!target?.port || !allow(clientIp(req), target.kind)) return socket.destroy();
    const headers = target.kind === "preview" ? rewriteForPreview(req.headers) : req.headers;
    const upstream = net.connect(target.port, "127.0.0.1", () => {
      const lines = [`${req.method} ${req.url} HTTP/1.1`, ...Object.entries(headers).map(([k, v]) => `${k}: ${v}`), "", ""];
      upstream.write(lines.join("\r\n"));
      if (head?.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });

  server.headersTimeout = 30_000;
  server.requestTimeout = 300_000;
  server.keepAliveTimeout = 65_000;
  server.listen(port, host, () => log(`gateway listening on ${host}:${port} (previews: *.${PREVIEW_DOMAIN || "-"}, apps: *.${DEPLOY_DOMAIN || "-"})`));
  return server;
}
