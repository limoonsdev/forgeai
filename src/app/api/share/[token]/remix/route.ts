import { forkProject, getSharedProject } from "@/lib/server/projects";
import { errorResponse, json, withApi } from "@/lib/server/api";

/** Copy a shared project's code into a new project owned by the current user. */
export const POST = withApi<{ token: string }>(async (_req, { auth, params }) => {
  const source = await getSharedProject(params.token);
  if (!source) return errorResponse(404, "not_found", "This share link is invalid or was disabled.");
  if (!source.shareAllowRemix && source.userId !== auth.userId) return errorResponse(403, "remix_disabled", "The owner disabled remixing.");
  const project = await forkProject(auth.userId, source);
  return json({ project: { id: project.id, name: project.name } }, { status: 201 });
});
