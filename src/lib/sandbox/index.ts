import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { projectAssets, projectFiles, projects, user, vmQueue } from "@/lib/db/schema";
import { planLimits } from "@/lib/config";
import type { Capacity, SandboxHandle, SandboxProvider } from "./types";

export type { SandboxHandle } from "./types";
export { safeRelativePath } from "./types";

let providerCache: SandboxProvider | null | undefined;

export async function getSandboxProvider(): Promise<SandboxProvider | null> {
  if (providerCache !== undefined) return providerCache;
  const configured = process.env.FORGED_SANDBOX_PROVIDER || (process.env.E2B_API_KEY ? "e2b" : "runner");
  if (configured === "none") return (providerCache = null);
  if (configured === "e2b") {
    if (!process.env.E2B_API_KEY) return (providerCache = null);
    const { e2bProvider } = await import("./e2b");
    return (providerCache = e2bProvider);
  }
  if (!process.env.RUNNER_SECRET) {
    console.warn("[sandbox] RUNNER_SECRET missing — previews disabled");
    return (providerCache = null);
  }
  const { runnerProvider } = await import("./runner");
  return (providerCache = runnerProvider);
}

/* ── live handle cache ── */

declare global {
  var __forgedSandboxes: Map<string, SandboxHandle> | undefined;
  var __forgedBooting: Map<string, Promise<SandboxHandle | null>> | undefined;
  var __forgedScheduler: NodeJS.Timeout | undefined;
}
const live = (globalThis.__forgedSandboxes ??= new Map());
const booting = (globalThis.__forgedBooting ??= new Map());

const IDLE_MS = Number(process.env.FORGED_SANDBOX_IDLE_MIN || 30) * 60_000;
/** When people are waiting, idle VMs are recycled much sooner. */
const IDLE_MS_UNDER_PRESSURE = Number(process.env.FORGED_SANDBOX_IDLE_PRESSURE_MIN || 4) * 60_000;
const BOOT_SECONDS = 25;

async function setState(projectId: string, patch: Partial<typeof projects.$inferInsert>) {
  await db.update(projects).set(patch).where(eq(projects.id, projectId));
}

export async function getLiveSandbox(projectId: string): Promise<SandboxHandle | null> {
  const cached = live.get(projectId);
  if (cached) return cached;
  const provider = await getSandboxProvider();
  if (!provider) return null;
  const [p] = await db.select({ sandboxId: projects.sandboxId, sandboxProvider: projects.sandboxProvider }).from(projects).where(eq(projects.id, projectId));
  if (!p?.sandboxId || p.sandboxProvider !== provider.name) return null;
  const handle = await provider.connect(projectId, p.sandboxId);
  if (handle) live.set(projectId, handle);
  return handle;
}

async function boot(projectId: string): Promise<SandboxHandle | null> {
  const provider = await getSandboxProvider();
  if (!provider) return null;
  await setState(projectId, { sandboxStatus: "starting" });
  try {
    const handle = await provider.create(projectId);
    live.set(projectId, handle);
    const files = await db.select({ path: projectFiles.path, content: projectFiles.content }).from(projectFiles).where(eq(projectFiles.projectId, projectId));
    const assets = await db.select({ path: projectAssets.path, data: projectAssets.data }).from(projectAssets).where(eq(projectAssets.projectId, projectId));
    const baked = await handle.readFile("package.json");
    await handle.writeFiles(files);
    if (assets.length) await handle.writeBinary(assets.map((a) => ({ path: a.path, base64: Buffer.from(a.data).toString("base64") })));
    await writeConnectorEnv(projectId, handle);
    const pkg = files.find((f) => f.path === "package.json");
    if (pkg && baked !== null && normalizeJson(baked) !== normalizeJson(pkg.content)) {
      const r = await handle.exec("npm install --no-audit --no-fund --loglevel=error", { timeoutMs: 300_000 });
      if (r.exitCode !== 0) console.warn("[sandbox] npm install failed", r.stderr.slice(-1000));
    }
    await handle.startDevServer();
    await handle.waitForPort(60_000);
    await setState(projectId, { sandboxId: handle.id, sandboxProvider: provider.name, sandboxStatus: "running", previewUrl: handle.previewUrl, sandboxLastActiveAt: new Date() });
    return handle;
  } catch (err) {
    console.error("[sandbox] boot failed", (err as Error).message);
    live.delete(projectId);
    await setState(projectId, { sandboxStatus: "error" });
    return null;
  }
}

