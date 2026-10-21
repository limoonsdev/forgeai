import { z } from "zod";
import { db } from "@/lib/db";
import { abuseReports } from "@/lib/db/schema";
import { newId } from "@/lib/server/ids";
import { rateLimit } from "@/lib/server/rate-limit";
import { clientIp, errorResponse, json, readJson, sameOrigin } from "@/lib/server/api";
import { emailConfigured, emailLayout, sendEmail } from "@/lib/server/email";
import { legalEntity } from "@/lib/legal/entity";

const REASONS = ["csam", "phishing", "malware", "fraud", "illegal", "hate", "privacy", "copyright", "other"] as const;

const Body = z.object({
  url: z.string().trim().min(4).max(500),
  reason: z.enum(REASONS),
  details: z.string().trim().max(4000).default(""),
  email: z.union([z.literal(""), z.string().trim().email().max(200)]).optional(),
  website: z.string().max(0).optional(), // honeypot: must stay empty
});

/** Public notice-and-action endpoint (Digital Services Act). No account needed; limited per IP. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return errorResponse(403, "csrf", "Cross-origin request blocked.");
  const ip = clientIp(req);
  const rl = rateLimit(`report:${ip}`, 6, 3600_000);
  if (!rl.ok) return errorResponse(429, "rate_limited", "Too many reports from this network. Please email us instead.");
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await readJson(req, 16_000));
  } catch {
    return errorResponse(400, "invalid_request", "Please check the form and try again.");
  }
  const id = newId("rep");
  await db.insert(abuseReports).values({ id, url: body.url, reason: body.reason, details: body.details, reporterEmail: body.email || null, ip });
  const e = legalEntity();
  if (emailConfigured()) {
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    await sendEmail({
      to: e.abuseEmail,
      subject: `[Forged report] ${body.reason}: ${body.url.slice(0, 80)}`,
      html: emailLayout(
        "New abuse report",
        `<p><b>Reason:</b> ${esc(body.reason)}<br><b>URL:</b> ${esc(body.url)}<br><b>Reporter:</b> ${esc(body.email || "anonymous")}<br><b>ID:</b> ${id}</p><p>${esc(body.details).replace(/\n/g, "<br>")}</p>`,
      ),
    }).catch((err) => console.warn("[report] email failed", (err as Error).message));
  }
  return json({ id }, { status: 201 });
}
