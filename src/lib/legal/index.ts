import "server-only";
import { headers } from "next/headers";
import { legalEntity, LEGAL_DOCS, LEGAL_TITLES, type Lang, type LegalDoc } from "./entity";
import { privacy } from "./privacy";
import { terms } from "./terms";
import { acceptableUse, cookies, legalNotice, security } from "./policies";

export { LEGAL_DOCS, LEGAL_TITLES, legalEntity, type Lang, type LegalDoc };

const DOCS = { terms, privacy, "acceptable-use": acceptableUse, cookies, "legal-notice": legalNotice, security } satisfies Record<LegalDoc, { en: unknown; fr: unknown }>;

export function isLegalDoc(s: string): s is LegalDoc {
  return (LEGAL_DOCS as readonly string[]).includes(s);
}

export function legalMarkdown(doc: LegalDoc, lang: Lang) {
  return DOCS[doc][lang](legalEntity()).trim();
}

/** ?lang= wins, otherwise the browser's preferred language (French or English). */
export async function pickLang(param: string | string[] | undefined): Promise<Lang> {
  if (param === "fr" || param === "en") return param;
  const accept = (await headers()).get("accept-language") ?? "";
  return /^fr\b/i.test(accept.trim()) ? "fr" : "en";
}
