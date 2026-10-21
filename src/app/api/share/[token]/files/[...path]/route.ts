import { readAsset, readFile } from "@/lib/server/files";
import { getSharedProject } from "@/lib/server/projects";
import { errorResponse, json } from "@/lib/server/api";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp } from "@/lib/server/api";

const INLINE = /^(image\/(png|jpeg|gif|webp|avif)|video\/(mp4|webm)|audio\/(mpeg|wav|ogg|mp4))$/;

export async function GET(req: Request, ctx: { params: Promise<{ token: string; path: string[] }> }) {
  const { token, path } = await ctx.params;
  if (!rateLimit(`share-files:${clientIp(req)}`, 240, 60_000).ok) return errorResponse(429, "rate_limited", "Too many requests.");
  const p = await getSharedProject(token);
  if (!p) return errorResponse(404, "not_found", "This share link is invalid or was disabled.");
  const joined = path.join("/");
  try {
    const content = await readFile(p.id, joined);
    if (content !== null) return json({ path: joined, content });
    const asset = await readAsset(p.id, joined);
    if (!asset) return errorResponse(404, "not_found", "File not found");
    if (new URL(req.url).searchParams.get("raw") !== "1") return json({ path: joined, binary: true, mime: asset.mime, size: asset.data.length });
    const inline = INLINE.test(asset.mime);
    return new Response(new Uint8Array(asset.data), {
      headers: {
        "Content-Type": inline ? asset.mime : "application/octet-stream",
        "Content-Disposition": inline ? "inline" : "attachment",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=300",
      },
    });
  } catch {
    return errorResponse(400, "invalid_path", "Invalid path");
  }
}
