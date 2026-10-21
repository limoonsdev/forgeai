import { z } from "zod";
import { and, count, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationChannels } from "@/lib/db/schema";
import { encryptSecret, maskSecret } from "@/lib/server/crypto";
import { newId } from "@/lib/server/ids";
import { CHANNEL_RULES } from "@/lib/server/notifications";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

const EVENTS = ["run_completed", "awaiting_input", "run_failed", "agent_message", "deploy_live"] as const;
const TYPES = ["discord", "slack", "telegram", "ntfy", "email"] as const;

async function list(userId: string) {
  const rows = await db.select().from(notificationChannels).where(eq(notificationChannels.userId, userId));
  return rows.map((r) => ({ id: r.id, type: r.type, label: r.label, enabled: r.enabled, events: r.events, createdAt: r.createdAt }));
}

export const GET = withApi(async (_req, { auth }) => json({ channels: await list(auth.userId) }));

const Create = z.object({ type: z.enum(TYPES), target: z.string().trim().max(500), label: z.string().trim().max(60).default(""), events: z.array(z.enum(EVENTS)).min(1).max(EVENTS.length) });

export const POST = withApi(
  async (req, { auth }) => {
    const body = Create.parse(await readJson(req, 8_000));
    const target = body.type === "email" ? "account" : body.target;
    if (!CHANNEL_RULES[body.type].validate(target)) return errorResponse(400, "invalid_target", `That doesn't look right. ${CHANNEL_RULES[body.type].hint}.`);
    const [{ n }] = await db.select({ n: count() }).from(notificationChannels).where(eq(notificationChannels.userId, auth.userId));
    if (n >= 10) return errorResponse(409, "too_many", "You can add up to 10 channels.");
    await db.insert(notificationChannels).values({
      id: newId("nch"),
      userId: auth.userId,
      type: body.type,
      target: encryptSecret(target),
      label: body.label || (body.type === "email" ? "Account email" : `${CHANNEL_RULES[body.type].label} · ${maskSecret(target.split("|")[0])}`),
      events: body.events,
    });
    return json({ channels: await list(auth.userId) }, { status: 201 });
  },
  { rateLimit: 20, bucket: "notifications" },
);

const Patch = z.object({ id: z.string().max(40), enabled: z.boolean().optional(), events: z.array(z.enum(EVENTS)).min(1).optional() });

export const PATCH = withApi(async (req, { auth }) => {
  const body = Patch.parse(await readJson(req, 4_000));
  const patch: Partial<typeof notificationChannels.$inferInsert> = {};
  if (body.enabled !== undefined) patch.enabled = body.enabled;
  if (body.events) patch.events = body.events;
  await db.update(notificationChannels).set(patch).where(and(eq(notificationChannels.id, body.id), eq(notificationChannels.userId, auth.userId)));
  return json({ channels: await list(auth.userId) });
});

export const DELETE = withApi(async (req, { auth }) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return errorResponse(400, "invalid_request", "id is required");
  await db.delete(notificationChannels).where(and(eq(notificationChannels.id, id), eq(notificationChannels.userId, auth.userId)));
  return json({ channels: await list(auth.userId) });
});
