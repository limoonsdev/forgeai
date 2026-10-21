import type { PlanId } from "@/lib/config";

export type ModelProvider = "anthropic" | "openrouter" | "mock";
export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

export interface ModelInfo {
  /** Stable Forged id, stored on projects and runs. */
  id: string;
  label: string;
  vendor: "Anthropic" | "OpenAI" | "Google" | "xAI" | "DeepSeek" | "Qwen" | "Moonshot" | "Forged";
  provider: ModelProvider;
  /** Model id sent to the provider API. */
  apiModel: string;
  description: string;
  contextWindow: number;
  maxOutputTokens: number;
  /** USD per million tokens. */
  pricing: { input: number; output: number; cacheRead?: number; cacheWrite?: number };
  speed: 1 | 2 | 3 | 4 | 5;
  intelligence: 1 | 2 | 3 | 4 | 5;
  tags: string[];
  minPlan?: PlanId;
  /** Anthropic-only knobs. */
  anthropic?: { effort: { normal: Effort; saver: Effort }; serverFallback: boolean };
}

export const MODELS: ModelInfo[] = [
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    vendor: "Anthropic",
    provider: "anthropic",
    apiModel: "claude-sonnet-5-5",
    description: "Good quality at a reasonable price. The default for most builds.",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: { input: 2, output: 10, cacheRead: 0.2, cacheWrite: 2.5 },
    speed: 4,
    intelligence: 4,
    tags: ["Recommended"],
    anthropic: { effort: { normal: "medium", saver: "low" }, serverFallback: true },
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    vendor: "Anthropic",
    provider: "anthropic",
    apiModel: "claude-opus-5-5",
    description: "Stronger reasoning for large apps and difficult refactors.",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 },
    speed: 3,
    intelligence: 5,
    tags: ["Smartest"],
    anthropic: { effort: { normal: "high", saver: "low" }, serverFallback: true },
  },
  {
    id: "claude-fable-5-1",
    label: "Claude Fable 5.1",
    vendor: "Anthropic",
    provider: "anthropic",
    apiModel: "claude-fable-5-1",
    description: "Anthropic's most capable model, for the longest and hardest builds.",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: { input: 10, output: 50, cacheRead: 0.25, cacheWrite: 12.5 },
    speed: 2,
    intelligence: 5,
    tags: ["Most capable"],
    minPlan: "pro",
    anthropic: { effort: { normal: "high", saver: "medium" }, serverFallback: true },
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    vendor: "Anthropic",
    provider: "anthropic",
    apiModel: "claude-haiku-5-5",
    description: "Fast and inexpensive. Good for small edits and copy changes.",
    contextWindow: 1_000_000,
    maxOutputTokens: 128_000,
    pricing: { input: 0.1, output: 0.5, cacheRead: 0.01, cacheWrite: 0.125 },
    speed: 5,
    intelligence: 3,
    tags: ["Fastest", "Cheapest"],
    anthropic: { effort: { normal: "medium", saver: "low" }, serverFallback: false },
  },
  {
    id: "gpt-5.6-sol",
    label: "GPT-5.6 Sol",
    vendor: "OpenAI",
    provider: "openrouter",
    apiModel: "openai/gpt-5.6-sol",
    description: "OpenAI's main model. Solid on full-stack TypeScript.",
    contextWindow: 1_050_000,
    maxOutputTokens: 64_000,
    pricing: { input: 5, output: 30 },
    speed: 3,
    intelligence: 5,
    tags: [],
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    vendor: "Google",
    provider: "openrouter",
    apiModel: "google/gemini-3.6-flash",
    description: "Fast Google model that reads screenshots well. Very long context.",
    contextWindow: 1_048_576,
    maxOutputTokens: 64_000,
    pricing: { input: 0.5, output: 3 },
    speed: 5,
    intelligence: 4,
    tags: ["Fast"],
  },
  {
    id: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    vendor: "Google",
    provider: "openrouter",
    apiModel: "google/gemini-2.5-pro",
    description: "Google model with long context, slower than Flash.",
    contextWindow: 1_048_576,
    maxOutputTokens: 64_000,
    pricing: { input: 1.25, output: 10 },
    speed: 3,
    intelligence: 4,
    tags: [],
  },
  {
    id: "grok-4.6",
    label: "Grok 4.6",
    vendor: "xAI",
    provider: "openrouter",
    apiModel: "x-ai/grok-4.6",
    description: "xAI's main model for coding and tool use.",
    contextWindow: 256_000,
    maxOutputTokens: 64_000,
    pricing: { input: 3, output: 15 },
    speed: 3,
    intelligence: 4,
    tags: [],
  },
  {
    id: "deepseek-v3.1",
    label: "DeepSeek V3.1",
    vendor: "DeepSeek",
    provider: "openrouter",
    apiModel: "deepseek/deepseek-chat-v3.1",
    description: "Open-weights model, much cheaper than the frontier models.",
    contextWindow: 163_840,
    maxOutputTokens: 32_000,
    pricing: { input: 0.27, output: 1.1 },
    speed: 3,
    intelligence: 3,
    tags: ["Open"],
  },
  {
    id: "qwen3-coder",
    label: "Qwen3 Coder",
    vendor: "Qwen",
    provider: "openrouter",
    apiModel: "qwen/qwen3-coder",
    description: "Alibaba's coding model, tuned for tool use.",
    contextWindow: 262_144,
    maxOutputTokens: 32_000,
    pricing: { input: 0.3, output: 1.2 },
    speed: 4,
    intelligence: 3,
    tags: ["Open"],
  },
  {
    id: "kimi-k2",
    label: "Kimi K2",
    vendor: "Moonshot",
    provider: "openrouter",
    apiModel: "moonshotai/kimi-k2",
    description: "Moonshot's open-weights model, good at multi-step coding.",
    contextWindow: 131_072,
    maxOutputTokens: 32_000,
    pricing: { input: 0.6, output: 2.5 },
    speed: 3,
    intelligence: 3,
    tags: ["Open"],
  },
  {
    id: "forged-demo",
    label: "Forged Demo",
    vendor: "Forged",
    provider: "mock",
    apiModel: "forged-demo",
    description: "Scripted offline agent for local development and tests. No API key needed.",
    contextWindow: 200_000,
    maxOutputTokens: 16_000,
    pricing: { input: 0.5, output: 2 },
    speed: 5,
    intelligence: 1,
    tags: ["Demo"],
  },
];

export const DEFAULT_MODEL_ID = "claude-sonnet-5-5";

export function getModel(id: string | null | undefined): ModelInfo | undefined {
  if (!id) return undefined;
  return MODELS.find((m) => m.id === id);
}

/** Key into BRAND_LOGOS (src/components/brand/brand-logos.ts). */
export function vendorLogo(vendor: ModelInfo["vendor"]) {
  switch (vendor) {
    case "Anthropic":
      return "claude";
    case "OpenAI":
      return "openai";
    case "Google":
      return "gemini";
    case "xAI":
      return "grok";
    case "DeepSeek":
      return "deepseek";
    case "Qwen":
      return "qwen";
    case "Moonshot":
      return "kimi";
    default:
      return null;
  }
}

export function vendorColor(vendor: ModelInfo["vendor"]) {
  switch (vendor) {
    case "Anthropic":
      return "#d97757";
    case "OpenAI":
      return "#10a37f";
    case "Google":
      return "#4285f4";
    case "xAI":
      return "#e5e5e5";
    case "DeepSeek":
      return "#4d6bfe";
    case "Qwen":
      return "#615ced";
    case "Moonshot":
      return "#16b8f3";
    default:
      return "#ff7a1a";
  }
}
