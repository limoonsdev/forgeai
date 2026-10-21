import "server-only";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import fs from "node:fs";

/** Common throwaway-inbox domains. Extend with FORGED_DISPOSABLE_DOMAINS_PATH (one domain per line). */
const BUILTIN_DISPOSABLE = `0-mail.com 10minutemail.com 10minutemail.net 20minutemail.com 33mail.com anonaddy.me anonbox.net armyspy.com
binkmail.com bobmail.info burnermail.io byom.de chacuo.net cuvox.de dayrep.com deadaddress.com discard.email discardmail.com
disposableemailaddresses.com dispostable.com dropmail.me einrot.com emailondeck.com emailfake.com emailtemporanea.net
emltmp.com fakeinbox.com fakemail.net fastacura.com fleckens.hu getairmail.com getnada.com gufum.com guerrillamail.biz
guerrillamail.com guerrillamail.de guerrillamail.info guerrillamail.net guerrillamail.org guerrillamailblock.com gustr.com
harakirimail.com hidemail.de inboxbear.com incognitomail.org jetable.org jourrapide.com kasmail.com linshiyouxiang.net
mail-temp.com mail.tm mailcatch.com maildrop.cc mailinator.com mailinator.net mailinator2.com mailnesia.com mailnull.com
mailpoof.com mailsac.com mailtemp.net meltmail.com mintemail.com moakt.com mohmal.com mvrht.com mytemp.email mytrashmail.com
nada.email nowmymail.com objectmail.com one-time.email oneoffemail.com pokemail.net proxymail.eu rcpt.at rhyta.com
sharklasers.com shitmail.me sofimail.com spam4.me spambog.com spambox.us spamgourmet.com spamherelots.com superrito.com
teleworm.us temp-mail.io temp-mail.org temp-mail.ru tempail.com tempinbox.com tempmail.dev tempmail.net tempmail.plus
tempmailo.com tempmail.email tempr.email throwawaymail.com tmail.ws tmpmail.net tmpmail.org trash-mail.com trashmail.com
trashmail.de trashmail.net trashmail.ws trbvm.com tutanota.dev wegwerfmail.de wegwerfmail.net yopmail.com yopmail.fr
yopmail.net cool.fr.nf jetable.fr.nf nospam.ze.tc nomail.xl.cx mega.zik.dj speed.1s.fr courriel.fr.nf moncourrier.fr.nf
monemail.fr.nf monmail.fr.nf zetmail.com zeroe.ml xojxe.com wuuvo.com vomoto.com tafmail.com spymail.one smykwb.com
inboxkitten.com mailto.plus fexpost.com fexbox.org rover.info firemailbox.club 1secmail.com 1secmail.net 1secmail.org
esiix.com wwjmp.com kzccv.com qiott.com uiu.us txcct.com dpptd.com laafd.com vjuum.com`.split(/\s+/);

let disposable: Set<string> | null = null;
function disposableSet() {
  if (disposable) return disposable;
  disposable = new Set(BUILTIN_DISPOSABLE.filter(Boolean));
  const file = process.env.FORGED_DISPOSABLE_DOMAINS_PATH;
  if (file && fs.existsSync(file)) {
    for (const line of fs.readFileSync(file, "utf8").split("\n")) {
      const d = line.trim().toLowerCase();
      if (d && !d.startsWith("#")) disposable.add(d);
    }
  }
  return disposable;
}

/** Canonical mailbox: lowercase, no +tags, no dots for Gmail. Used to stop alias farming. */
export function normalizeEmail(email: string) {
  const [localRaw, domainRaw] = email.trim().toLowerCase().split("@");
  if (!localRaw || !domainRaw) return email.trim().toLowerCase();
  let domain = domainRaw === "googlemail.com" ? "gmail.com" : domainRaw;
  let local = localRaw.split("+")[0];
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  domain = domain.replace(/\.$/, "");
  return `${local}@${domain}`;
}

export function emailHash(email: string) {
  return crypto.createHash("sha256").update(`forged-email:${normalizeEmail(email)}`).digest("hex");
}

export function isDisposable(email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim() ?? "";
  const set = disposableSet();
  const parts = domain.split(".");
  for (let i = 0; i < parts.length - 1; i++) if (set.has(parts.slice(i).join("."))) return true;
  return false;
}

const mxCache = new Map<string, { ok: boolean; at: number }>();

const KNOWN_PROVIDERS = new Set(
  "gmail.com googlemail.com outlook.com outlook.fr hotmail.com hotmail.fr live.com live.fr msn.com yahoo.com yahoo.fr ymail.com icloud.com me.com mac.com aol.com proton.me protonmail.com pm.me gmx.com gmx.de gmx.fr web.de orange.fr wanadoo.fr free.fr sfr.fr laposte.net bbox.fr yandex.com yandex.ru mail.ru qq.com 163.com 126.com naver.com fastmail.com zoho.com tutanota.com tuta.io hey.com".split(" "),
);

let dnsHealth: { ok: boolean; at: number } | null = null;
/** Distinguishes "this domain doesn't exist" from "our DNS resolver is down". */
async function dnsWorks() {
  if (dnsHealth && Date.now() - dnsHealth.at < 5 * 60_000) return dnsHealth.ok;
  const ok = await Promise.race([dns.resolveMx("gmail.com").then((r) => r.length > 0), new Promise<boolean>((r) => setTimeout(() => r(false), 3000))]).catch(() => false);
  dnsHealth = { ok, at: Date.now() };
  if (!ok) console.warn("[abuse] DNS resolution is failing: email domain checks are skipped");
  return ok;
}

/** The domain must be able to receive mail (MX record, or an A/AAAA fallback per RFC 5321). */
export async function domainAcceptsMail(email: string) {
  const domain = email.split("@")[1]?.toLowerCase().trim();
  if (!domain) return false;
  if (KNOWN_PROVIDERS.has(domain)) return true;
  const hit = mxCache.get(domain);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return hit.ok;
  const withTimeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), 3000))]);
  let ok = false;
  try {
    const mx = await withTimeout(dns.resolveMx(domain));
    ok = mx.some((r) => r.exchange && r.exchange !== ".");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENODATA") ok = await withTimeout(dns.resolve(domain)).then((a) => a.length > 0).catch(() => false);
    else if (code === "ENOTFOUND") ok = !(await dnsWorks());
    else ok = true; // timeouts and resolver errors on our side: don't punish the user
  }
  mxCache.set(domain, { ok, at: Date.now() });
  return ok;
}
