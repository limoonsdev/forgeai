import { z } from "zod";
import { createApiKey, listApiKeys } from "@/lib/server/api-keys";
import { json, readJson, withApi } from "@/lib/server/api";

export const GET = withApi(async (_req, { auth }) => json({ keys: await listApiKeys(auth.userId) }), { sessionOnly: true });

export const POST = withApi(
  async (req, { auth }) => {
    const { name } = z.object({ name: z.string().min(1).max(60) }).parse(await readJson(req));
    const existing = await listApiKeys(auth.userId);
    if (existing.length >= 20) return json({ error: { code: "limit", message: "You can have up to 20 active keys." } }, { status: 400 });
    const { key, record } = await createApiKey(auth.userId, name);
    return json({ key, record: { id: record.id, name: record.name, prefix: record.prefix, createdAt: record.createdAt } }, { status: 201 });
  },
  { sessionOnly: true },
);
