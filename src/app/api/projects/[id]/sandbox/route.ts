import { ensureSandbox, getSandboxProvider, stopSandbox } from "@/lib/sandbox";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, withApi } from "@/lib/server/api";

type P = { id: string };

export const GET = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const provider = await getSandboxProvider();
  return json({ available: Boolean(provider), provider: provider?.name ?? null, status: p.sandboxStatus, previewUrl: p.previewUrl });
});

/** Boot (or wake) the project's VM and start `next dev`. */
export const POST = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  let lastMessage: string | undefined;
  const handle = await ensureSandbox(p.id, (e) => (lastMessage = e.message));
  if (!handle) return errorResponse(503, "sandbox_unavailable", lastMessage ?? "The VM could not be started.");
  return json({ status: "running", previewUrl: handle.previewUrl, id: handle.id });
});

export const DELETE = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  await stopSandbox(p.id);
  return json({ status: "stopped" });
});
