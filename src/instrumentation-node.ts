import { recoverInterruptedRuns } from "@/lib/ai/agent";
import { pauseAllRuns } from "@/lib/ai/run-registry";
import { reconcileSandboxes } from "@/lib/sandbox";

await recoverInterruptedRuns().catch((err) => console.warn("[startup] run recovery failed", (err as Error).message));
await reconcileSandboxes().catch((err) => console.warn("[startup] sandbox reconcile failed", (err as Error).message));

// On deploys/restarts, let in-flight agent runs reach a clean pause point so users can resume them.
let stopping = false;
async function shutdown(signal: string) {
  if (stopping) return;
  stopping = true;
  console.log(`[shutdown] ${signal}: pausing active runs`);
  await pauseAllRuns(20_000).catch(() => {});
  process.exit(0);
}
process.once("SIGTERM", () => void shutdown("SIGTERM"));
process.once("SIGINT", () => void shutdown("SIGINT"));
