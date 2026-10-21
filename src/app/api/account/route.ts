import { z } from "zod";
import { and, eq, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { usernameProblem } from "@/lib/server/username";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

const Body = z.object({ username: z.string().trim().toLowerCase().max(24) });

/** Changes the username (used in published app addresses). */
export const PATCH = withApi(
  async (req, { auth }) => {
    const { username } = Body.parse(await readJson(req, 4096));
    const problem = usernameProblem(username);
    if (problem) return errorResponse(400, "invalid_username", problem);
    const [taken] = await db.select({ id: user.id }).from(user).where(and(eq(user.username, username), ne(user.id, auth.userId)));
    if (taken) return errorResponse(409, "username_taken", "This username is already taken.");
    await db.update(user).set({ username, updatedAt: new Date() }).where(eq(user.id, auth.userId));
    return json({ username });
  },
  { rateLimit: 10, bucket: "account" },
);
