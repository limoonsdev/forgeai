import "server-only";
import { and, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { moderationFlags, user } from "@/lib/db/schema";
import { newId } from "@/lib/server/ids";

/**
 * Prompt moderation. Two layers:
 *  1. Local intent patterns (EN/FR) for content Forged never builds (instant, free, no data leaves the server).
 *  2. OpenAI's free moderation endpoint when OPENAI_MODERATION_KEY is set (catches paraphrases).
 * Strikes: blocked prompts add a strike; 3 strikes within 30 days restrict the account. CSAM bans immediately.
 */

type Category = "csam" | "phishing" | "malware" | "fraud" | "violence" | "hate" | "self_harm" | "sexual" | "illegal_goods";

const RULES: { category: Category; severity: "ban" | "block"; patterns: RegExp[] }[] = [
  {
    category: "csam",
    severity: "ban",
    patterns: [
      /\b(child|kid|minor|underage|preteen|enfant|mineur|mineure|gamin)\w*\b.{0,40}\b(porn|nude|naked|sex|erotic|nsfw|porno|nu|nue|sexuel)\w*/,
      /\b(porn|nude|naked|sex|erotic|nsfw|porno|sexuel)\w*\b.{0,40}\b(child|kid|minor|underage|preteen|enfant|mineur|mineure)\w*/,
      /\b(cp|pedo|loli|shota)\b.{0,30}\b(site|gallery|galerie|images|videos)/,
    ],
  },
  {
    category: "phishing",
    severity: "block",
    patterns: [
      /\b(fake|clone|copy|replica|faux|fausse|copie|imite|imitant)\w*\b.{0,50}\b(login|sign[ -]?in|connexion|identifiant)\w*.{0,60}\b(paypal|bank|banque|apple|google|microsoft|outlook|office ?365|facebook|instagram|netflix|amazon|binance|coinbase|metamask|ledger|steam|roblox|ameli|impots|caf|la poste|chronopost|dhl|ups|fedex|credit agricole|bnp|societe generale|revolut)\b/,
      /\b(steal|harvest|capture|grab|collect|voler|recuperer|recolter|capturer)\w*\b.{0,40}\b(password|credential|login|card number|cvv|seed phrase|mot de passe|identifiants|numero de carte|phrase de recuperation)s?\b/,
      /\b(phishing|hameconnage)\b.{0,40}\b(page|site|kit|campaign|campagne)\b/,
      /\b(seed phrase|recovery phrase|phrase de recuperation)\b.{0,60}\b(form|input|enter|saisir|entrer|submit)\b/,
    ],
  },
  {
    category: "malware",
    severity: "block",
    patterns: [
      /\b(keylogger|ransomware|cryptojacker|crypto ?miner (?:in|dans) (?:the )?(?:browser|navigateur)|botnet|rat (?:trojan|payload)|stealer|infostealer|drainer)\b/,
      /\b(drain|vider)\w*\b.{0,30}\b(wallet|portefeuille)s?\b/,
      /\b(bypass|contourner)\w*\b.{0,30}\b(antivirus|edr|captcha of|2fa of|authentification)\b/,
    ],
  },
  {
    category: "fraud",
    severity: "block",
    patterns: [
      /\b(fake|faux|fausse)\w*\b.{0,30}\b(invoice|receipt|passport|id card|carte d'identite|diploma|diplome|bank statement|releve bancaire|payslip|fiche de paie|ordonnance|prescription)s?\b/,
      /\b(ponzi|pyramid scheme|schema de ponzi|pump and dump)\b/,
      /\b(fake|faux)\b.{0,20}\b(giveaway|airdrop)\b.{0,40}\b(crypto|wallet|btc|eth|usdt)\b/,
    ],
  },
  {
    category: "violence",
    severity: "block",
    patterns: [/\b(how to|comment)\b.{0,30}\b(make|build|fabriquer|construire)\b.{0,30}\b(bomb|explosive|bombe|explosif|nerve agent|pipe bomb)s?\b/],
  },
  {
    category: "illegal_goods",
    severity: "block",
    patterns: [
      /\b(sell|buy|vendre|acheter|shop|store|boutique|marketplace)\b.{0,40}\b(cocaine|heroin|meth|fentanyl|mdma|cannabis illegal|stolen cards|cartes volees|cvv dumps|fake ids|faux papiers|unregistered guns|armes non declarees)\b/,
    ],
  },
  {
    category: "sexual",
    severity: "block",
    patterns: [/\b(porn|porno|xxx|escort|onlyfans leak|hentai)\b.{0,30}\b(site|website|platform|plateforme|tube|gallery|galerie)\b/],
  },
  {
    category: "hate",
    severity: "block",
    patterns: [/\b(recruit|recruter|propaganda|propagande)\w*\b.{0,40}\b(isis|daech|al[- ]qaeda|neo[- ]?nazi|kkk|white supremac)/],
  },
];

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[0@]/g, (c) => (c === "0" ? "o" : "a"))
    .replace(/[1!|]/g, "i")
    .replace(/3/g, "e")
    .replace(/\$/g, "s")
    .replace(/[_*.~-]+/g, " ")
    .replace(/\s+/g, " ");
}

