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
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

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
  username: text("username").unique(),
  // Moderation
  strikes: integer("strikes").notNull().default(0),
  restrictedAt: timestamp("restricted_at"),
  restrictReason: text("restrict_reason"),
  bannedAt: timestamp("banned_at"),
  // Anti-abuse signals captured at sign-up (hashed device id, network)
  signupIp: text("signup_ip"),
  signupDevice: text("signup_device"),
  signupFp: text("signup_fp"),
  /** Hash of the canonical mailbox (gmail dots and +tags removed), to stop alias farming. */
  emailKey: text("email_key").unique(),
  signupAsn: text("signup_asn"),
  signupHosting: boolean("signup_hosting").notNull().default(false),
  /** Set once the welcome/referral credits were granted or refused, so it is decided only once. */
  bonusDecidedAt: timestamp("bonus_decided_at"),
  /** "granted" or the reason free credits were refused (shown to the user). */
  bonusStatus: text("bonus_status"),
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

export type ProjectStatus = "idle" | "running" | "awaiting_input" | "paused" | "error";
export type SandboxStatus = "stopped" | "queued" | "starting" | "running" | "error";

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
    /** Linked GitHub repository ("owner/name") for push/import. */
    githubRepo: text("github_repo"),
    githubBranch: text("github_branch"),
    githubPushedAt: timestamp("github_pushed_at"),
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

export type RunStatus = "running" | "completed" | "awaiting_input" | "paused" | "error" | "stopped" | "insufficient_credits" | "blocked";

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

/* ───────────────────────────── Binary assets & attachments ───────────────────────────── */

/** Binary project files (images, videos, fonts…) — synced into the VM and included in exports. */
export const projectAssets = pgTable(
  "project_assets",
  {
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    path: text("path").notNull(),
    data: bytea("data").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.projectId, t.path] })],
);

/** Images attached to a chat message (screenshots, Figma frames). */
export const attachments = pgTable(
  "attachments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mime: text("mime").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("attachments_project_idx").on(t.projectId)],
);

/* ───────────────────────────── Deployments ───────────────────────────── */

export type DeploymentStatus = "queued" | "building" | "live" | "failed" | "stopped";

export const deployments = pgTable(
  "deployments",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    subdomain: text("subdomain").notNull().unique(),
    status: text("status").$type<DeploymentStatus>().notNull().default("queued"),
    log: text("log").notNull().default(""),
    lastDeployedAt: timestamp("last_deployed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [index("deployments_user_idx").on(t.userId)],
);

/* ───────────────────────────── VM queue ───────────────────────────── */

export const vmQueue = pgTable("vm_queue", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  priority: integer("priority").notNull().default(0),
  enqueuedAt: timestamp("enqueued_at").notNull().defaultNow(),
});

/* ───────────────────────────── Connectors & notifications ───────────────────────────── */

export const connectors = pgTable(
  "connectors",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    connectorId: text("connector_id").notNull(),
    /** AES-256-GCM encrypted JSON of the connector's secrets. */
    secrets: text("secrets").notNull(),
    hint: text("hint").notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (t) => [uniqueIndex("connectors_user_connector_idx").on(t.userId, t.connectorId)],
);

export type NotificationChannelType = "discord" | "slack" | "telegram" | "ntfy" | "email";

export const notificationChannels = pgTable(
  "notification_channels",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    type: text("type").$type<NotificationChannelType>().notNull(),
    /** Encrypted destination (webhook URL, chat id…). */
    target: text("target").notNull(),
    label: text("label").notNull().default(""),
    enabled: boolean("enabled").notNull().default(true),
    events: jsonb("events").$type<string[]>().notNull().default(["run_completed", "awaiting_input", "run_failed", "agent_message"]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("notification_channels_user_idx").on(t.userId)],
);

/* ───────────────────────────── Sub-agents ───────────────────────────── */

export const agentTasks = pgTable(
  "agent_tasks",
  {
    id: text("id").primaryKey(),
    runId: text("run_id").notNull(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    toolCallId: text("tool_call_id").notNull(),
    name: text("name").notNull(),
    task: text("task").notNull(),
    status: text("status").$type<"running" | "completed" | "failed" | "stopped">().notNull().default("running"),
    steps: integer("steps").notNull().default(0),
    costMicros: bigint("cost_micros", { mode: "number" }).notNull().default(0),
    summary: text("summary").notNull().default(""),
    log: jsonb("log").$type<{ t: string; label: string; ok?: boolean }[]>().notNull().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    finishedAt: timestamp("finished_at"),
  },
  (t) => [index("agent_tasks_run_idx").on(t.runId)],
);

/* ───────────────────────────── Trust & safety ───────────────────────────── */

export const moderationFlags = pgTable(
  "moderation_flags",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id"),
    category: text("category").notNull(),
    excerpt: text("excerpt").notNull(),
    action: text("action").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [index("moderation_flags_user_idx").on(t.userId)],
);

export const abuseReports = pgTable("abuse_reports", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  reason: text("reason").notNull(),
  details: text("details").notNull().default(""),
  reporterEmail: text("reporter_email"),
  ip: text("ip"),
  status: text("status").$type<"open" | "actioned" | "dismissed">().notNull().default("open"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

/** Every sign-up attempt, used for multi-signal rate limiting (IP, subnet, ASN, device). */
export const signupAttempts = pgTable(
  "signup_attempts",
  {
    id: text("id").primaryKey(),
    ip: text("ip").notNull(),
    subnet: text("subnet").notNull(),
    device: text("device"),
    fp: text("fp"),
    hw: text("hw"),
    asn: text("asn"),
    hosting: boolean("hosting").notNull().default(false),
    emailHash: text("email_hash"),
    method: text("method").notNull().default("email"),
    outcome: text("outcome").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => [
    index("signup_attempts_ip_idx").on(t.ip, t.createdAt),
    index("signup_attempts_subnet_idx").on(t.subnet, t.createdAt),
    index("signup_attempts_device_idx").on(t.device, t.createdAt),
    index("signup_attempts_fp_idx").on(t.fp, t.createdAt),
    index("signup_attempts_asn_idx").on(t.asn, t.createdAt),
    index("signup_attempts_email_idx").on(t.emailHash),
    index("signup_attempts_created_idx").on(t.createdAt),
  ],
);

export const ipBans = pgTable("ip_bans", {
  cidr: text("cidr").primaryKey(),
  reason: text("reason").notNull().default(""),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type User = typeof user.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type ProjectFile = typeof projectFiles.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Run = typeof runs.$inferSelect;
export type Preferences = typeof preferences.$inferSelect;
export type Skill = typeof skills.$inferSelect;
export type Deployment = typeof deployments.$inferSelect;
export type Connector = typeof connectors.$inferSelect;
export type AgentTask = typeof agentTasks.$inferSelect;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
