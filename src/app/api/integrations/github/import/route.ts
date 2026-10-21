import { z } from "zod";
import { githubAccess, GitHubError, importRepo } from "@/lib/integrations/github";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

const Body = z.object({ repo: z.string().max(200), branch: z.string().max(200).optional() });

/** Creates a new project from a GitHub repository (Next.js apps only). */
export const POST = withApi(
  async (req, { auth }) => {
    const body = Body.parse(await readJson(req, 4096));
    const access = await githubAccess(auth.userId);
    if (!access?.canRepo) return errorResponse(412, "github_not_connected", "Connect GitHub with repository access first.");
    try {
      return json(await importRepo(auth.userId, access.token, body.repo, body.branch), { status: 201 });
    } catch (err) {
      if (err instanceof GitHubError) return errorResponse(err.status, "github_error", err.message);
      throw err;
    }
  },
  { rateLimit: 5, bucket: "github-import" },
);
