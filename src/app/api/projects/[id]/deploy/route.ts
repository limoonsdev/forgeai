import { deploymentStatus, publishProject, unpublishProject } from "@/lib/server/deployments";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, withApi } from "@/lib/server/api";

type P = { id: string };

export const GET = withApi<P>(async (_req, { auth, params }) => json({ deployment: await deploymentStatus(auth.userId, params.id) }));

/** Build and publish (or republish) the project on its subdomain. */
export const POST = withApi<P>(
  async (_req, { auth, params }) => {
    if (!(await getOwnedProject(auth.userId, params.id))) return errorResponse(404, "not_found", "Project not found");
    return json({ deployment: await publishProject(auth.userId, params.id) }, { status: 202 });
  },
  { rateLimit: 6, bucket: "deploy" },
);

export const DELETE = withApi<P>(async (_req, { auth, params }) => json({ removed: await unpublishProject(auth.userId, params.id) }));
