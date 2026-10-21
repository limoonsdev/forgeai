import { readFile } from "@/lib/server/files";
import { getSharedProject } from "@/lib/server/projects";
import { errorResponse, json } from "@/lib/server/api";

export async function GET(_req: Request, ctx: { params: Promise<{ token: string; path: string[] }> }) {
  const { token, path } = await ctx.params;
  const p = await getSharedProject(token);
  if (!p) return errorResponse(404, "not_found", "This share link is invalid or was disabled.");
  try {
    const content = await readFile(p.id, path.join("/"));
    if (content === null) return errorResponse(404, "not_found", "File not found");
    return json({ path: path.join("/"), content });
  } catch {
    return errorResponse(400, "invalid_path", "Invalid path");
  }
}
