import type { Metadata } from "next";
import { count, desc, eq, gte, sql, like } from "drizzle-orm";
import { db } from "@/lib/db";
import { abuseReports, deployments, ipBans, moderationFlags, projects, signupAttempts, user, vmQueue } from "@/lib/db/schema";
import { countActiveRuns } from "@/lib/ai/run-registry";
import { getSandboxProvider } from "@/lib/sandbox";
import { requireAdminPage } from "@/lib/server/admin";
import { AdminActions } from "@/components/app/admin-actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const DAY = 86_400_000;

async function loadAdminData() {
  const since = new Date(Date.now() - DAY);
  const provider = await getSandboxProvider();
  const [[users], [newUsers], [verified], [projectCount], [vmsRunning], [queued], [live], blocked, flags, reports, bans, capacity] = await Promise.all([
    db.select({ n: count() }).from(user),
    db.select({ n: count() }).from(user).where(gte(user.createdAt, since)),
    db.select({ n: count() }).from(user).where(eq(user.emailVerified, true)),
    db.select({ n: count() }).from(projects),
    db.select({ n: count() }).from(projects).where(eq(projects.sandboxStatus, "running")),
    db.select({ n: count() }).from(vmQueue),
    db.select({ n: count() }).from(deployments).where(eq(deployments.status, "live")),
    db
      .select({ outcome: signupAttempts.outcome, n: count() })
      .from(signupAttempts)
      .where(sql`${gte(signupAttempts.createdAt, since)} and ${like(signupAttempts.outcome, "blocked:%")}`)
      .groupBy(signupAttempts.outcome),
    db
      .select({ id: moderationFlags.id, category: moderationFlags.category, excerpt: moderationFlags.excerpt, action: moderationFlags.action, createdAt: moderationFlags.createdAt, userId: user.id, email: user.email, bannedAt: user.bannedAt, restrictedAt: user.restrictedAt })
      .from(moderationFlags)
      .innerJoin(user, eq(user.id, moderationFlags.userId))
      .orderBy(desc(moderationFlags.createdAt))
      .limit(40),
    db.select().from(abuseReports).where(eq(abuseReports.status, "open")).orderBy(desc(abuseReports.createdAt)).limit(50),
    db.select().from(ipBans).orderBy(desc(ipBans.createdAt)).limit(100),
    provider?.capacity().catch(() => null) ?? null,
  ]);
  return { users, newUsers, verified, projectCount, vmsRunning, queued, live, blocked, flags, reports, bans, capacity };
}

export default async function AdminPage() {
  await requireAdminPage();
  const { users, newUsers, verified, projectCount, vmsRunning, queued, live, blocked, flags, reports, bans, capacity } = await loadAdminData();

  const stats: [string, string | number][] = [
    ["Users", users.n],
    ["New (24 h)", newUsers.n],
    ["Verified", verified.n],
    ["Projects", projectCount.n],
    ["Agent runs now", countActiveRuns()],
    ["VMs running", vmsRunning.n],
    ["Queue", queued.n],
    ["Live apps", live.n],
    ["VM capacity", capacity ? `${capacity.running}/${capacity.maxVms}${capacity.overloaded ? " · overloaded" : ""}` : "n/a"],
  ];

  return (
    <main className="mx-auto max-w-7xl space-y-8 px-4 pt-10 pb-24 sm:px-6">
      <h1 className="font-display text-2xl font-bold">Admin</h1>
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(([k, v]) => (
          <div key={k} className="rounded-xl border bg-card/60 p-4">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-2xl font-bold tabular-nums">{v}</p>
          </div>
        ))}
      </section>
      <AdminActions
        blocked={blocked.map((b) => ({ reason: b.outcome.replace("blocked:", ""), n: b.n }))}
        flags={flags.map((f) => ({ ...f, createdAt: f.createdAt.toISOString(), banned: Boolean(f.bannedAt), restricted: Boolean(f.restrictedAt) }))}
        reports={reports.map((r) => ({ id: r.id, url: r.url, reason: r.reason, details: r.details, email: r.reporterEmail, createdAt: r.createdAt.toISOString() }))}
        bans={bans.map((b) => ({ cidr: b.cidr, reason: b.reason, expiresAt: b.expiresAt?.toISOString() ?? null }))}
        deployDomain={process.env.FORGED_DEPLOY_DOMAIN ?? ""}
      />
    </main>
  );
}
