import { getSandboxProvider, queueInfo, requestSandbox, restartSandbox, stopSandbox, touchSandbox } from "@/lib/sandbox";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

type P = { id: string };

/** VM status. The workspace polls this while open, which also keeps a running VM from being recycled. */
export const GET = withApi<P>(async (req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const provider = await getSandboxProvider();
  const visible = new URL(req.url).searchParams.get("heartbeat") === "1";
  if (visible && p.sandboxStatus === "running") await touchSandbox(p.id);
  const queue = p.sandboxStatus === "queued" ? await queueInfo(p.id) : null;
  return json({ available: Boolean(provider), status: p.sandboxStatus, previewUrl: p.sandboxStatus === "running" ? p.previewUrl : null, queue });
});

/** Start (non-blocking: boots now or joins the queue) or restart the project's VM. */
export const POST = withApi<P>(
  async (req, { auth, params }) => {
    const p = await getOwnedProject(auth.userId, params.id);
    if (!p) return errorResponse(404, "not_found", "Project not found");
    const body = await readJson<{ action?: "start" | "restart" }>(req).catch(() => ({}) as { action?: "start" | "restart" });
    const r = body.action === "restart" ? await restartSandbox(p.id) : await requestSandbox(p.id);
    if (r.status === "unavailable") return errorResponse(503, "sandbox_unavailable", "Live previews are not available on this server right now.");
    return json(r);
  },
  { rateLimit: 30, bucket: "sandbox" },
);

export const DELETE = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  await stopSandbox(p.id);
  return json({ status: "stopped" });
});
