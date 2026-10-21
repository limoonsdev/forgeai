import "server-only";
import { DEV_LOG, type Capacity, type ExecResult, type SandboxHandle, type SandboxProvider } from "./types";

/** Client for the Forged runner (the only process with Docker access), reachable on localhost only. */
const BASE = (process.env.RUNNER_URL || "http://127.0.0.1:4100").replace(/\/$/, "");

async function call<T>(method: string, path: string, body?: unknown, timeoutMs = 120_000): Promise<T> {
  const secret = process.env.RUNNER_SECRET;
  if (!secret) throw new Error("RUNNER_SECRET is not configured");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${secret}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
    cache: "no-store",
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw Object.assign(new Error(data.error || `runner ${res.status}`), { status: res.status });
  return data;
}

type Info = { id: string; running: boolean; port: number | null; previewUrl: string };

function handle(projectId: string, info: Info): SandboxHandle {
  const p = `/sandboxes/${projectId}`;
  return {
    id: info.id,
    previewUrl: info.previewUrl,
    root: "/app",
    async writeFiles(files) {
      if (!files.length) return;
      // Chunk large uploads to keep requests small.
      for (let i = 0; i < files.length; i += 200) await call("PUT", `${p}/files`, { files: files.slice(i, i + 200) });
    },
    async writeBinary(files: { path: string; base64: string }[]) {
      for (let i = 0; i < files.length; i += 20) {
        await call("PUT", `${p}/files`, { files: files.slice(i, i + 20).map((f) => ({ path: f.path, content: f.base64, encoding: "base64" })) });
      }
    },
    async deleteFiles(paths) {
      if (paths.length) await call("POST", `${p}/delete-files`, { paths });
    },
    async readFile(path) {
      return (await call<{ content: string | null }>("POST", `${p}/read-file`, { path })).content;
    },
    exec: (command, opts) => call<ExecResult>("POST", `${p}/exec`, { command, timeoutMs: opts?.timeoutMs ?? 120_000 }, (opts?.timeoutMs ?? 120_000) + 15_000),
    async startDevServer() {
      await call("POST", `${p}/dev-server`);
    },
    async waitForPort(timeoutMs = 60_000) {
      return (await call<{ up: boolean }>("POST", `${p}/wait-port`, { timeoutMs }, timeoutMs + 15_000)).up;
    },
    async httpGet(path, timeoutMs = 90_000) {
      return call<{ status: number; body: string }>("POST", `${p}/http-get`, { path, timeoutMs }, timeoutMs + 15_000);
    },
    async logs(lines) {
      return (await call<{ logs: string }>("GET", `${p}/logs?lines=${lines}`)).logs;
    },
    async keepAlive() {},
    async restart() {
      await call("POST", `${p}/restart`, undefined, 90_000);
    },
    async stop() {
      await call("DELETE", p);
    },
  } as SandboxHandle;
}

export const runnerProvider: SandboxProvider = {
  name: "runner",
  async create(projectId) {
    const info = await call<Info>("POST", `/sandboxes/${projectId}`, undefined, 120_000);
    return handle(projectId, info);
  },
  async connect(projectId) {
    try {
      const info = await call<Info & { running: boolean }>("GET", `/sandboxes/${projectId}`, undefined, 15_000);
      return info.running ? handle(projectId, info) : null;
    } catch {
      return null;
    }
  },
  capacity: () => call<Capacity>("GET", "/capacity", undefined, 10_000),
};

export const RUNNER_DEV_LOG = DEV_LOG;

export function runnerCall<T>(method: string, path: string, body?: unknown, timeoutMs?: number) {
  return call<T>(method, path, body, timeoutMs);
}
