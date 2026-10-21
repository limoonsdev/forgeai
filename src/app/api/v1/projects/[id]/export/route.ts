import { exportProjectZip, getOwnedProject } from "@/lib/server/projects";
import { errorResponse, withApi } from "@/lib/server/api";
import { slugify } from "@/lib/utils";

type P = { id: string };

export const GET = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  const zip = await exportProjectZip(p.id, p.name);
  return new Response(zip as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${slugify(p.name) || "forged-app"}.zip"`,
    },
  });
});
