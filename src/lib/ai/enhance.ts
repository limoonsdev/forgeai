import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { user } from "@/lib/db/schema";
import { CREDITS } from "@/lib/config";
import { chargeRunUsage } from "@/lib/server/credits";
import { newId } from "@/lib/server/ids";
import { computeCostUsd, isProviderConfigured, resolveModel } from "./catalog";
import type { ModelInfo } from "./models";
import { MODELS } from "./models";
import { checkPrompt, recordViolation } from "./moderation";
import { streamModel } from "./providers";

export type EnhanceLevel = 1 | 2 | 3;

export const ENHANCE_LEVELS: Record<EnhanceLevel, { label: string; hint: string }> = {
  1: { label: "Tidy", hint: "Fix wording and make it unambiguous. Same scope." },
  2: { label: "Detailed", hint: "Add pages, sections, features and content ideas." },
  3: { label: "Full brief", hint: "A complete spec: structure, design direction, data, interactions." },
};

const INSTRUCTIONS: Record<EnhanceLevel, string> = {
  1: "Rewrite the request so it is clear and unambiguous. Fix spelling and grammar. Keep the same scope and roughly the same length. Do not invent features.",
  2: "Expand the request into a clear brief: list the pages or screens, the main sections of each, the key features and realistic example content. Keep every idea the user gave. Stay under 180 words.",
  3: "Turn the request into a complete build brief with short headed sections: Goal, Pages and routes, Features, Content, Design direction (colours, type, mood, references the user named), Data and state, Interactions and edge cases, Done when. Keep every idea the user gave and make sensible, specific choices for the rest. Stay under 380 words.",
};

const SYSTEM = `You improve prompts that people send to an AI agent which builds Next.js web apps.
Rules:
- Output only the improved prompt, as plain text (simple "Heading:" lines and "- " bullets are fine). No preamble, no quotes, no commentary.
- Write in the same language as the original prompt.
- Keep URLs, names, brand colours and any concrete detail exactly as given.
- The result must still be a request for a web app or website (Next.js). Never add backend languages or native apps.
- Plain, specific wording. Avoid filler adjectives and marketing language.`;

export class EnhanceError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

async function enhancerModel(): Promise<ModelInfo | undefined> {
  if (isProviderConfigured("anthropic")) return resolveModel("claude-haiku-5-5");
  if (isProviderConfigured("openrouter")) return resolveModel("gemini-3.6-flash");
  if (isProviderConfigured("mock")) return MODELS.find((m) => m.provider === "mock");
  return undefined;
}

function mockEnhance(prompt: string, level: EnhanceLevel) {
  const base = prompt.trim().replace(/\s+/g, " ");
  const sentence = base.charAt(0).toUpperCase() + base.slice(1).replace(/[.!?]*$/, ".");
  if (level === 1) return sentence;
  const detail = `${sentence}\n\nPages:\n- Home with a clear headline, a short explanation and one call to action\n- A features or catalogue page\n- A contact or sign-up page\n\nKeep it responsive, accessible and fast.`;
  if (level === 2) return detail;
  return `Goal: ${sentence}\n\n${detail.split("\n\n").slice(1).join("\n\n")}\n\nDesign direction: one accent colour, generous spacing, readable type.\n\nDone when: every page renders without errors and works on mobile.`;
}

export async function enhancePrompt(userId: string, prompt: string, level: EnhanceLevel) {
  const text = prompt.trim();
  if (text.length < 3) throw new EnhanceError("Write a few words first.");
  if (text.length > 6000) throw new EnhanceError("That prompt is too long to enhance (6,000 characters max).");

  const [owner] = await db.select({ credits: user.creditsMicros, restrictedAt: user.restrictedAt }).from(user).where(eq(user.id, userId));
  if (!owner) throw new EnhanceError("Account not found", 404);
  if (owner.restrictedAt) throw new EnhanceError("Your account is restricted.", 403);

  const verdict = await checkPrompt(text);
  if (!verdict.ok) {
    await recordViolation(userId, null, verdict, text);
    throw new EnhanceError(verdict.message, 422);
  }

  const model = await enhancerModel();
  if (!model) throw new EnhanceError("Prompt enhancement isn't available on this server.", 503);
  if (model.provider === "mock") return { prompt: mockEnhance(text, level), costMicros: 0 };
  if (owner.credits < CREDITS.minBalanceToRunMicros) throw new EnhanceError("You're out of credits.", 402);

  let out = "";
  let usage = { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0 } as Parameters<typeof computeCostUsd>[1];
  for await (const ev of streamModel({
    model,
    system: SYSTEM,
    messages: [{ role: "user", content: { kind: "user", text: `${INSTRUCTIONS[level]}\n\n<prompt>\n${text}\n</prompt>` } }],
    tools: [],
    tokenSaver: true,
    maxTokens: level === 3 ? 1400 : 700,
    signal: AbortSignal.timeout(45_000),
  })) {
    if (ev?.type === "done") {
      out = ev.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n").trim();
      usage = ev.usage;
    }
  }
  out = out.replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!out) throw new EnhanceError("The enhancer returned nothing. Try again.", 502);
  const costMicros = Math.ceil(computeCostUsd(model, usage) * CREDITS.markup * 1_000_000);
  if (costMicros > 0) await chargeRunUsage({ userId, runId: newId("enh"), costMicros, description: "Prompt enhancement", metadata: { level } });
  return { prompt: out.slice(0, 8000), costMicros };
}
