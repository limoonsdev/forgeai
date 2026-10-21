import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { isMockEnabled, isProviderConfigured } from "@/lib/ai/catalog";
import { getSandboxProvider } from "@/lib/sandbox";

export async function GET() {
  let database = "ok";
  try {
    await db.execute(sql`select 1`);
  } catch {
    database = "down";
  }
  const sandbox = await getSandboxProvider().catch(() => null);
  const body = {
    status: database === "ok" ? "ok" : "degraded",
    database,
    ai: { anthropic: isProviderConfigured("anthropic"), openrouter: isProviderConfigured("openrouter"), demo: isMockEnabled() },
    sandbox: sandbox?.name ?? "disabled",
    time: new Date().toISOString(),
  };
  return Response.json(body, { status: database === "ok" ? 200 : 503 });
}
