import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * AES-256-GCM encryption for secrets stored at rest (connector keys, webhooks, Figma tokens…).
 * Key: FORGED_ENCRYPTION_KEY (32 random bytes, base64). Falls back to a key derived from
 * BETTER_AUTH_SECRET so development works out of the box.
 */
function key() {
  const raw = process.env.FORGED_ENCRYPTION_KEY;
  if (raw) {
    const buf = Buffer.from(raw, "base64");
    if (buf.length !== 32) throw new Error("FORGED_ENCRYPTION_KEY must be 32 bytes (base64)");
    return buf;
  }
  if (process.env.NODE_ENV === "production" && !process.env.BETTER_AUTH_SECRET) throw new Error("Missing FORGED_ENCRYPTION_KEY");
  return createHash("sha256").update(`forged-enc:${process.env.BETTER_AUTH_SECRET ?? "dev-only"}`).digest();
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${data.toString("base64")}`;
}

export function decryptSecret(payload: string) {
  const [v, iv, tag, data] = payload.split(":");
  if (v !== "v1" || !iv || !tag || !data) throw new Error("Invalid secret payload");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

export function maskSecret(s: string) {
  if (s.length <= 8) return "••••";
  return `${s.slice(0, 4)}••••${s.slice(-4)}`;
}

export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function sha256(s: string) {
  return createHash("sha256").update(s).digest("hex");
}
