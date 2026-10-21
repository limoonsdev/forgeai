import "server-only";
import { MODELS, DEFAULT_MODEL_ID, type ModelInfo } from "./models";
import type { PlanId } from "@/lib/config";

export type PublicModel = Pick<
  ModelInfo,
  "id" | "label" | "vendor" | "description" | "contextWindow" | "pricing" | "speed" | "intelligence" | "tags" | "minPlan"
> & { available: boolean; locked: boolean };

const PLAN_RANK: Record<PlanId, number> = { free: 0, pro: 1, studio: 2 };

export function isMockEnabled() {
  if (process.env.FORGED_MOCK_AI === "1") return true;
  if (process.env.FORGED_MOCK_AI === "0") return false;
  // Offline demo agent is available in development when no provider key is configured.
  return process.env.NODE_ENV !== "production" && !process.env.ANTHROPIC_API_KEY && !process.env.OPENROUTER_API_KEY;
}

export function isProviderConfigured(provider: ModelInfo["provider"]) {
  switch (provider) {
    case "anthropic":
      return Boolean(process.env.ANTHROPIC_API_KEY);
    case "openrouter":
      return Boolean(process.env.OPENROUTER_API_KEY);
    case "mock":
      return isMockEnabled();
  }
}

/* ── OpenRouter live catalog sync: keeps prices fresh and hides models that no longer exist ── */

type OpenRouterModel = { id: string; context_length?: number; pricing?: { prompt?: string; completion?: string; input_cache_read?: string } };
let orCache: { at: number; byId: Map<string, OpenRouterModel> } | null = null;
let orInflight: Promise<void> | null = null;

async function refreshOpenRouter() {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", {
      signal: AbortSignal.timeout(4000),
      headers: process.env.OPENROUTER_API_KEY ? { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` } : {},
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = (await res.json()) as { data: OpenRouterModel[] };
    orCache = { at: Date.now(), byId: new Map(json.data.map((m) => [m.id, m])) };
  } catch (err) {
    console.warn("[models] OpenRouter catalog refresh failed:", (err as Error).message);
    orCache = orCache ?? { at: Date.now(), byId: new Map() };
    orCache.at = Date.now() - 50 * 60_000; // retry in ~10 minutes
  }
}

async function openRouterCatalog() {
  if (!process.env.OPENROUTER_API_KEY) return null;
  if (!orCache || Date.now() - orCache.at > 60 * 60_000) {
    orInflight ??= refreshOpenRouter().finally(() => (orInflight = null));
    if (!orCache) await orInflight;
  }
  return orCache && orCache.byId.size > 0 ? orCache.byId : null;
}

/** Model info with live pricing applied. */
export async function resolveModel(id: string): Promise<ModelInfo | undefined> {
  const base = MODELS.find((m) => m.id === id);
  if (!base) return undefined;
  if (base.provider !== "openrouter") return base;
  const catalog = await openRouterCatalog();
  const live = catalog?.get(base.apiModel);
  if (!live?.pricing) return base;
  const perM = (v?: string) => (v !== undefined && v !== "" ? Number(v) * 1_000_000 : undefined);
  return {
    ...base,
    contextWindow: live.context_length ?? base.contextWindow,
    pricing: {
      input: perM(live.pricing.prompt) ?? base.pricing.input,
      output: perM(live.pricing.completion) ?? base.pricing.output,
      cacheRead: perM(live.pricing.input_cache_read),
    },
  };
}

export async function listModels(plan: PlanId = "free"): Promise<PublicModel[]> {
  const catalog = await openRouterCatalog();
  const out: PublicModel[] = [];
  for (const m of MODELS) {
    let available = isProviderConfigured(m.provider);
    if (available && m.provider === "openrouter" && catalog && !catalog.has(m.apiModel)) available = false;
    if (m.provider === "mock" && !available) continue;
    const resolved = (await resolveModel(m.id)) ?? m;
    out.push({
      id: m.id,
      label: m.label,
      vendor: m.vendor,
      description: m.description,
      contextWindow: resolved.contextWindow,
      pricing: resolved.pricing,
      speed: m.speed,
      intelligence: m.intelligence,
      tags: m.tags,
      minPlan: m.minPlan,
      available,
      locked: m.minPlan ? PLAN_RANK[plan] < PLAN_RANK[m.minPlan] : false,
    });
  }
  return out;
}

export function canUseModel(model: ModelInfo, plan: PlanId) {
  if (!isProviderConfigured(model.provider)) return { ok: false as const, reason: `${model.label} is not configured on this server.` };
  if (model.minPlan && PLAN_RANK[plan] < PLAN_RANK[model.minPlan])
    return { ok: false as const, reason: `${model.label} requires the ${model.minPlan === "pro" ? "Pro" : "Studio"} plan.` };
  return { ok: true as const };
}

/** Default model for a user: their preference if usable, else the first configured model. */
export function pickDefaultModel(preferred?: string | null, plan: PlanId = "free"): string {
  const candidates = [preferred, process.env.FORGED_DEFAULT_MODEL, DEFAULT_MODEL_ID, ...MODELS.map((m) => m.id)];
  for (const id of candidates) {
    const m = id ? MODELS.find((x) => x.id === id) : undefined;
    if (m && canUseModel(m, plan).ok) return m.id;
  }
  return DEFAULT_MODEL_ID;
}

/** Cost of one model call in USD (before markup). */
export function computeCostUsd(model: ModelInfo, usage: { inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; reportedCostUsd?: number }) {
  if (usage.reportedCostUsd !== undefined && usage.reportedCostUsd > 0) return usage.reportedCostUsd;
  const p = model.pricing;
  return (
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheReadTokens * (p.cacheRead ?? p.input) +
      usage.cacheWriteTokens * (p.cacheWrite ?? p.input)) /
    1_000_000
  );
}
