import "server-only";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { account, projectAssets, projectFiles, projects } from "@/lib/db/schema";
import { getAllAssets, getAllFiles } from "@/lib/server/files";
import { safeFetch } from "@/lib/server/safe-fetch";
import { newId } from "@/lib/server/ids";

export class GitHubError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export function githubConfigured() {
  return Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
}

/** The user's GitHub token (decrypted server-side only) and whether it can access repositories. */
export async function githubAccess(userId: string) {
  const [acc] = await db.select({ id: account.id, scope: account.scope }).from(account).where(and(eq(account.userId, userId), eq(account.providerId, "github")));
  if (!acc) return null;
  const scopes = (acc.scope ?? "").split(/[,\s]+/);
  const res = (await auth.api.getAccessToken({ body: { accountId: acc.id, userId } }).catch(() => null)) as { accessToken?: string } | null;
  if (!res?.accessToken) return null;
  return { token: res.accessToken, canRepo: scopes.includes("repo") || scopes.includes("public_repo") };
}

async function gh<T>(token: string, path: string, init: { method?: string; body?: unknown; maxBytes?: number } = {}): Promise<T> {
  const res = await safeFetch(`https://api.github.com${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
    maxBytes: init.maxBytes ?? 30_000_000,
    timeoutMs: 60_000,
  });
  if (res.status === 401) throw new GitHubError("GitHub access expired. Reconnect GitHub.", 401);
  if (res.status === 403 && /rate limit/i.test(res.text())) throw new GitHubError("GitHub rate limit reached. Try again later.", 429);
  if (res.status === 404) throw new GitHubError("Repository not found, or your GitHub connection can't access it.", 404);
  if (!res.ok) {
    let msg = `GitHub error ${res.status}`;
    try {
      msg = (JSON.parse(res.text()) as { message?: string }).message ?? msg;
    } catch {}
    throw new GitHubError(msg, res.status >= 500 ? 502 : 400);
  }
  return (res.status === 204 ? null : JSON.parse(res.text())) as T;
}

export type RepoSummary = { fullName: string; private: boolean; defaultBranch: string; updatedAt: string; description: string | null };

export async function listRepos(token: string): Promise<RepoSummary[]> {
  const rows = await gh<{ full_name: string; private: boolean; default_branch: string; updated_at: string; description: string | null }[]>(
    token,
    "/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
  );
  return rows.map((r) => ({ fullName: r.full_name, private: r.private, defaultBranch: r.default_branch, updatedAt: r.updated_at, description: r.description }));
}

const SKIP = /(^|\/)(node_modules|\.next|\.git|\.vercel|\.turbo|dist|build|out|coverage)\/|(^|\/)\.env(\.|$)|\.(log|DS_Store)$/;
const TEXT = /\.(tsx?|jsx?|mjs|cjs|json|css|scss|sass|less|md|mdx|txt|html|svg|ya?ml|toml|xml|csv|graphql|gql|prisma|sql|sh|env\.example)$|(^|\/)(\.gitignore|\.npmrc|\.nvmrc|\.prettierrc|\.eslintrc|LICENSE|Dockerfile|Procfile)$/i;
const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|woff2?|ttf|otf|mp4|webm|mp3|wav|ogg|pdf)$/i;
const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", avif: "image/avif", ico: "image/x-icon", woff: "font/woff", woff2: "font/woff2", ttf: "font/ttf", otf: "font/otf", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg", wav: "audio/wav", ogg: "audio/ogg", pdf: "application/pdf" };

/** Imports a repository into a new project (secrets like .env files are never imported). */
export async function importRepo(userId: string, token: string, fullName: string, branchInput?: string) {
  if (!/^[\w.-]+\/[\w.-]+$/.test(fullName)) throw new GitHubError("Invalid repository name.");
  const repo = await gh<{ default_branch: string; name: string; description: string | null }>(token, `/repos/${fullName}`);
  const branch = branchInput || repo.default_branch;
  const tree = await gh<{ tree: { path: string; type: string; sha: string; size?: number }[]; truncated: boolean }>(token, `/repos/${fullName}/git/trees/${encodeURIComponent(branch)}?recursive=1`);
  const entries = tree.tree.filter((e) => e.type === "blob" && !SKIP.test(e.path) && (TEXT.test(e.path) || BINARY.test(e.path)) && (e.size ?? 0) <= 2_000_000);
  if (entries.length > 2000) throw new GitHubError("This repository has too many files to import (2,000 max).");
  const total = entries.reduce((s, e) => s + (e.size ?? 0), 0);
  if (total > 60_000_000) throw new GitHubError("This repository is too large to import (60 MB max).");
  const pkgEntry = entries.find((e) => e.path === "package.json");
  if (!pkgEntry) throw new GitHubError("No package.json at the root. Forged imports Next.js projects only.");

  const text: { path: string; content: string }[] = [];
  const binary: { path: string; data: Buffer; mime: string }[] = [];
  let i = 0;
  const worker = async () => {
    while (i < entries.length) {
      const e = entries[i++];
      const blob = await gh<{ content: string; encoding: string }>(token, `/repos/${fullName}/git/blobs/${e.sha}`, { maxBytes: 4_000_000 });
      const buf = Buffer.from(blob.content, blob.encoding === "base64" ? "base64" : "utf8");
      if (BINARY.test(e.path)) binary.push({ path: e.path, data: buf, mime: MIME[e.path.split(".").pop()!.toLowerCase()] ?? "application/octet-stream" });
      else text.push({ path: e.path, content: buf.toString("utf8") });
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));

  const pkg = text.find((f) => f.path === "package.json");
  let isNext = false;
  try {
    const parsed = JSON.parse(pkg?.content ?? "{}");
    isNext = Boolean(parsed.dependencies?.next || parsed.devDependencies?.next);
  } catch {}
  if (!isNext) throw new GitHubError("This repository isn't a Next.js app (no `next` dependency in package.json). Forged only works with Next.js projects.");

  const id = newId();
  await db.insert(projects).values({ id, userId, name: repo.name.slice(0, 60), description: repo.description?.slice(0, 300) ?? "", githubRepo: fullName, githubBranch: branch });
  for (let k = 0; k < text.length; k += 200) await db.insert(projectFiles).values(text.slice(k, k + 200).map((f) => ({ projectId: id, path: f.path, content: f.content })));
  for (const b of binary) await db.insert(projectAssets).values({ projectId: id, path: b.path, data: b.data, mime: b.mime, size: b.data.length });
  return { projectId: id, files: text.length + binary.length, truncated: tree.truncated };
}

/** Commits the project's current files to its GitHub repository (creating the repository if needed). */
export async function pushProject(userId: string, token: string, projectId: string, opts: { repoName?: string; private?: boolean; message?: string }) {
  const [p] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  if (!p) throw new GitHubError("Project not found", 404);
  let fullName = p.githubRepo;
  let branch = p.githubBranch ?? "main";
  if (!fullName) {
    const name = (opts.repoName || p.name)
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 90);
    if (!name) throw new GitHubError("Choose a repository name.");
    const created = await gh<{ full_name: string; default_branch: string }>(token, "/user/repos", {
      method: "POST",
      body: { name, private: opts.private ?? true, auto_init: true, description: p.description?.slice(0, 300) || "Built with Forged.dev" },
    });
    fullName = created.full_name;
    branch = created.default_branch;
  }
  const ref = await gh<{ object: { sha: string } }>(token, `/repos/${fullName}/git/ref/heads/${encodeURIComponent(branch)}`).catch(async (err) => {
    if (err instanceof GitHubError && err.status === 404) return null;
    throw err;
  });

  const files = await getAllFiles(projectId);
  const assets = await getAllAssets(projectId);
  const tree: { path: string; mode: string; type: string; content?: string; sha?: string }[] = files
    .filter((f) => !/(^|\/)\.env(\.|$)/.test(f.path))
    .map((f) => ({ path: f.path, mode: "100644", type: "blob", content: f.content }));
  for (const a of assets) {
    const blob = await gh<{ sha: string }>(token, `/repos/${fullName}/git/blobs`, { method: "POST", body: { content: Buffer.from(a.data).toString("base64"), encoding: "base64" } });
    tree.push({ path: a.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  // A full tree (no base_tree): the commit mirrors the project exactly, deleted files included.
  const newTree = await gh<{ sha: string }>(token, `/repos/${fullName}/git/trees`, { method: "POST", body: { tree } });
  const commit = await gh<{ sha: string; html_url: string }>(token, `/repos/${fullName}/git/commits`, {
    method: "POST",
    body: { message: (opts.message || "Update from Forged.dev").slice(0, 500), tree: newTree.sha, parents: ref ? [ref.object.sha] : [] },
  });
  if (ref) await gh(token, `/repos/${fullName}/git/refs/heads/${encodeURIComponent(branch)}`, { method: "PATCH", body: { sha: commit.sha, force: false } });
  else await gh(token, `/repos/${fullName}/git/refs`, { method: "POST", body: { ref: `refs/heads/${branch}`, sha: commit.sha } });
  await db.update(projects).set({ githubRepo: fullName, githubBranch: branch, githubPushedAt: new Date() }).where(eq(projects.id, projectId));
  return { repo: fullName, branch, url: `https://github.com/${fullName}`, commit: commit.sha.slice(0, 7) };
}
