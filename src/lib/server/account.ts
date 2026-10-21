import "server-only";
import JSZip from "jszip";
import { asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  account,
  attachments,
  connectors,
  creditTransactions,
  deployments,
  messages,
  notificationChannels,
  preferences,
  projectAssets,
  projectFiles,
  projects,
  referrals,
  session,
  skills,
  user,
} from "@/lib/db/schema";
import { stopSandbox } from "@/lib/sandbox";
import { maskSecret } from "./crypto";
import { unpublishProject } from "./deployments";

/** Stops every VM and published app of a user (before account deletion or a ban). */
export async function releaseUserResources(userId: string) {
  const rows = await db.select({ id: projects.id }).from(projects).where(eq(projects.userId, userId));
  for (const p of rows) {
    await stopSandbox(p.id).catch(() => {});
    await unpublishProject(userId, p.id).catch(() => {});
  }
}

/**
 * GDPR data export (Art. 15 and 20): everything we hold about the user, as JSON plus each
 * project's source files. Secrets are listed but masked; password hashes and tokens are omitted.
 */
export async function buildDataExport(userId: string) {
  const [u] = await db.select().from(user).where(eq(user.id, userId));
  if (!u) throw new Error("User not found");
  const projectRows = await db.select().from(projects).where(eq(projects.userId, userId));
  const ids = projectRows.map((p) => p.id);
  const [accounts, sessions, prefs, txs, refs, skillRows, connectorRows, channels, deps, atts] = await Promise.all([
    db.select({ provider: account.providerId, accountId: account.accountId, createdAt: account.createdAt, scope: account.scope }).from(account).where(eq(account.userId, userId)),
    db.select({ createdAt: session.createdAt, expiresAt: session.expiresAt, ipAddress: session.ipAddress, userAgent: session.userAgent }).from(session).where(eq(session.userId, userId)),
    db.select().from(preferences).where(eq(preferences.userId, userId)),
    db.select().from(creditTransactions).where(eq(creditTransactions.userId, userId)).orderBy(asc(creditTransactions.createdAt)),
    db.select().from(referrals).where(eq(referrals.referrerId, userId)),
    db.select().from(skills).where(eq(skills.userId, userId)),
    db.select({ connectorId: connectors.connectorId, hint: connectors.hint, createdAt: connectors.createdAt }).from(connectors).where(eq(connectors.userId, userId)),
    db.select({ type: notificationChannels.type, label: notificationChannels.label, events: notificationChannels.events, enabled: notificationChannels.enabled }).from(notificationChannels).where(eq(notificationChannels.userId, userId)),
    db.select().from(deployments).where(eq(deployments.userId, userId)),
    db.select({ id: attachments.id, name: attachments.name, mime: attachments.mime, size: attachments.size, createdAt: attachments.createdAt }).from(attachments).where(eq(attachments.userId, userId)),
  ]);
  const msgs = ids.length ? await db.select().from(messages).where(inArray(messages.projectId, ids)).orderBy(asc(messages.createdAt)) : [];

  const zip = new JSZip();
  const profile = {
    id: u.id,
    name: u.name,
    email: u.email,
    emailVerified: u.emailVerified,
    username: u.username,
    image: u.image,
    plan: u.plan,
    creditsUsd: u.creditsMicros / 1_000_000,
    referralCode: u.referralCode,
    createdAt: u.createdAt,
    strikes: u.strikes,
    restrictedAt: u.restrictedAt,
    restrictReason: u.restrictReason,
    signup: { ip: u.signupIp, network: u.signupAsn, viaHostingNetwork: u.signupHosting, deviceIdHash: u.signupDevice ? maskSecret(u.signupDevice) : null },
  };
  zip.file(
    "account.json",
    JSON.stringify({ exportedAt: new Date().toISOString(), profile, linkedAccounts: accounts, sessions, preferences: prefs[0] ?? null, credits: txs, referrals: refs, skills: skillRows, connectors: connectorRows.map((c) => ({ ...c, note: "Keys are stored encrypted and are not included." })), notificationChannels: channels, deployments: deps, attachments: atts }, null, 2),
  );
  for (const p of projectRows) {
    const dir = zip.folder(`projects/${p.id}-${p.name.replace(/[^\w.-]+/g, "_").slice(0, 40)}`)!;
    dir.file("project.json", JSON.stringify(p, null, 2));
    dir.file("conversation.json", JSON.stringify(msgs.filter((m) => m.projectId === p.id), null, 2));
    const files = await db.select({ path: projectFiles.path, content: projectFiles.content }).from(projectFiles).where(eq(projectFiles.projectId, p.id));
    for (const f of files) dir.file(`files/${f.path}`, f.content);
    const assets = await db.select({ path: projectAssets.path, data: projectAssets.data }).from(projectAssets).where(eq(projectAssets.projectId, p.id));
    for (const a of assets) dir.file(`files/${a.path}`, a.data);
  }
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
