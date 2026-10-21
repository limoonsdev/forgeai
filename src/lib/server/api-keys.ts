import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { apiKeys } from "@/lib/db/schema";
import { newId } from "./ids";

export const API_KEY_PREFIX = "fg_live_";

export function hashKey(key: string) {
  return createHash("sha256").update(key).digest("hex");
}

export async function createApiKey(userId: string, name: string) {
  const secret = `${API_KEY_PREFIX}${randomBytes(24).toString("base64url")}`;
  const [row] = await db
    .insert(apiKeys)
    .values({ id: newId("key"), userId, name: name.trim().slice(0, 60) || "API key", prefix: secret.slice(0, 14), keyHash: hashKey(secret) })
    .returning();
  return { key: secret, record: row };
}

export async function listApiKeys(userId: string) {
  return db
    .select({ id: apiKeys.id, name: apiKeys.name, prefix: apiKeys.prefix, lastUsedAt: apiKeys.lastUsedAt, createdAt: apiKeys.createdAt })
    .from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), isNull(apiKeys.revokedAt)))
    .orderBy(desc(apiKeys.createdAt));
}

export async function revokeApiKey(userId: string, id: string) {
  const r = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)))
    .returning({ id: apiKeys.id });
  return r.length > 0;
}

export async function verifyApiKey(key: string) {
  if (!key.startsWith(API_KEY_PREFIX)) return null;
  const [row] = await db
    .select({ id: apiKeys.id, userId: apiKeys.userId, lastUsedAt: apiKeys.lastUsedAt })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, hashKey(key)), isNull(apiKeys.revokedAt)));
  if (!row) return null;
  if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
    await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id));
  }
  return row;
}
