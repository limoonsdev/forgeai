import { z } from "zod";
import { githubAccess, GitHubError, pushProject } from "@/lib/integrations/github";
import { getOwnedProject } from "@/lib/server/projects";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

type P = { id: string };

export const GET = withApi<P>(async (_req, { auth, params }) => {
  const p = await getOwnedProject(auth.userId, params.id);
  if (!p) return errorResponse(404, "not_found", "Project not found");
  return json({ repo: p.githubRepo, branch: p.githubBranch, pushedAt: p.githubPushedAt?.toISOString() ?? null });
});

const Body = z.object({ repoName: z.string().max(100).optional(), private: z.boolean().optional(), message: z.string().max(500).optional() });

/** Commits the current project files to GitHub (creates a private repository the first time). */
export const POST = withApi<P>(
  async (req, { auth, params }) => {
    const body = Body.parse(await readJson(req, 4096));
    const access = await githubAccess(auth.userId);
    if (!access?.canRepo) return errorResponse(412, "github_not_connected", "Connect GitHub with repository access first.");
    try {
      return json(await pushProject(auth.userId, access.token, params.id, body));
    } catch (err) {
      if (err instanceof GitHubError) return errorResponse(err.status, "github_error", err.message);
      throw err;
    }
  },
  { rateLimit: 10, bucket: "github-push" },
);
