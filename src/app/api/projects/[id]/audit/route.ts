import { z } from "zod";
import { getLiveSandbox } from "@/lib/sandbox";
import { auditPage } from "@/lib/sandbox/browser";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

type P = { id: string };
const Body = z.object({ path: z.string().max(300).regex(/^\/[\w\-./?=&%#]*$/).default("/") });

/** Runs performance, accessibility, SEO and best-practice checks on a page of the running preview. */
export const POST = withApi<P>(
  async (req, { auth, params }) => {
    const p = await getOwnedProject(auth.userId, params.id);
    if (!p) return errorResponse(404, "not_found", "Project not found");
    const { path } = Body.parse(await readJson(req, 4096).catch(() => ({})));
    const sbx = await getLiveSandbox(p.id);
    if (!sbx) return errorResponse(409, "vm_not_running", "Start the preview first, then run the audit.");
    const report = await auditPage(p.id, sbx, path);
    return json({ report });
  },
  { rateLimit: 6, bucket: "audit" },
);
