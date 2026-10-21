// Forged runner: the only process with Docker access. The web app talks to it over 127.0.0.1 with a shared secret.
import http from "node:http";
import { enqueueDeployment, deploymentState, removeDeployment, resolveDeployment } from "./deployments.mjs";
import { startGateway } from "./gateway.mjs";
import {
  capacity,
  collectExec,
  createSandbox,
  DEV_LOG_PATH,
  devServerScript,
  ensureNetwork,
  getSandbox,
  httpGetScript,
  listSandboxes,
  putFiles,
  removeSandbox,
  waitPortScript,
  withSandbox,
} from "./sandboxes.mjs";
import { env, log, PROJECT_ID_RE, readBody, safeEqual, safeRelativePath, sendJson, shellQuote, SUBDOMAIN_RE } from "./util.mjs";

const SECRET = env("RUNNER_SECRET", "");
if (!SECRET || SECRET.length < 32) {
  console.error("RUNNER_SECRET (>= 32 chars) is required");
  process.exit(1);
}
const HOST = env("RUNNER_HOST", "127.0.0.1");
const PORT = Number(env("RUNNER_PORT", "4100"));
const GATEWAY_PORT = Number(env("GATEWAY_PORT", "4000"));

function validFiles(files) {
  if (!Array.isArray(files) || files.length > 3000) throw Object.assign(new Error("Invalid files"), { status: 400 });
  return files.map((f) => {
    const path = safeRelativePath(f.path);
    if (!path || typeof f.content !== "string") throw Object.assign(new Error(`Invalid file ${f.path}`), { status: 400 });
    return { path, content: f.content, encoding: f.encoding === "base64" ? "base64" : "utf8" };
  });
}

