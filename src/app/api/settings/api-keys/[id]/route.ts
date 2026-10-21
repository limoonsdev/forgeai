import { revokeApiKey } from "@/lib/server/api-keys";
import { errorResponse, json, withApi } from "@/lib/server/api";

export const DELETE = withApi<{ id: string }>(
  async (_req, { auth, params }) => {
    const ok = await revokeApiKey(auth.userId, params.id);
    return ok ? json({ revoked: true }) : errorResponse(404, "not_found", "Key not found");
  },
  { sessionOnly: true },
);
