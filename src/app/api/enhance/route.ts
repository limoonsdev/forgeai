import { z } from "zod";
import { EnhanceError, enhancePrompt } from "@/lib/ai/enhance";
import { errorResponse, json, readJson, withApi } from "@/lib/server/api";

const Body = z.object({ prompt: z.string().max(6000), level: z.union([z.literal(1), z.literal(2), z.literal(3)]) });

export const POST = withApi(
  async (req, { auth }) => {
    const body = Body.parse(await readJson(req, 64_000));
    try {
      return json(await enhancePrompt(auth.userId, body.prompt, body.level));
    } catch (err) {
      if (err instanceof EnhanceError) return errorResponse(err.status, "enhance_failed", err.message);
      throw err;
    }
  },
  { rateLimit: 20, bucket: "enhance" },
);
