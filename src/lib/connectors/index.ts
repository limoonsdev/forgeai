import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { connectors, projects } from "@/lib/db/schema";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/server/crypto";
import { newId } from "@/lib/server/ids";
import { CONNECTORS, getConnector, type ConnectorDef } from "./catalog";

export { CONNECTORS, getConnector };

export class ConnectorError extends Error {}

export async function listUserConnectors(userId: string) {
  const rows = await db.select().from(connectors).where(eq(connectors.userId, userId));
  return rows.map((r) => ({ id: r.id, connectorId: r.connectorId, hint: r.hint, createdAt: r.createdAt }));
}

export async function saveConnector(userId: string, connectorId: string, values: Record<string, string>) {
  const def = getConnector(connectorId);
  if (!def) throw new ConnectorError("Unknown connector");
  const clean: Record<string, string> = {};
  for (const f of def.fields) {
    const v = (values[f.name] ?? "").trim();
    if (!v && !f.optional) throw new ConnectorError(`${f.label} is required`);
    if (v.length > 4000) throw new ConnectorError(`${f.label} is too long`);
    if (/[\r\n]/.test(v)) throw new ConnectorError(`${f.label} must be a single line`);
    if (v) clean[f.name] = v;
  }
  const first = def.fields.find((f) => clean[f.name]);
  const hint = first ? (first.secret ? maskSecret(clean[first.name]) : clean[first.name].slice(0, 40)) : "";
  const secrets = encryptSecret(JSON.stringify(clean));
  await db
    .insert(connectors)
    .values({ id: newId("con"), userId, connectorId, secrets, hint })
    .onConflictDoUpdate({ target: [connectors.userId, connectors.connectorId], set: { secrets, hint, updatedAt: new Date() } });
}

export async function deleteConnector(userId: string, connectorId: string) {
  await db.delete(connectors).where(and(eq(connectors.userId, userId), eq(connectors.connectorId, connectorId)));
}

export async function getConnectorSecrets(userId: string, connectorId: string): Promise<Record<string, string> | null> {
  const [row] = await db.select().from(connectors).where(and(eq(connectors.userId, userId), eq(connectors.connectorId, connectorId)));
  if (!row) return null;
  try {
    return JSON.parse(decryptSecret(row.secrets));
  } catch {
    return null;
  }
}

/** Env vars injected into a project's VM (.env.local) and its published app — never into project files. */
export async function connectorEnvForProject(projectId: string) {
  const [p] = await db.select({ userId: projects.userId }).from(projects).where(eq(projects.id, projectId));
  if (!p) return {};
  return connectorEnvForUser(p.userId);
}

export async function connectorEnvForUser(userId: string) {
  const rows = await db.select().from(connectors).where(eq(connectors.userId, userId));
  const env: Record<string, string> = {};
  for (const r of rows) {
    const def = getConnector(r.connectorId);
    if (!def || def.internal) continue;
    try {
      Object.assign(env, JSON.parse(decryptSecret(r.secrets)));
    } catch {}
  }
  return env;
}

/** Secret values the agent must never echo back (scrubbed from tool outputs). */
export async function secretValuesForUser(userId: string) {
  const rows = await db.select().from(connectors).where(eq(connectors.userId, userId));
  const values: string[] = [];
  for (const r of rows) {
    const def = getConnector(r.connectorId);
    try {
      const data = JSON.parse(decryptSecret(r.secrets)) as Record<string, string>;
      for (const f of def?.fields ?? []) if (f.secret && data[f.name]?.length >= 8) values.push(data[f.name]);
    } catch {}
  }
  return values;
}

/** Lines for the agent's context block: what the user connected and how to use it. */
export async function connectorContext(userId: string): Promise<{ lines: string[]; defs: ConnectorDef[] }> {
  const rows = await listUserConnectors(userId);
  const defs = rows.map((r) => getConnector(r.connectorId)).filter((d): d is ConnectorDef => Boolean(d && !d.internal));
  const lines = defs.map(
    (d) => `- ${d.id} (${d.name}): env ${d.fields.map((f) => f.name).join(", ")}${d.media?.length ? `; generate_media: ${d.media.join("/")}` : ""}. Load skill "connector-${d.id}" before using it.`,
  );
  return { lines, defs };
}