/** Writes the user's connector secrets as .env.local inside the VM only (never stored in project files). */
async function writeConnectorEnv(projectId: string, handle: SandboxHandle) {
  const { connectorEnvForProject } = await import("@/lib/connectors");
  const vars = await connectorEnvForProject(projectId);
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${JSON.stringify(v)}`);
  if (lines.length) await handle.writeFiles([{ path: ".env.local", content: `# Injected by Forged from your connectors. Not part of your project files.\n${lines.join("\n")}\n` }]);
}

function normalizeJson(s: string) {
  try {
    return JSON.stringify(JSON.parse(s));
  } catch {
    return s;
  }
}

/* ── capacity & queue ── */

let capCache: { at: number; value: Capacity } | null = null;
async function capacity(provider: SandboxProvider): Promise<Capacity> {
  if (capCache && Date.now() - capCache.at < 2000) return capCache.value;
  const value = await provider.capacity().catch(() => ({ maxVms: 1, running: 0, available: false, overloaded: true }));
  capCache = { at: Date.now(), value };
  return value;
}

export type QueueInfo = { position: number; etaSeconds: number; ahead: number };

export async function queueInfo(projectId: string): Promise<QueueInfo | null> {
  const rows = await db.select({ projectId: vmQueue.projectId }).from(vmQueue).orderBy(desc(vmQueue.priority), asc(vmQueue.enqueuedAt));
  const idx = rows.findIndex((r) => r.projectId === projectId);
  if (idx < 0) return null;
  // Estimate: when will the (idx+1)-th slot free up? Idle VMs are recycled after IDLE_MS_UNDER_PRESSURE.
  const running = await db
    .select({ last: projects.sandboxLastActiveAt })
    .from(projects)
    .where(and(eq(projects.sandboxStatus, "running"), isNotNull(projects.sandboxId)));
  const now = Date.now();
  const freesIn = running.map((r) => Math.max(15, (IDLE_MS_UNDER_PRESSURE - (now - (r.last?.getTime() ?? now))) / 1000)).sort((a, b) => a - b);
  const slot = freesIn[idx] ?? (freesIn.at(-1) ?? 60) + (idx - freesIn.length + 1) * 90;
  return { position: idx + 1, ahead: idx, etaSeconds: Math.round(slot + BOOT_SECONDS) };
}

/**
 * Requests a VM for a project without blocking: boots it when the server has room,
 * otherwise queues it (priority by plan) and returns the queue position with an ETA.
 */
export async function requestSandbox(projectId: string): Promise<{ status: "running" | "starting" | "queued" | "unavailable"; previewUrl?: string | null; queue?: QueueInfo }> {
  const provider = await getSandboxProvider();
  if (!provider) return { status: "unavailable" };
  startScheduler();
  const existing = await getLiveSandbox(projectId).catch(() => null);
  if (existing) {
    await setState(projectId, { sandboxStatus: "running", sandboxLastActiveAt: new Date(), previewUrl: existing.previewUrl });
    return { status: "running", previewUrl: existing.previewUrl };
  }
  if (booting.has(projectId)) return { status: "starting" };
  const [head] = await db.select({ projectId: vmQueue.projectId }).from(vmQueue).orderBy(desc(vmQueue.priority), asc(vmQueue.enqueuedAt)).limit(1);
  const cap = await capacity(provider);
  if (cap.available && (!head || head.projectId === projectId)) {
    await db.delete(vmQueue).where(eq(vmQueue.projectId, projectId));
    startBoot(projectId);
    return { status: "starting" };
  }
  const [owner] = await db.select({ userId: projects.userId, plan: user.plan }).from(projects).innerJoin(user, eq(user.id, projects.userId)).where(eq(projects.id, projectId));
  if (owner) {
    await db
      .insert(vmQueue)
      .values({ projectId, userId: owner.userId, priority: planLimits(owner.plan).queuePriority })
      .onConflictDoNothing();
  }
  await setState(projectId, { sandboxStatus: "queued" });
  await reapIdleSandboxes(IDLE_MS_UNDER_PRESSURE);
  return { status: "queued", queue: (await queueInfo(projectId)) ?? undefined };
}

function startBoot(projectId: string) {
  if (booting.has(projectId)) return booting.get(projectId)!;
  const p = boot(projectId).finally(() => booting.delete(projectId));
  booting.set(projectId, p);
  return p;
}

type Notify = (e: { status: string; previewUrl?: string | null; message?: string }) => void;

