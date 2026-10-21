import { compactNow } from "@/lib/ai/agent";
import { json, withApi } from "@/lib/server/api";

type P = { id: string };

/** Summarises the conversation so far into a compact checkpoint. */
export const POST = withApi<P>(async (_req, { auth, params }) => json({ message: await compactNow(params.id, auth.userId) }), { rateLimit: 6, bucket: "compact" });
