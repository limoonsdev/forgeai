import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationChannels } from "@/lib/db/schema";
import { sendTestNotification } from "@/lib/server/notifications";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

/** Sends a test message to one channel. */
export const POST = withApi(
  async (req, { auth }) => {
    const { id } = z.object({ id: z.string().max(40) }).parse(await readJson(req, 1_000));
    const [row] = await db.select().from(notificationChannels).where(and(eq(notificationChannels.id, id), eq(notificationChannels.userId, auth.userId)));
    if (!row) return errorResponse(404, "not_found", "Channel not found");
    const ok = await sendTestNotification(auth.userId, row);
    return ok ? json({ sent: true }) : errorResponse(502, "delivery_failed", "The message couldn't be delivered. Check the address or token.");
  },
  { rateLimit: 10, bucket: "notify-test" },
);