export type ModerationResult = { ok: true } | { ok: false; category: string; severity: "ban" | "block"; message: string };

async function openAiModeration(text: string): Promise<{ category: string } | null> {
  const key = process.env.OPENAI_MODERATION_KEY;
  if (!key) return null;
  try {
    const res = await fetch("https://api.openai.com/v1/moderations", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: "omni-moderation-latest", input: text.slice(0, 20_000) }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { results: { flagged: boolean; categories: Record<string, boolean> }[] };
    const r = data.results?.[0];
    if (!r?.flagged) return null;
    const severe = ["sexual/minors", "illicit/violent", "violence/graphic", "self-harm/instructions", "hate/threatening"];
    const hit = Object.entries(r.categories).find(([k, v]) => v && severe.includes(k));
    return hit ? { category: hit[0] } : null;
  } catch {
    return null;
  }
}

export async function checkPrompt(text: string): Promise<ModerationResult> {
  const n = normalize(text);
  for (const rule of RULES) {
    if (rule.patterns.some((p) => p.test(n))) {
      return {
        ok: false,
        category: rule.category,
        severity: rule.severity,
        message:
          rule.category === "phishing"
            ? "Forged doesn't build login pages that imitate real brands or anything that collects other people's credentials."
            : "This request goes against Forged's Acceptable Use Policy, so it was blocked.",
      };
    }
  }
  const remote = await openAiModeration(text);
  if (remote) return { ok: false, category: remote.category, severity: remote.category === "sexual/minors" ? "ban" : "block", message: "This request goes against Forged's Acceptable Use Policy, so it was blocked." };
  return { ok: true };
}

/** Records a blocked prompt, adds a strike and restricts or bans the account when needed. */
export async function recordViolation(userId: string, projectId: string | null, result: Extract<ModerationResult, { ok: false }>, excerpt: string) {
  const since = new Date(Date.now() - 30 * 86_400_000);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(moderationFlags)
    .where(and(eq(moderationFlags.userId, userId), gte(moderationFlags.createdAt, since)));
  const strikes = count + 1;
  const action = result.severity === "ban" ? "banned" : strikes >= 3 ? "restricted" : "blocked";
  await db.insert(moderationFlags).values({ id: newId("flag"), userId, projectId, category: result.category, excerpt: excerpt.slice(0, 500), action });
  const patch: Partial<typeof user.$inferInsert> = { strikes };
  if (action === "banned") Object.assign(patch, { bannedAt: new Date(), restrictedAt: new Date(), restrictReason: "Severe Acceptable Use Policy violation" });
  if (action === "restricted") Object.assign(patch, { restrictedAt: new Date(), restrictReason: "Repeated Acceptable Use Policy violations" });
  await db.update(user).set(patch).where(eq(user.id, userId));
  return action;
}
