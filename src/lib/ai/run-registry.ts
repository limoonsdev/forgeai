import "server-only";
import type { RunEvent } from "./types";

type Listener = (e: RunEvent) => void;

type LiveRun = {
  runId: string;
  projectId: string;
  userId: string;
  /** Set when the user (or a server shutdown) asks to pause after the current step. */
  pauseRequested: boolean;
  abort: AbortController;
  listeners: Set<Listener>;
  /** Events of the step in progress, replayed to clients that (re)connect mid-stream. */
  stepBuffer: RunEvent[];
};

declare global {
  var __forgedRuns: Map<string, LiveRun> | undefined;
}

const runs = (globalThis.__forgedRuns ??= new Map<string, LiveRun>());

export function registerRun(projectId: string, runId: string, userId: string) {
  if (runs.has(projectId)) throw new Error("A run is already in progress for this project.");
  const run: LiveRun = { runId, projectId, userId, pauseRequested: false, abort: new AbortController(), listeners: new Set(), stepBuffer: [] };
  runs.set(projectId, run);
  return run;
}

export function getActiveRun(projectId: string) {
  return runs.get(projectId) ?? null;
}

export function publish(projectId: string, event: RunEvent) {
  const run = runs.get(projectId);
  if (!run) return;
  if (event.type === "assistant_start") run.stepBuffer = [event];
  else if (event.type === "message") run.stepBuffer = [];
  else if (event.type !== "ping") run.stepBuffer.push(event);
  for (const l of run.listeners) {
    try {
      l(event);
    } catch {
      // a broken listener must never break the run
    }
  }
}

export function subscribe(projectId: string, listener: Listener, opts: { replay?: boolean } = {}) {
  const run = runs.get(projectId);
  if (!run) return null;
  if (opts.replay) for (const e of run.stepBuffer) listener(e);
  run.listeners.add(listener);
  return () => run.listeners.delete(listener);
}

export function requestPause(projectId: string) {
  const run = runs.get(projectId);
  if (!run) return false;
  run.pauseRequested = true;
  return true;
}

export function isPauseRequested(projectId: string) {
  return runs.get(projectId)?.pauseRequested ?? false;
}

export function countActiveRuns(userId?: string) {
  let n = 0;
  for (const r of runs.values()) if (!userId || r.userId === userId) n++;
  return n;
}

/** Graceful shutdown: every run pauses after its current step so users can resume later. */
export async function pauseAllRuns(timeoutMs: number) {
  for (const r of runs.values()) r.pauseRequested = true;
  const deadline = Date.now() + timeoutMs;
  while (runs.size > 0 && Date.now() < deadline) await new Promise((r) => setTimeout(r, 250));
  return runs.size;
}

export function stopRun(projectId: string) {
  const run = runs.get(projectId);
  if (!run) return false;
  run.abort.abort();
  return true;
}

export function unregisterRun(projectId: string, runId: string) {
  const run = runs.get(projectId);
  if (run?.runId === runId) {
    runs.delete(projectId);
    // let listeners flush the final event before they are dropped
    setTimeout(() => run.listeners.clear(), 50);
  }
}
