import "server-only";
import { getConnectorSecrets } from "@/lib/connectors";
import { saveAttachment } from "@/lib/server/attachments";
import { safeFetch } from "@/lib/server/safe-fetch";

export class FigmaError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

/** Accepts figma.com/file|design|proto/<key>/<name>?node-id=12-34 links. */
export function parseFigmaUrl(input: string) {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new FigmaError("Paste a link to a Figma file or frame.");
  }
  if (!/(^|\.)figma\.com$/.test(url.hostname)) throw new FigmaError("This isn't a Figma link.");
  const m = url.pathname.match(/^\/(?:file|design|proto|board)\/([A-Za-z0-9]{10,64})/);
  if (!m) throw new FigmaError("This Figma link doesn't point to a file.");
  const node = url.searchParams.get("node-id")?.replace(/-/g, ":") ?? null;
  if (node && !/^[\d:;I]+$/.test(node)) throw new FigmaError("Invalid node id in the link.");
  return { key: m[1], node };
}

type FigmaNode = {
  id: string;
  name: string;
  type: string;
  characters?: string;
  children?: FigmaNode[];
  fills?: { type: string; color?: { r: number; g: number; b: number; a: number }; visible?: boolean }[];
  style?: { fontFamily?: string; fontSize?: number; fontWeight?: number };
  absoluteBoundingBox?: { width: number; height: number };
};

async function figmaJson<T>(path: string, token: string): Promise<T> {
  const res = await safeFetch(`https://api.figma.com${path}`, { headers: { "X-Figma-Token": token }, maxBytes: 25_000_000, timeoutMs: 30_000 });
  if (res.status === 403 || res.status === 401) throw new FigmaError("Figma refused the token. Check it in Settings → Connectors (scope: file_content:read).", 403);
  if (res.status === 404) throw new FigmaError("Figma couldn't find this file. Is it shared with the account of your token?", 404);
  if (res.status === 429) throw new FigmaError("Figma rate limit reached. Try again in a minute.", 429);
  if (!res.ok) throw new FigmaError(`Figma error (${res.status}).`, 502);
  return JSON.parse(res.text()) as T;
}

const hex = (c: { r: number; g: number; b: number }) => `#${[c.r, c.g, c.b].map((v) => Math.round(v * 255).toString(16).padStart(2, "0")).join("")}`;

/** A compact, model-friendly description of a frame: texts, colours, fonts and size. */
function describe(root: FigmaNode) {
  const texts: string[] = [];
  const colors = new Map<string, number>();
  const fonts = new Map<string, number>();
  const walk = (n: FigmaNode, depth: number) => {
    if (depth > 30) return;
    if (n.type === "TEXT" && n.characters?.trim() && texts.length < 120) texts.push(n.characters.trim().replace(/\s+/g, " ").slice(0, 200));
    for (const f of n.fills ?? []) if (f.type === "SOLID" && f.color && f.visible !== false) colors.set(hex(f.color), (colors.get(hex(f.color)) ?? 0) + 1);
    if (n.style?.fontFamily) {
      const k = `${n.style.fontFamily} ${n.style.fontWeight ?? 400} ${n.style.fontSize ?? ""}px`;
      fonts.set(k, (fonts.get(k) ?? 0) + 1);
    }
    n.children?.forEach((c) => walk(c, depth + 1));
  };
  walk(root, 0);
  const top = <K,>(m: Map<K, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  const size = root.absoluteBoundingBox ? `${Math.round(root.absoluteBoundingBox.width)}×${Math.round(root.absoluteBoundingBox.height)}` : "";
  return [
    `Frame "${root.name}"${size ? ` (${size})` : ""}`,
    `Colours: ${top(colors, 10).join(", ") || "n/a"}`,
    `Type: ${top(fonts, 6).join("; ") || "n/a"}`,
    texts.length ? `Text content:\n${texts.map((t) => `- ${t}`).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Imports up to 4 frames: each becomes an image attachment for the next prompt, plus a text brief
 * (texts, colours, fonts) so the agent can rebuild the design faithfully.
 */
export async function importFigma(userId: string, link: string, projectId: string | null) {
  const secrets = await getConnectorSecrets(userId, "figma");
  const token = secrets?.FIGMA_TOKEN;
  if (!token) throw new FigmaError("Add your Figma token in Settings → Connectors first.", 412);
  const { key, node } = parseFigmaUrl(link);

  let frames: FigmaNode[];
  let fileName = "Figma file";
  if (node) {
    const data = await figmaJson<{ name: string; nodes: Record<string, { document: FigmaNode } | null> }>(`/v1/files/${key}/nodes?ids=${encodeURIComponent(node)}&depth=12`, token);
    fileName = data.name;
    const doc = data.nodes[node]?.document;
    if (!doc) throw new FigmaError("That frame wasn't found in the file.", 404);
    frames = doc.type === "CANVAS" || doc.type === "SECTION" ? (doc.children ?? []).filter((c) => c.type === "FRAME").slice(0, 4) : [doc];
  } else {
    const data = await figmaJson<{ name: string; document: FigmaNode }>(`/v1/files/${key}?depth=2`, token);
    fileName = data.name;
    const page = data.document.children?.[0];
    frames = (page?.children ?? []).filter((c) => c.type === "FRAME" || c.type === "COMPONENT").slice(0, 4);
    if (frames.length) {
      const ids = frames.map((f) => f.id).join(",");
      const detailed = await figmaJson<{ nodes: Record<string, { document: FigmaNode } | null> }>(`/v1/files/${key}/nodes?ids=${encodeURIComponent(ids)}&depth=12`, token);
      frames = frames.map((f) => detailed.nodes[f.id]?.document ?? f);
    }
  }
  if (!frames.length) throw new FigmaError("No frames found. Link to a specific frame (right-click → Copy link to selection).");

  const ids = frames.map((f) => f.id).join(",");
  const images = await figmaJson<{ images: Record<string, string | null> }>(`/v1/images/${key}?ids=${encodeURIComponent(ids)}&format=png&scale=1`, token);
  const attachments: { id: string; name: string }[] = [];
  for (const f of frames) {
    const url = images.images[f.id];
    if (!url) continue;
    const img = await safeFetch(url, { maxBytes: 5 * 1024 * 1024, timeoutMs: 30_000 }).catch(() => null);
    if (!img?.ok) continue;
    const saved = await saveAttachment(userId, { name: `${f.name}.png`, data: img.buffer, projectId }).catch(() => null);
    if (saved) attachments.push({ id: saved.id, name: saved.name });
  }
  const brief = `Build this design from Figma ("${fileName}"). Match the layout, spacing, colours and type closely; make it responsive.\n\n${frames.map(describe).join("\n\n")}`;
  return { attachments, brief: brief.slice(0, 12_000), fileName };
}
