import { z } from "zod";
import { absoluteUrl } from "@/lib/utils";
import { setSharing } from "@/lib/server/projects";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

type P = { id: string };

export const POST = withApi<P>(async (req, { auth, params }) => {
  const body = z
    .object({ enabled: z.boolean(), allowRemix: z.boolean().optional(), regenerate: z.boolean().optional() })
    .parse(await readJson(req));
  const p = await setSharing(auth.userId, params.id, body);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  return json({
    enabled: p.shareEnabled,
    allowRemix: p.shareAllowRemix,
    url: p.shareEnabled && p.shareToken ? absoluteUrl(`/share/${p.shareToken}`) : null,
  });
});
