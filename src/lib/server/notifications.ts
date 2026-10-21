import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { notificationChannels, user, type NotificationChannelType } from "@/lib/db/schema";
import { absoluteUrl } from "@/lib/utils";
import { decryptSecret } from "./crypto";
import { emailLayout, sendEmail } from "./email";
import { safeFetch } from "./safe-fetch";

export type NotificationEvent = "run_completed" | "awaiting_input" | "run_failed" | "agent_message" | "deploy_live";

export const CHANNEL_RULES: Record<NotificationChannelType, { label: string; validate: (target: string) => boolean; hint: string }> = {
  discord: {
    label: "Discord",
    hint: "Server settings → Integrations → Webhooks → New webhook → Copy URL",
    validate: (t) => /^https:\/\/(?:ptb\.|canary\.)?(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/.test(t),
  },
  slack: { label: "Slack", hint: "api.slack.com → Your app → Incoming webhooks", validate: (t) => /^https:\/\/hooks\.slack\.com\/services\/[\w/]+$/.test(t) },
  telegram: {
    label: "Telegram",
    hint: "Create a bot with @BotFather, then paste BOT_TOKEN|CHAT_ID",
    validate: (t) => /^\d{5,}:[\w-]{30,}\|-?\d{3,}$/.test(t),
  },
  ntfy: { label: "ntfy (push)", hint: "https://ntfy.sh/your-secret-topic (install the ntfy app)", validate: (t) => /^https:\/\/[\w.-]+\/[\w-]{6,64}$/.test(t) },
  email: { label: "Email", hint: "Sent to your account email", validate: (t) => t === "account" },
};

const EVENT_TITLE: Record<NotificationEvent, string> = {
  run_completed: "Forged finished your request",
  awaiting_input: "Forged has a question for you",
  run_failed: "A Forged run failed",
  agent_message: "Message from your Forged agent",
  deploy_live: "Your app is live",
};

async function deliver(type: NotificationChannelType, target: string, title: string, text: string, link: string, email?: string) {
  switch (type) {
    case "discord":
      await safeFetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "Forged", embeds: [{ title, description: `${text}\n\n[Open in Forged](${link})`, color: 0xf2541b }] }),
        maxBytes: 100_000,
      });
      return;
    case "slack":
      await safeFetch(target, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: `*${title}*\n${text}\n<${link}|Open in Forged>` }), maxBytes: 100_000 });
      return;
    case "telegram": {
      const [token, chatId] = target.split("|");
      await safeFetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text: `${title}\n\n${text}\n\n${link}`, disable_web_page_preview: true }),
        maxBytes: 100_000,
      });
      return;
    }
    case "ntfy":
      await safeFetch(target, { method: "POST", headers: { Title: title, Click: link, Tags: "fire" }, body: text, maxBytes: 100_000 });
      return;
    case "email":
      if (email) await sendEmail({ to: email, subject: title, html: emailLayout(title, text.replace(/\n/g, "<br/>"), { label: "Open in Forged", url: link }) });
  }
}

/** Sends a notification to every enabled channel subscribed to the event. Never throws. */
export async function notifyUser(userId: string, event: NotificationEvent, payload: { text: string; projectId?: string; projectName?: string }) {
  try {
    const channels = await db
      .select()
      .from(notificationChannels)
      .where(and(eq(notificationChannels.userId, userId), eq(notificationChannels.enabled, true)));
    if (!channels.length) return 0;
    const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
    const title = payload.projectName ? `${EVENT_TITLE[event]} · ${payload.projectName}` : EVENT_TITLE[event];
    const link = absoluteUrl(payload.projectId ? `/project/${payload.projectId}` : "/dashboard");
    let sent = 0;
    await Promise.all(
      channels
        .filter((c) => c.events.includes(event))
        .map(async (c) => {
          try {
            await deliver(c.type, decryptSecret(c.target), title, payload.text.slice(0, 1500), link, u?.email);
            sent++;
          } catch (err) {
            console.warn(`[notify] ${c.type} delivery failed:`, (err as Error).message);
          }
        }),
    );
    return sent;
  } catch (err) {
    console.warn("[notify] failed", (err as Error).message);
    return 0;
  }
}

/** Sends a test message to one channel; returns false if delivery failed. */
export async function sendTestNotification(userId: string, channel: typeof notificationChannels.$inferSelect) {
  try {
    const [u] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId));
    await deliver(channel.type, decryptSecret(channel.target), "Forged test notification", "This channel is set up. You'll get messages here when your builds finish or the agent needs you.", absoluteUrl("/dashboard"), u?.email);
    return true;
  } catch (err) {
    console.warn("[notify] test failed:", (err as Error).message);
    return false;
  }
}
