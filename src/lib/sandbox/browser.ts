import "server-only";
import type { SandboxHandle } from "./types";

function q(s: string) {
  return `'${s.replace(/'/g, `'\\''`)}'`;
}

export type BrowserResult = { image: string; cursor: { x: number; y: number } | null; url: string; title: string; label: string; consoleErrors: string[] };

const NOISE = /(_next\/hmr|webpack-hmr|favicon\.ico|Download the React DevTools|\[Fast Refresh\])/;

/**
 * Drives the headless Chromium that lives inside the project VM (so untrusted app code never
 * runs next to Forged's own services). Returns a JPEG screenshot and the virtual cursor position.
 */
export async function browserAction(
  _projectId: string,
  sbx: SandboxHandle,
  action: { action: string; path?: string; x?: number; y?: number; text?: string; key?: string; dy?: number },
): Promise<BrowserResult> {
  const r = await sbx.exec(`node /opt/forged/browser.mjs ${q(JSON.stringify(action))}`, { timeoutMs: 90_000 });
  let data: Partial<BrowserResult> & { error?: string };
  try {
    data = JSON.parse(r.stdout.trim().split("\n").pop() || "{}");
  } catch {
    throw new Error(`Browser tool failed: ${(r.stderr || r.stdout).slice(-300)}`);
  }
  if (data.error) throw new Error(`Browser: ${data.error}`);
  return {
    image: data.image ?? "",
    cursor: data.cursor ?? null,
    url: data.url ?? "/",
    title: data.title ?? "",
    label: data.label ?? action.action,
    consoleErrors: (data.consoleErrors ?? []).filter((e) => !NOISE.test(e)),
  };
}

export type AuditReport = {
  path: string;
  scores: { performance: number; accessibility: number; seo: number; bestPractices: number };
  metrics: Record<string, number | string | boolean>;
  issues: { category: string; severity: "error" | "warn" | "info"; message: string }[];
  text: string;
};

export async function auditPage(_projectId: string, sbx: SandboxHandle, path: string): Promise<AuditReport> {
  let data: (Omit<AuditReport, "text"> & { error?: string }) | null = null;
  let lastErr = "";
  // The first run in a fresh VM also starts Chromium; retry once if it didn't produce a report.
  for (let attempt = 0; attempt < 2 && !data; attempt++) {
    const r = await sbx.exec(`node /opt/forged/audit.mjs ${q(path)}`, { timeoutMs: 150_000 });
    const line = r.stdout.trim().split("\n").pop() ?? "";
    try {
      const parsed = line ? JSON.parse(line) : null;
      if (parsed?.scores) data = parsed;
      else lastErr = parsed?.error ?? (r.stderr || r.stdout).slice(-300);
    } catch {
      lastErr = (r.stderr || r.stdout).slice(-300);
    }
  }
  if (!data) throw new Error(`The audit couldn't run: ${lastErr || "no output"}`);
  data.issues = (data.issues ?? []).filter((i) => !NOISE.test(i.message));
  const s = data.scores;
  const text = [
    `Audit of ${data.path}: performance ${s.performance}, accessibility ${s.accessibility}, SEO ${s.seo}, best practices ${s.bestPractices} (out of 100).`,
    ...data.issues.map((i) => `- [${i.category}/${i.severity}] ${i.message}`),
  ].join("\n");
  return { ...data, text };
}