const routes = [
  ["GET", /^\/health$/, async () => ({ ok: true })],
  ["GET", /^\/capacity$/, async () => capacity()],
  ["GET", /^\/sandboxes$/, async () => ({ sandboxes: await listSandboxes() })],
  ["POST", /^\/sandboxes\/([a-z0-9]+)$/, async (m) => createSandbox(m[1])],
  ["GET", /^\/sandboxes\/([a-z0-9]+)$/, async (m) => (await getSandbox(m[1])) ?? { running: false }],
  ["DELETE", /^\/sandboxes\/([a-z0-9]+)$/, async (m) => (await removeSandbox(m[1]), { removed: true })],
  [
    "PUT",
    /^\/sandboxes\/([a-z0-9]+)\/files$/,
    async (m, body) => withSandbox(m[1], async (c) => (await putFiles(c, validFiles(body.files)), { written: body.files.length })),
  ],
  [
    "POST",
    /^\/sandboxes\/([a-z0-9]+)\/delete-files$/,
    async (m, body) =>
      withSandbox(m[1], async (c) => {
        const paths = (body.paths ?? []).map(safeRelativePath).filter(Boolean);
        if (paths.length) await collectExec(c, `rm -f ${paths.map(shellQuote).join(" ")}`, 10_000);
        return { deleted: paths.length };
      }),
  ],
  [
    "POST",
    /^\/sandboxes\/([a-z0-9]+)\/read-file$/,
    async (m, body) =>
      withSandbox(m[1], async (c) => {
        const path = safeRelativePath(body.path);
        if (!path) return { content: null };
        const r = await collectExec(c, `cat ${shellQuote(path)}`, 10_000);
        return { content: r.exitCode === 0 ? r.stdout : null };
      }),
  ],
  [
    "POST",
    /^\/sandboxes\/([a-z0-9]+)\/exec$/,
    async (m, body) => withSandbox(m[1], (c) => collectExec(c, String(body.command ?? ""), Math.min(Number(body.timeoutMs) || 120_000, 900_000))),
  ],
  ["POST", /^\/sandboxes\/([a-z0-9]+)\/dev-server$/, async (m) => withSandbox(m[1], (c) => collectExec(c, devServerScript(), 15_000))],
  [
    "POST",
    /^\/sandboxes\/([a-z0-9]+)\/restart$/,
    async (m) =>
      withSandbox(m[1], async (c) => {
        await collectExec(c, `if [ -f /tmp/forged-next.pid ]; then kill "$(cat /tmp/forged-next.pid)" 2>/dev/null; pkill -f "next-server" 2>/dev/null; sleep 1; fi; rm -f /tmp/forged-next.pid; rm -rf /app/.next/dev`, 15_000);
        await collectExec(c, devServerScript(), 15_000);
        const r = await collectExec(c, waitPortScript(60_000), 65_000);
        return { up: r.stdout.includes("up") };
      }),
  ],
  [
    "POST",
    /^\/sandboxes\/([a-z0-9]+)\/wait-port$/,
    async (m, body) => {
      const ms = Math.min(Number(body.timeoutMs) || 60_000, 120_000);
      return withSandbox(m[1], async (c) => ({ up: (await collectExec(c, waitPortScript(ms), ms + 5000)).stdout.includes("up") }));
    },
  ],
  [
    "POST",
    /^\/sandboxes\/([a-z0-9]+)\/http-get$/,
    async (m, body) => {
      const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path : "/";
      const ms = Math.min(Number(body.timeoutMs) || 90_000, 120_000);
      return withSandbox(m[1], async (c) => {
        const r = await collectExec(c, httpGetScript(path, ms), ms + 5000);
        const [status, ...rest] = r.stdout.split("\n");
        return { status: Number(status) || 0, body: rest.join("\n") };
      });
    },
  ],
  [
    "GET",
    /^\/sandboxes\/([a-z0-9]+)\/logs\?lines=(\d+)$/,
    async (m) => withSandbox(m[1], async (c) => ({ logs: (await collectExec(c, `tail -n ${Math.min(Number(m[2]) || 100, 1000)} ${DEV_LOG_PATH} 2>/dev/null`, 10_000)).stdout })),
  ],
  [
    "POST",
    /^\/deployments\/([a-z0-9-]+)$/,
    async (m, body) => {
      if (!SUBDOMAIN_RE.test(m[1])) throw Object.assign(new Error("Invalid subdomain"), { status: 400 });
      const position = enqueueDeployment({ subdomain: m[1], files: validFiles(body.files), env: body.env ?? {} });
      return { queued: true, position };
    },
  ],
  [
    "GET",
    /^\/deployments\/([a-z0-9-]+)$/,
    async (m) => {
      const state = deploymentState(m[1]);
      const live = await resolveDeployment(m[1]);
      return { status: state?.status ?? (live ? "live" : "stopped"), log: state?.log ?? "", live: Boolean(live) };
    },
  ],
  ["DELETE", /^\/deployments\/([a-z0-9-]+)$/, async (m) => (await removeDeployment(m[1]), { removed: true })],
];

const server = http.createServer(async (req, res) => {
  try {
    const auth = req.headers.authorization ?? "";
    if (!auth.startsWith("Bearer ") || !safeEqual(auth.slice(7), SECRET)) return sendJson(res, 401, { error: "unauthorized" });
    for (const [method, re, handler] of routes) {
      if (req.method !== method) continue;
      const m = req.url.match(re);
      if (!m) continue;
      if (m[1] && /^\/sandboxes\//.test(req.url) && !PROJECT_ID_RE.test(m[1])) return sendJson(res, 400, { error: "invalid project id" });
      const body = method === "GET" || method === "DELETE" ? {} : await readBody(req, /^\/deployments\//.test(req.url) ? 320 * 1024 * 1024 : undefined);
      return sendJson(res, 200, await handler(m, body));
    }
    sendJson(res, 404, { error: "not found" });
  } catch (err) {
    const status = err.status ?? 500;
    if (status >= 500) log("error", req.method, req.url, err.message);
    sendJson(res, status, { error: status >= 500 ? "runner error" : err.message });
  }
});

await ensureNetwork().catch((err) => log("network setup failed:", err.message));
server.listen(PORT, HOST, () => log(`control API on ${HOST}:${PORT}`));
startGateway(GATEWAY_PORT, env("GATEWAY_HOST", "127.0.0.1"));

for (const sig of ["SIGTERM", "SIGINT"]) process.on(sig, () => process.exit(0));
