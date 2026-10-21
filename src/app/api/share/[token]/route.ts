import { loadHistory, toDTO } from "@/lib/ai/history";
import { listFiles } from "@/lib/server/files";
import { getSharedProject } from "@/lib/server/projects";
import { errorResponse, json } from "@/lib/server/api";

/** Public, read-only view of a shared session. */
export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const p = await getSharedProject(token);
  if (!p) return errorResponse(404, "not_found", "This share link is invalid or was disabled.");
  const [history, files] = await Promise.all([loadHistory(p.id), listFiles(p.id)]);
  return json({
    project: { name: p.name, description: p.description, allowRemix: p.shareAllowRemix, previewUrl: p.sandboxStatus === "running" ? p.previewUrl : null },
    messages: history.map((m) => toDTO(m)),
    files: files.map((f) => f.path),
  });
}
