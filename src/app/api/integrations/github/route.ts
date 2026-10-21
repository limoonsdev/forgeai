import { githubAccess, githubConfigured, GitHubError, listRepos } from "@/lib/integrations/github";
import { errorResponse, json, withApi } from "@/lib/server/api";

/** Connection state; with ?repos=1 also the user's repositories. */
export const GET = withApi(
  async (req, { auth }) => {
    if (!githubConfigured()) return json({ configured: false, connected: false, canRepo: false });
    const access = await githubAccess(auth.userId);
    if (!access) return json({ configured: true, connected: false, canRepo: false });
    if (new URL(req.url).searchParams.get("repos") !== "1" || !access.canRepo) return json({ configured: true, connected: true, canRepo: access.canRepo });
    try {
      return json({ configured: true, connected: true, canRepo: true, repos: await listRepos(access.token) });
    } catch (err) {
      if (err instanceof GitHubError) return errorResponse(err.status, "github_error", err.message);
      throw err;
    }
  },
  { rateLimit: 30, bucket: "github" },
);