/** Blocking variant used by the agent: waits in the queue (reporting progress) until the VM is ready. */
export async function ensureSandbox(projectId: string, notify?: Notify, signal?: AbortSignal): Promise<SandboxHandle | null> {
  const deadline = Date.now() + 15 * 60_000;
  let lastNote = "";
  while (Date.now() < deadline && !signal?.aborted) {
    const r = await requestSandbox(projectId);
    if (r.status === "unavailable") {
      notify?.({ status: "error", message: "No VM provider is configured on this server." });
      return null;
    }
    if (r.status === "running") {
      const h = await getLiveSandbox(projectId);
      if (h) {
        await h.startDevServer().catch(() => {});
        notify?.({ status: "running", previewUrl: h.previewUrl });
        return h;
      }
    }
    if (r.status === "starting") {
      const note = "Booting your VM…";
      if (note !== lastNote) notify?.({ status: "starting", message: (lastNote = note) });
      const h = await booting.get(projectId);
      if (h) {
        notify?.({ status: "running", previewUrl: h.previewUrl });
        return h;
      }
      if (h === null) {
        notify?.({ status: "error", message: "The VM could not start." });
        return null;
      }
    }
    if (r.status === "queued" && r.queue) {
      const note = `Server busy: you're #${r.queue.position} in line (about ${Math.max(1, Math.round(r.queue.etaSeconds / 60))} min)`;
      if (note !== lastNote) notify?.({ status: "queued", message: (lastNote = note) });
    }
    await new Promise((res) => setTimeout(res, 2500));
  }
  return null;
}

/** Promotes queued projects when capacity frees up. Runs every few seconds in the server process. */
async function schedule() {
  const provider = await getSandboxProvider();
  if (!provider) return;
  const queued = await db.select().from(vmQueue).orderBy(desc(vmQueue.priority), asc(vmQueue.enqueuedAt)).limit(5);
  if (!queued.length) return;
  await reapIdleSandboxes(IDLE_MS_UNDER_PRESSURE);
  for (const q of queued) {
    capCache = null;
    const cap = await capacity(provider);
    if (!cap.available) break;
    await db.delete(vmQueue).where(eq(vmQueue.projectId, q.projectId));
    startBoot(q.projectId);
  }
}

function startScheduler() {
  if (globalThis.__forgedScheduler) return;
  let tick = 0;
  globalThis.__forgedScheduler = setInterval(() => {
    tick++;
    schedule().catch((err) => console.warn("[sandbox] scheduler", (err as Error).message));
    if (tick % 60 === 0) reapIdleSandboxes(IDLE_MS).catch(() => {});
  }, 3000);
  globalThis.__forgedScheduler.unref?.();
}

export async function stopSandbox(projectId: string) {
  const handle = await getLiveSandbox(projectId).catch(() => null);
  live.delete(projectId);
  if (handle) await handle.stop().catch(() => {});
  await db.delete(vmQueue).where(eq(vmQueue.projectId, projectId));
  await setState(projectId, { sandboxStatus: "stopped", sandboxId: null, previewUrl: null });
}

export async function restartSandbox(projectId: string) {
  const handle = await getLiveSandbox(projectId);
  if (!handle) return requestSandbox(projectId);
  await handle.restart();
  await setState(projectId, { sandboxLastActiveAt: new Date() });
  return { status: "running" as const, previewUrl: handle.previewUrl };
}

export async function touchSandbox(projectId: string) {
  await setState(projectId, { sandboxLastActiveAt: new Date() });
}

/** Best-effort file sync to a running VM (the database stays the source of truth). */
export async function syncToSandbox(projectId: string, changes: { write?: { path: string; content: string }[]; remove?: string[]; binary?: { path: string; base64: string }[] }) {
  const handle = await getLiveSandbox(projectId).catch(() => null);
  if (!handle) return false;
  try {
    if (changes.write?.length) await handle.writeFiles(changes.write);
    if (changes.binary?.length) await handle.writeBinary(changes.binary);
    if (changes.remove?.length) await handle.deleteFiles(changes.remove);
    return true;
  } catch (err) {
    console.warn("[sandbox] sync failed", (err as Error).message);
    live.delete(projectId);
    return false;
  }
}

export async function reapIdleSandboxes(maxIdleMs = IDLE_MS) {
  const idle = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(isNotNull(projects.sandboxId), eq(projects.sandboxStatus, "running"), lt(projects.sandboxLastActiveAt, new Date(Date.now() - maxIdleMs))));
  const { getActiveRun } = await import("@/lib/ai/run-registry");
  for (const p of idle) {
    if (getActiveRun(p.id)) continue; // never pull the VM from under a running agent
    await stopSandbox(p.id).catch(() => {});
  }
  return idle.length;
}

/** On boot, forget VMs that disappeared while the app was down. */
export async function reconcileSandboxes() {
  await db
    .update(projects)
    .set({ sandboxStatus: "stopped", sandboxId: null, previewUrl: null })
    .where(inArray(projects.sandboxStatus, ["starting", "queued"]));
  await db.execute(sql`delete from vm_queue where enqueued_at < now() - interval '1 hour'`);
}
