import "server-only";

/** Operator details shown in the legal pages. Set them in the server environment (see DEPLOY.md). */
export type LegalEntity = {
  brand: string;
  name: string;
  form: string;
  capital: string;
  address: string;
  registration: string;
  vat: string;
  director: string;
  email: string;
  privacyEmail: string;
  abuseEmail: string;
  securityEmail: string;
  phone: string;
  domain: string;
  governingLaw: string;
  courts: string;
  supervisoryAuthority: string;
  mediator: string;
  host: string;
  updated: string;
};

const env = (k: string, d = "") => process.env[k]?.trim() || d;

export function legalEntity(): LegalEntity {
  const domain = env("NEXT_PUBLIC_APP_URL", "https://forged.dev").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  const email = env("LEGAL_EMAIL", `contact@${domain}`);
  return {
    brand: "Forged.dev",
    name: env("LEGAL_ENTITY_NAME", "Forged.dev"),
    form: env("LEGAL_ENTITY_FORM"),
    capital: env("LEGAL_ENTITY_CAPITAL"),
    address: env("LEGAL_ADDRESS"),
    registration: env("LEGAL_REGISTRATION"),
    vat: env("LEGAL_VAT"),
    director: env("LEGAL_DIRECTOR"),
    email,
    privacyEmail: env("LEGAL_PRIVACY_EMAIL", email),
    abuseEmail: env("ABUSE_EMAIL", email),
    securityEmail: env("SECURITY_EMAIL", email),
    phone: env("LEGAL_PHONE"),
    domain,
    governingLaw: env("LEGAL_GOVERNING_LAW", "France"),
    courts: env("LEGAL_COURTS", "the courts of the operator's registered office"),
    supervisoryAuthority: env("LEGAL_SUPERVISORY_AUTHORITY", "CNIL (Commission Nationale de l'Informatique et des Libertés), 3 place de Fontenoy, 75007 Paris, France, www.cnil.fr"),
    mediator: env("LEGAL_CONSUMER_MEDIATOR"),
    host: env("LEGAL_HOST", "Hostinger International Ltd., 61 Lordou Vironos Street, 6023 Larnaca, Cyprus, www.hostinger.com"),
    updated: env("LEGAL_UPDATED", "2026-10-21"),
  };
}

export const LEGAL_DOCS = ["terms", "privacy", "acceptable-use", "cookies", "legal-notice", "security"] as const;
export type LegalDoc = (typeof LEGAL_DOCS)[number];
export type Lang = "en" | "fr";

export const LEGAL_TITLES: Record<LegalDoc, Record<Lang, string>> = {
  terms: { en: "Terms of Service", fr: "Conditions générales d'utilisation" },
  privacy: { en: "Privacy Policy", fr: "Politique de confidentialité" },
  "acceptable-use": { en: "Acceptable Use Policy", fr: "Politique d'utilisation acceptable" },
  cookies: { en: "Cookie Policy", fr: "Politique relative aux cookies" },
  "legal-notice": { en: "Legal Notice", fr: "Mentions légales" },
  security: { en: "Security Policy", fr: "Politique de sécurité" },
};
