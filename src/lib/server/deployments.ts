import "server-only";
import { and, count, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { deployments, projects, user } from "@/lib/db/schema";
import { planLimits } from "@/lib/config";
import { connectorEnvForProject } from "@/lib/connectors";
import { getSandboxProvider } from "@/lib/sandbox";
import { runnerCall } from "@/lib/sandbox/runner";
import { getAllAssets, getAllFiles } from "./files";
import { newId } from "./ids";
import { ApiError } from "./api";

/** Published apps live at https://<username>-<project>.<FORGED_DEPLOY_DOMAIN>. */
export function deployDomain() {
  return (process.env.FORGED_DEPLOY_DOMAIN || process.env.FORGED_PREVIEW_DOMAIN || "").toLowerCase();
}

export function deploymentUrl(subdomain: string) {
  const domain = deployDomain();
  return domain ? `https://${subdomain}.${domain}` : null;
}

function slug(s: string, max: number) {
  return s
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, max)
    .replace(/-+$/, "");
}

async function pickSubdomain(username: string, projectName: string, projectId: string) {
  const base = `${username}-${slug(projectName, 38) || "app"}`.slice(0, 63).replace(/-+$/, "");
  for (let i = 0; i < 10; i++) {
    const candidate = i === 0 ? base : `${base.slice(0, 58)}-${i + 1}`;
    if (candidate.startsWith("p-")) continue; // reserved for previews
    const [taken] = await db.select({ projectId: deployments.projectId }).from(deployments).where(eq(deployments.subdomain, candidate));
    if (!taken || taken.projectId === projectId) return candidate;
  }
  return `${username}-${projectId.slice(0, 8)}`;
}

const MAX_BYTES = 250 * 1024 * 1024;

export async function publishProject(userId: string, projectId: string) {
  const provider = await getSandboxProvider();
  if (provider?.name !== "runner" || !deployDomain()) throw new ApiError(503, "deploy_unavailable", "Publishing isn't available on this server yet.");
  const [p] = await db.select().from(projects).where(and(eq(projects.id, projectId), eq(projects.userId, userId)));
  if (!p) throw new ApiError(404, "not_found", "Project not found");
  const [owner] = await db.select({ username: user.username, plan: user.plan, restrictedAt: user.restrictedAt, verified: user.emailVerified }).from(user).where(eq(user.id, userId));
  if (!owner?.username) throw new ApiError(400, "username_required", "Choose a username in Settings → Account before publishing.");
  if (owner.restrictedAt) throw new ApiError(403, "restricted", "Your account is restricted and can't publish apps.");
  if (!owner.verified) throw new ApiError(403, "unverified", "Confirm your email address before publishing.");

  const [existing] = await db.select().from(deployments).where(eq(deployments.projectId, projectId));
  if (!existing) {
    const [{ n }] = await db
      .select({ n: count() })
      .from(deployments)
      .where(and(eq(deployments.userId, userId), ne(deployments.status, "stopped")));
    const limit = planLimits(owner.plan).deployments;
    if (n >= limit) throw new ApiError(402, "deploy_limit", `Your plan allows ${limit} published app${limit > 1 ? "s" : ""}. Unpublish another app or upgrade.`);
  }

  const files = await getAllFiles(projectId);
  const assets = await getAllAssets(projectId);
  const total = files.reduce((s, f) => s + f.content.length, 0) + assets.reduce((s, a) => s + a.data.length * 1.37, 0);
  if (total > MAX_BYTES) throw new ApiError(413, "too_large", "This project is too large to publish (250 MB max).");

  const subdomain = existing?.subdomain ?? (await pickSubdomain(owner.username, p.name, projectId));
  const env = await connectorEnvForProject(projectId);
  await runnerCall("POST", `/deployments/${subdomain}`, {
    files: [...files.map((f) => ({ path: f.path, content: f.content })), ...assets.map((a) => ({ path: a.path, content: Buffer.from(a.data).toString("base64"), encoding: "base64" }))],
    env,
  }, 120_000);
  const now = new Date();
  if (existing) await db.update(deployments).set({ status: "queued", log: "", updatedAt: now }).where(eq(deployments.id, existing.id));
  else await db.insert(deployments).values({ id: newId("dep"), projectId, userId, subdomain, status: "queued" });
  return { subdomain, url: deploymentUrl(subdomain), status: "queued" as const };
}

export async function deploymentStatus(userId: string, projectId: string) {
  const [d] = await db.select().from(deployments).where(and(eq(deployments.projectId, projectId), eq(deployments.userId, userId)));
  if (!d) return null;
  if (d.status === "queued" || d.status === "building" || d.status === "live") {
    const remote = await runnerCall<{ status: string; log: string; live: boolean }>("GET", `/deployments/${d.subdomain}`, undefined, 10_000).catch(() => null);
    if (remote) {
      const status = (["queued", "building", "live", "failed"].includes(remote.status) ? remote.status : remote.live ? "live" : "failed") as typeof d.status;
      if (status !== d.status || remote.log !== d.log) {
        const patch: Partial<typeof deployments.$inferInsert> = { status, log: remote.log.slice(-60_000), updatedAt: new Date() };
        if (status === "live" && d.status !== "live") {
          patch.lastDeployedAt = new Date();
          const url = deploymentUrl(d.subdomain);
          void import("./notifications").then(({ notifyUser }) => notifyUser(userId, "deploy_live", { text: `Your app is live at ${url}`, projectId }));
        }
        await db.update(deployments).set(patch).where(eq(deployments.id, d.id));
        Object.assign(d, patch);
      }
    }
  }
  return { subdomain: d.subdomain, url: deploymentUrl(d.subdomain), status: d.status, log: d.log, lastDeployedAt: d.lastDeployedAt?.toISOString() ?? null };
}

export async function unpublishProject(userId: string, projectId: string) {
  const [d] = await db.select().from(deployments).where(and(eq(deployments.projectId, projectId), eq(deployments.userId, userId)));
  if (!d) return false;
  await runnerCall("DELETE", `/deployments/${d.subdomain}`, undefined, 30_000).catch((err) => console.warn("[deploy] remove failed", (err as Error).message));
  await db.delete(deployments).where(eq(deployments.id, d.id));
  return true;
}

/** Moderation takedown: removes a published app regardless of owner. */
export async function takeDownSubdomain(subdomain: string) {
  await runnerCall("DELETE", `/deployments/${subdomain}`, undefined, 30_000).catch(() => {});
  await db.update(deployments).set({ status: "stopped", updatedAt: new Date() }).where(eq(deployments.subdomain, subdomain));
}
