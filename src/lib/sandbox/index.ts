import "server-only";
import fs from "node:fs";
import { eq, and, lt, isNotNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { projects, projectFiles } from "@/lib/db/schema";
import type { SandboxHandle, SandboxProvider } from "./types";

export type { SandboxHandle } from "./types";
export { safeRelativePath } from "./types";

let providerCache: SandboxProvider | null | undefined;

export async function getSandboxProvider(): Promise<SandboxProvider | null> {
  if (providerCache !== undefined) return providerCache;
  const configured = process.env.FORGED_SANDBOX_PROVIDER || (process.env.E2B_API_KEY ? "e2b" : "docker");
  if (configured === "none") return (providerCache = null);
  if (configured === "e2b") {
    if (!process.env.E2B_API_KEY) {
      console.warn("[sandbox] FORGED_SANDBOX_PROVIDER=e2b but E2B_API_KEY is missing — previews disabled");
      return (providerCache = null);
    }
    const { e2bProvider } = await import("./e2b");
    return (providerCache = e2bProvider);
  }
  const socket = process.env.DOCKER_SOCKET || "/var/run/docker.sock";
  if (!process.env.DOCKER_HOST && !fs.existsSync(/*turbopackIgnore: true*/ socket)) {
    console.warn(`[sandbox] Docker socket ${socket} not found — previews disabled`);
    return (providerCache = null);
  }
  const { dockerProvider } = await import("./docker");
  return (providerCache = dockerProvider);
}

/* ── live handle cache + per-project locks ── */

declare global {
  var __forgedSandboxes: Map<string, { handle: SandboxHandle; provider: string }> | undefined;
  var __forgedSandboxLocks: Map<string, Promise<SandboxHandle | null>> | undefined;
  var __forgedReaper: NodeJS.Timeout | undefined;
}
const live = (globalThis.__forgedSandboxes ??= new Map());
const locks = (globalThis.__forgedSandboxLocks ??= new Map());

type Notify = (e: { status: string; previewUrl?: string | null; message?: string }) => void;

async function setSandboxState(projectId: string, patch: Partial<typeof projects.$inferInsert>) {
  await db.update(projects).set(patch).where(eq(projects.id, projectId));
}

/** Returns the running sandbox of a project without creating one. */
export async function getLiveSandbox(projectId: string): Promise<SandboxHandle | null> {
  const cached = live.get(projectId);
  if (cached) return cached.handle;
  const provider = await getSandboxProvider();
  if (!provider) return null;
  const [p] = await db
    .select({ sandboxId: projects.sandboxId, sandboxProvider: projects.sandboxProvider })
    .from(projects)
    .where(eq(projects.id, projectId));
  if (!p?.sandboxId || p.sandboxProvider !== provider.name) return null;
  const handle = await provider.connect(p.sandboxId);
  if (handle) live.set(projectId, { handle, provider: provider.name });
  return handle;
}

/**
 * Makes sure the project has a running VM with all files synced and `next dev` started.
 * Concurrent callers share the same boot.
 */
export function ensureSandbox(projectId: string, notify?: Notify): Promise<SandboxHandle | null> {
  const pending = locks.get(projectId);
  if (pending) return pending;
  const p = boot(projectId, notify).finally(() => locks.delete(projectId));
  locks.set(projectId, p);
  return p;
}

async function boot(projectId: string, notify?: Notify): Promise<SandboxHandle | null> {
  const provider = await getSandboxProvider();
  if (!provider) {
    notify?.({ status: "error", message: "No sandbox provider configured — previews are disabled on this server." });
    return null;
  }
  startReaper();

  const existing = await getLiveSandbox(projectId);
  if (existing) {
    try {
      await existing.keepAlive();
      await existing.startDevServer();
      await existing.waitForPort(30_000);
      await setSandboxState(projectId, { sandboxStatus: "running", sandboxLastActiveAt: new Date(), previewUrl: existing.previewUrl });
      notify?.({ status: "running", previewUrl: existing.previewUrl });
      return existing;
    } catch {
      live.delete(projectId);
    }
  }

  await setSandboxState(projectId, { sandboxStatus: "starting" });
  notify?.({ status: "starting", message: "Booting your VM…" });
  try {
    const handle = await provider.create(projectId);
    live.set(projectId, { handle, provider: provider.name });
    const files = await db
      .select({ path: projectFiles.path, content: projectFiles.content })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));
    const baked = await handle.readFile("package.json");
    await handle.writeFiles(files);
    const pkg = files.find((f) => f.path === "package.json");
    if (pkg && baked !== null && normalizeJson(baked) !== normalizeJson(pkg.content)) {
      notify?.({ status: "starting", message: "Installing dependencies…" });
      const r = await handle.exec("npm install --no-audit --no-fund --loglevel=error", { timeoutMs: 300_000 });
      if (r.exitCode !== 0) console.warn("[sandbox] npm install failed", r.stderr.slice(-2000));
    }
    notify?.({ status: "starting", message: "Starting the Next.js dev server…" });
    await handle.startDevServer();
    await handle.waitForPort(60_000);
    await setSandboxState(projectId, {
      sandboxId: handle.id,
      sandboxProvider: provider.name,
      sandboxStatus: "running",
      previewUrl: handle.previewUrl,
      sandboxLastActiveAt: new Date(),
    });
    notify?.({ status: "running", previewUrl: handle.previewUrl });
    return handle;
  } catch (err) {
    console.error("[sandbox] boot failed", err);
    await setSandboxState(projectId, { sandboxStatus: "error" });
    notify?.({ status: "error", message: `Could not start the VM: ${(err as Error).message}` });
    return null;
  }
}

function normalizeJson(s: string) {
  try {
    return JSON.stringify(JSON.parse(s));
  } catch {
    return s;
  }
}

export async function stopSandbox(projectId: string) {
  const handle = await getLiveSandbox(projectId);
  live.delete(projectId);
  if (handle) await handle.stop();
  await setSandboxState(projectId, { sandboxStatus: "stopped", sandboxId: null, previewUrl: null });
}

export async function touchSandbox(projectId: string) {
  await setSandboxState(projectId, { sandboxLastActiveAt: new Date() });
}

/** Best-effort file sync to a running VM (DB stays the source of truth). */
export async function syncToSandbox(projectId: string, changes: { write?: { path: string; content: string }[]; remove?: string[] }) {
  const handle = await getLiveSandbox(projectId).catch(() => null);
  if (!handle) return false;
  try {
    if (changes.write?.length) await handle.writeFiles(changes.write);
    if (changes.remove?.length) await handle.deleteFiles(changes.remove);
    return true;
  } catch (err) {
    console.warn("[sandbox] sync failed", (err as Error).message);
    live.delete(projectId);
    return false;
  }
}

const IDLE_MS = Number(process.env.FORGED_SANDBOX_IDLE_MIN || 30) * 60_000;

function startReaper() {
  if (globalThis.__forgedReaper) return;
  globalThis.__forgedReaper = setInterval(() => {
    reapIdleSandboxes().catch((err) => console.warn("[sandbox] reaper", err));
  }, 5 * 60_000);
  globalThis.__forgedReaper.unref?.();
}

export async function reapIdleSandboxes() {
  const idle = await db
    .select({ id: projects.id })
    .from(projects)
    .where(
      and(
        isNotNull(projects.sandboxId),
        eq(projects.sandboxStatus, "running"),
        lt(projects.sandboxLastActiveAt, new Date(Date.now() - IDLE_MS)),
      ),
    );
  for (const p of idle) {
    await stopSandbox(p.id).catch(() => {});
  }
}
