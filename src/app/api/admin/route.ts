import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { abuseReports, ipBans, projects, session, user } from "@/lib/db/schema";
import { isAdminEmail } from "@/lib/server/admin";
import { releaseUserResources } from "@/lib/server/account";
import { takeDownSubdomain } from "@/lib/server/deployments";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

const Action = z.discriminatedUnion("action", [
  z.object({ action: z.literal("ban"), userId: z.string().max(60), reason: z.string().max(300).default("Acceptable Use Policy violation") }),
  z.object({ action: z.literal("unban"), userId: z.string().max(60) }),
  z.object({ action: z.literal("restrict"), userId: z.string().max(60), reason: z.string().max(300).default("Restricted by an administrator") }),
  z.object({ action: z.literal("unrestrict"), userId: z.string().max(60) }),
  z.object({ action: z.literal("report"), reportId: z.string().max(60), status: z.enum(["actioned", "dismissed"]) }),
  z.object({ action: z.literal("takedown"), subdomain: z.string().max(63) }),
  z.object({ action: z.literal("disable_share"), projectId: z.string().max(60) }),
  z.object({ action: z.literal("ip_ban"), cidr: z.string().max(60), reason: z.string().max(200).default(""), days: z.number().int().min(0).max(3650).default(30) }),
  z.object({ action: z.literal("ip_unban"), cidr: z.string().max(60) }),
]);

/** Moderation actions. Every call is re-checked against ADMIN_EMAILS on the server. */
export const POST = withApi(
  async (req, { auth }) => {
    const [me] = await db.select({ email: user.email, verified: user.emailVerified }).from(user).where(eq(user.id, auth.userId));
    if (!me?.verified || !isAdminEmail(me.email)) return errorResponse(404, "not_found", "Not found");
    const a = Action.parse(await readJson(req, 8_000));
    const now = new Date();
    switch (a.action) {
      case "ban":
        await db.update(user).set({ bannedAt: now, restrictedAt: now, restrictReason: a.reason }).where(eq(user.id, a.userId));
        await db.delete(session).where(eq(session.userId, a.userId)); // signed out everywhere, immediately
        await releaseUserResources(a.userId);
        break;
      case "unban":
        await db.update(user).set({ bannedAt: null, restrictedAt: null, restrictReason: null, strikes: 0 }).where(eq(user.id, a.userId));
        break;
      case "restrict":
        await db.update(user).set({ restrictedAt: now, restrictReason: a.reason }).where(eq(user.id, a.userId));
        break;
      case "unrestrict":
        await db.update(user).set({ restrictedAt: null, restrictReason: null, strikes: 0 }).where(eq(user.id, a.userId));
        break;
      case "report":
        await db.update(abuseReports).set({ status: a.status }).where(eq(abuseReports.id, a.reportId));
        break;
      case "takedown":
        await takeDownSubdomain(a.subdomain);
        break;
      case "disable_share":
        await db.update(projects).set({ shareEnabled: false }).where(eq(projects.id, a.projectId));
        break;
      case "ip_ban": {
        const { default: ipaddr } = await import("ipaddr.js");
        try {
          if (a.cidr.includes("/")) ipaddr.parseCIDR(a.cidr);
          else ipaddr.parse(a.cidr);
        } catch {
          return errorResponse(400, "invalid_cidr", "Enter an IP address or a CIDR range.");
        }
        await db
          .insert(ipBans)
          .values({ cidr: a.cidr, reason: a.reason, expiresAt: a.days ? new Date(Date.now() + a.days * 86_400_000) : null })
          .onConflictDoUpdate({ target: ipBans.cidr, set: { reason: a.reason, expiresAt: a.days ? new Date(Date.now() + a.days * 86_400_000) : null } });
        break;
      }
      case "ip_unban":
        await db.delete(ipBans).where(eq(ipBans.cidr, a.cidr));
        break;
    }
    return json({ ok: true });
  },
  { rateLimit: 60, bucket: "admin" },
);
