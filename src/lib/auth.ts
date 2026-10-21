import "server-only";
import crypto from "node:crypto";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { REF_COOKIE } from "@/lib/config";
import { decideBonuses, onUserCreated } from "@/lib/server/referrals";
import { emailConfigured, emailLayout, sendEmail } from "@/lib/server/email";
import { checkSignup, readSignals, recordAttempt } from "@/lib/server/abuse/signup-guard";
import { emailHash } from "@/lib/server/abuse/email";
import { generateUsername } from "@/lib/server/username";

const appUrl = process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

function readCookie(header: string | null | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const [k, ...v] = part.split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

/** Same rule as lib/server/api clientIp (kept here to avoid an import cycle). */
function ipFrom(headers: Headers | undefined) {
  const real = headers?.get("x-real-ip");
  if (real) return real.trim();
  const fwd = headers?.get("x-forwarded-for");
  return fwd ? fwd.split(",").at(-1)!.trim() : "0.0.0.0";
}

/**
 * Sign in with Apple needs a client secret that is a JWT signed with your .p8 key (valid 6 months max).
 * It is generated at start-up from APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY, unless
 * APPLE_CLIENT_SECRET is provided directly.
 */
function appleClientSecret() {
  if (process.env.APPLE_CLIENT_SECRET) return process.env.APPLE_CLIENT_SECRET;
  const { APPLE_TEAM_ID: team, APPLE_KEY_ID: kid, APPLE_PRIVATE_KEY: pem, APPLE_CLIENT_ID: sub } = process.env;
  if (!team || !kid || !pem || !sub) return null;
  try {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${b64({ alg: "ES256", kid })}.${b64({ iss: team, iat: now, exp: now + 180 * 86400, aud: "https://appleid.apple.com", sub })}`;
    const key = crypto.createPrivateKey(pem.replace(/\\n/g, "\n"));
    const sig = crypto.sign("sha256", Buffer.from(unsigned), { key, dsaEncoding: "ieee-p1363" }).toString("base64url");
    return `${unsigned}.${sig}`;
  } catch (err) {
    console.error("[auth] could not create the Apple client secret:", (err as Error).message);
    return null;
  }
}

type Providers = NonNullable<Parameters<typeof betterAuth>[0]["socialProviders"]>;
const socialProviders: Providers = {};
const env = process.env;
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) socialProviders.google = { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, prompt: "select_account" };
if (env.DISCORD_CLIENT_ID && env.DISCORD_CLIENT_SECRET) socialProviders.discord = { clientId: env.DISCORD_CLIENT_ID, clientSecret: env.DISCORD_CLIENT_SECRET };
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) socialProviders.github = { clientId: env.GITHUB_CLIENT_ID, clientSecret: env.GITHUB_CLIENT_SECRET };
if (env.FACEBOOK_CLIENT_ID && env.FACEBOOK_CLIENT_SECRET) socialProviders.facebook = { clientId: env.FACEBOOK_CLIENT_ID, clientSecret: env.FACEBOOK_CLIENT_SECRET };
const appleSecret = env.APPLE_CLIENT_ID ? appleClientSecret() : null;
if (env.APPLE_CLIENT_ID && appleSecret) socialProviders.apple = { clientId: env.APPLE_CLIENT_ID, clientSecret: appleSecret, appBundleIdentifier: env.APPLE_APP_BUNDLE_IDENTIFIER };

export type SocialProviderId = "google" | "discord" | "github" | "apple" | "facebook";
export const enabledSocialProviders = Object.keys(socialProviders) as SocialProviderId[];

const verificationOn = emailConfigured();

export const auth = betterAuth({
  appName: "Forged.dev",
  baseURL: appUrl,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [appUrl, "https://appleid.apple.com"],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user: schema.user, session: schema.session, account: schema.account, verification: schema.verification },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 3600,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Forged.dev password",
        html: emailLayout("Reset your password", `Someone, hopefully you, asked to reset the password of your Forged.dev account. The link expires in 1 hour. If it wasn't you, ignore this email.`, {
          label: "Choose a new password",
          url,
        }),
      });
    },
  },
  emailVerification: {
    sendOnSignUp: verificationOn,
    sendOnSignIn: false,
    autoSignInAfterVerification: true,
    expiresIn: 24 * 3600,
    sendVerificationEmail: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Confirm your email for Forged.dev",
        html: emailLayout("Confirm your email", `Confirm this address to unlock your free credits on Forged.dev. The link is valid for 24 hours.`, { label: "Confirm my email", url }),
      });
    },
    afterEmailVerification: async (user) => {
      await decideBonuses(user.id).catch((err) => console.error("[auth] bonus decision failed", err));
    },
  },
  socialProviders,
  user: {
    deleteUser: {
      enabled: true,
      // Stop the user's VMs and published apps before the database rows cascade away.
      beforeDelete: async (u) => {
        const { releaseUserResources } = await import("@/lib/server/account");
        await releaseUserResources(u.id);
      },
    },
    changeEmail: { enabled: false },
  },
  account: {
    // Only providers that verify email ownership may be linked automatically to an existing account.
    accountLinking: { enabled: true, trustedProviders: ["google", "github", "apple", "discord"] },
    encryptOAuthTokens: true,
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  advanced: {
    ipAddress: { ipAddressHeaders: ["x-real-ip"] },
    useSecureCookies: appUrl.startsWith("https://"),
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production" || process.env.FORGED_ENFORCE_SIGNUP_LIMITS === "1",
    storage: "memory",
    window: 60,
    max: 100,
    customRules: {
      "/sign-up/email": { window: 600, max: 3 },
      "/sign-in/email": { window: 300, max: 10 },
      "/sign-in/social": { window: 300, max: 20 },
      "/request-password-reset": { window: 3600, max: 3 },
      "/forget-password": { window: 3600, max: 3 },
      "/reset-password": { window: 3600, max: 5 },
      "/send-verification-email": { window: 3600, max: 4 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (newUser, ctx) => {
          const headers = ctx?.headers ?? ctx?.request?.headers;
          if (!headers) return; // internal/admin creation
          const method = ctx?.path?.startsWith("/sign-up") ? "email" : "oauth";
          const signals = readSignals(headers, ipFrom(headers));
          const verdict = await checkSignup(signals, newUser.email, method);
          if (!verdict.ok) {
            await recordAttempt(signals, newUser.email, method, `blocked:${verdict.reason}`);
            throw new APIError("FORBIDDEN", { message: verdict.message, code: "SIGNUP_BLOCKED" });
          }
        },
        after: async (createdUser, ctx) => {
          const headers = ctx?.headers ?? ctx?.request?.headers;
          try {
            const method = ctx?.path?.startsWith("/sign-up") ? "email" : "oauth";
            const signals = headers ? readSignals(headers, ipFrom(headers)) : null;
            await db
              .update(schema.user)
              .set({
                username: await generateUsername(createdUser.name, createdUser.email),
                emailKey: emailHash(createdUser.email),
                signupIp: signals?.ip ?? null,
                signupDevice: signals?.device ?? null,
                signupFp: signals?.fp ?? null,
                signupAsn: signals?.asn ?? null,
                signupHosting: signals?.hosting ?? false,
              })
              .where(eq(schema.user.id, createdUser.id));
            if (signals) await recordAttempt(signals, createdUser.email, method, "created");
            await onUserCreated(createdUser.id, readCookie(headers?.get("cookie"), REF_COOKIE));
            // Providers that verified the address (Google, Apple, GitHub, Discord) skip our email check.
            // Without an email provider configured, there is no way to verify: decide right away.
            if (createdUser.emailVerified || !verificationOn) {
              if (!verificationOn && !createdUser.emailVerified) await db.update(schema.user).set({ emailVerified: true }).where(eq(schema.user.id, createdUser.id));
              await decideBonuses(createdUser.id);
            }
          } catch (err) {
            console.error("[auth] post sign-up setup failed", err);
          }
        },
      },
    },
    session: {
      create: {
        before: async (session) => {
          const [u] = await db.select({ bannedAt: schema.user.bannedAt }).from(schema.user).where(eq(schema.user.id, session.userId));
          if (u?.bannedAt) throw new APIError("FORBIDDEN", { message: "This account has been suspended for breaking the Acceptable Use Policy.", code: "ACCOUNT_SUSPENDED" });
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
