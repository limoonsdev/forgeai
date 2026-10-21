import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { preferences } from "@/lib/db/schema";
import { MODELS } from "@/lib/ai/models";
import { json, readJson, withApi } from "@/lib/server/api";

export const GET = withApi(
  async (_req, { auth }) => {
    await db.insert(preferences).values({ userId: auth.userId }).onConflictDoNothing();
    const [prefs] = await db.select().from(preferences).where(eq(preferences.userId, auth.userId));
    return json({ preferences: prefs });
  },
  {},
);

const Body = z.object({
  defaultModel: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || MODELS.some((m) => m.id === v), "Unknown model"),
  tokenSaver: z.boolean().optional(),
  aiLanguage: z.enum(["auto", "en", "fr", "es", "de", "it", "pt", "nl", "ja", "zh"]).optional(),
  stylePreset: z.enum(["modern", "minimal", "playful", "corporate", "brutalist", "luxury"]).optional(),
  customInstructions: z.string().max(4000).optional(),
  autoFixErrors: z.boolean().optional(),
  askClarifyingQuestions: z.boolean().optional(),
  emailNotifications: z.boolean().optional(),
});

export const PUT = withApi(
  async (req, { auth }) => {
    const body = Body.parse(await readJson(req));
    await db.insert(preferences).values({ userId: auth.userId }).onConflictDoNothing();
    const [prefs] = await db
      .update(preferences)
      .set({ ...body, updatedAt: new Date() })
      .where(eq(preferences.userId, auth.userId))
      .returning();
    return json({ preferences: prefs });
  },
  {},
);
