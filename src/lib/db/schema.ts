import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  bigserial,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/* ───────────────────────────── Auth (Better Auth) ───────────────────────────── */

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  // Forged fields (managed by the app, never by the auth client)
  creditsMicros: bigint("credits_micros", { mode: "number" }).notNull().default(0),
  plan: text("plan").notNull().default("free"),
  referralCode: text("referral_code").unique(),
  referredBy: text("referred_by"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planRenewsAt: timestamp("plan_renews_at"),
  role: text("role").notNull().default("user"),
  onboarded: boolean("onboarded").notNull().default(false),
});

export const session = pgTable(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("account_user_idx").on(t.userId)],
);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ───────────────────────────── Preferences ───────────────────────────── */

export const preferences = pgTable("preferences", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),
  defaultModel: text("default_model"),
  tokenSaver: boolean("token_saver").notNull().default(false),
  aiLanguage: text("ai_language").notNull().default("auto"),
  stylePreset: text("style_preset").notNull().default("modern"),
  customInstructions: text("custom_instructions").notNull().default(""),
  autoFixErrors: boolean("auto_fix_errors").notNull().default(true),
  askClarifyingQuestions: boolean("ask_clarifying_questions").notNull().default(true),
  emailNotifications: boolean("email_notifications").notNull().default(true),
  disabledSkills: jsonb("disabled_skills").$type<string[]>().notNull().default([]),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

/* ───────────────────────────── Projects ───────────────────────────── */

export type ProjectStatus = "idle" | "running" | "awaiting_input" | "error";
export type SandboxStatus = "stopped" | "starting" | "running" | "error";

export const projects = pgTable(
  "projects",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    status: text("status").$type<ProjectStatus>().notNull().default("idle"),
    model: text("model"),
    tokenSaver: boolean("token_saver"),
    // Session sharing
    shareToken: text("share_token").unique(),
    shareEnabled: boolean("share_enabled").notNull().default(false),
    shareAllowRemix: boolean("share_allow_remix").notNull().default(true),
    forkedFromId: text("forked_from_id"),
    // Sandbox VM
    sandboxProvider: text("sandbox_provider"),
    sandboxId: text("sandbox_id"),
    sandboxStatus: text("sandbox_status").$type<SandboxStatus>().notNull().default("stopped"),
    previewUrl: text("preview_url"),
    sandboxLastActiveAt: timestamp("sandbox_last_active_at"),
    // Stats
    totalCostMicros: bigint("total_cost_micros", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("projects_user_idx").on(t.userId, t.updatedAt)],
);

export const projectFiles = pgTable(
  "project_files",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    content: text("content").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.path] })],
);

/* ───────────────────────────── Conversation ───────────────────────────── */

export type MessageRole = "user" | "assistant" | "tool";

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    seq: bigserial("seq", { mode: "number" }).notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    runId: text("run_id"),
    role: text("role").$type<MessageRole>().notNull(),
    // Provider-neutral content parts, see src/lib/ai/types.ts
    content: jsonb("content").notNull(),
    model: text("model"),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    cacheReadTokens: integer("cache_read_tokens").notNull().default(0),
    cacheWriteTokens: integer("cache_write_tokens").notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("messages_project_seq_idx").on(t.projectId, t.seq)],
);

export type RunStatus = "running" | "completed" | "awaiting_input" | "error" | "stopped" | "insufficient_credits";

export const runs = pgTable(
  "runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    status: text("status").$type<RunStatus>().notNull().default("running"),
    source: text("source").notNull().default("web"),
    tokenSaver: boolean("token_saver").notNull().default(false),
    error: text("error"),
    steps: integer("steps").notNull().default(0),
    inputTokens: integer("input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [index("runs_project_idx").on(t.projectId, t.startedAt), index("runs_user_idx").on(t.userId, t.startedAt)],
);

/* ───────────────────────────── Credits & referrals ───────────────────────────── */

export type CreditTxType =
  | "signup_bonus"
  | "referral_bonus"
  | "referee_bonus"
  | "usage"
  | "purchase"
  | "subscription"
  | "refund"
  | "admin";

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    amountMicros: bigint("amount_micros", { mode: "number" }).notNull(),
    balanceAfterMicros: bigint("balance_after_micros", { mode: "number" }).notNull(),
    type: text("type").$type<CreditTxType>().notNull(),
    description: text("description").notNull().default(""),
    // Idempotency key (Stripe event id, referral id, run id…)
    reference: text("reference").unique(),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("credit_tx_user_idx").on(t.userId, t.createdAt)],
);

export const referrals = pgTable(
  "referrals",
  {
    id: text("id").primaryKey(),
    referrerId: text("referrer_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    refereeId: text("referee_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    status: text("status").$type<"pending" | "rewarded">().notNull().default("pending"),
    rewardMicros: bigint("reward_micros", { mode: "number" }).notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    rewardedAt: timestamp("rewarded_at"),
  },
  (t) => [index("referrals_referrer_idx").on(t.referrerId)],
);

/* ───────────────────────────── Skills ───────────────────────────── */

export const skills = pgTable(
  "skills",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    content: text("content").notNull(),
    source: text("source").$type<"paste" | "upload" | "url">().notNull().default("paste"),
    sourceUrl: text("source_url"),
    enabled: boolean("enabled").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("skills_user_slug_idx").on(t.userId, t.slug)],
);

/* ───────────────────────────── API keys ───────────────────────────── */

export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    prefix: text("prefix").notNull(),
    keyHash: text("key_hash").notNull().unique(),
    lastUsedAt: timestamp("last_used_at"),
    revokedAt: timestamp("revoked_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("api_keys_user_idx").on(t.userId)],
);

export type User = typeof user.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
