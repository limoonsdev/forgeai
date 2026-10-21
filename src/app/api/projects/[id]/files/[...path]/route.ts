import { readAsset, readFile } from "@/lib/server/files";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, withApi } from "@/lib/server/api";

type P = { id: string; path: string[] };

const INLINE = /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|webm)|audio\/(mpeg|wav|ogg|mp4))$/;

/**
 * Read-only: project code can only be changed by the agent (prevents code injection into VMs).
 * Binary assets return metadata, or the bytes with ?raw=1 (sandboxed, never rendered as HTML).
 */
export const GET = withApi<P>(async (req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const path = params.path.join("/");
  const content = await readFile(p.id, path);
  if (content !== null) return json({ path, content });
  const asset = await readAsset(p.id, path);
  if (!asset) return errorResponse(404, "not_found", `File not found: ${path}`);
  if (new URL(req.url).searchParams.get("raw") !== "1") return json({ path, binary: true, mime: asset.mime, size: asset.data.length });
  const inline = INLINE.test(asset.mime);
  return new Response(new Uint8Array(asset.data), {
    headers: {
      "Content-Type": inline ? asset.mime : "application/octet-stream",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${path.split("/").pop()!.replace(/"/g, "")}"`,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, max-age=60",
    },
  });
});
