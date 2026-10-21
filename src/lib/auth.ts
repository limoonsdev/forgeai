import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { REF_COOKIE } from "@/lib/config";
import { onUserCreated } from "@/lib/server/referrals";
import { emailLayout, sendEmail } from "@/lib/server/email";

function readCookie(header: string | null | undefined, name: string) {
  if (!header) return null;
  for (const part of header.split(/;\s*/)) {
    const [k, ...v] = part.split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

const socialProviders: Parameters<typeof betterAuth>[0]["socialProviders"] = {};
if (process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET) {
  socialProviders.github = {
    clientId: process.env.GITHUB_CLIENT_ID,
    clientSecret: process.env.GITHUB_CLIENT_SECRET,
  };
}
if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  socialProviders.google = {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  };
}

export const enabledSocialProviders = Object.keys(socialProviders) as ("github" | "google")[];

export const auth = betterAuth({
  appName: "Forged.dev",
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Reset your Forged.dev password",
        html: emailLayout(
          "Reset your password",
          `Hi ${user.name || "there"}, someone (hopefully you) asked to reset the password of your Forged.dev account. This link expires in 1 hour.`,
          { label: "Choose a new password", url },
        ),
      });
    },
  },
  socialProviders,
  user: {
    deleteUser: { enabled: true },
    changeEmail: { enabled: false },
  },
  account: {
    accountLinking: { enabled: true, trustedProviders: ["github", "google"] },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30,
    updateAge: 60 * 60 * 24,
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
  rateLimit: { enabled: process.env.NODE_ENV === "production", window: 60, max: 30 },
  databaseHooks: {
    user: {
      create: {
        after: async (createdUser, ctx) => {
          const cookieHeader = ctx?.headers?.get("cookie") ?? ctx?.request?.headers.get("cookie");
          const ref = readCookie(cookieHeader, REF_COOKIE);
          try {
            await onUserCreated(createdUser.id, ref);
          } catch (err) {
            console.error("[auth] onUserCreated failed", err);
          }
        },
      },
    },
  },
  plugins: [nextCookies()],
});

export type AuthSession = typeof auth.$Infer.Session;
