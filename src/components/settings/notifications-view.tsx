"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BellIcon, LoaderCircleIcon, MailIcon, MessageSquareIcon, SendIcon, Trash2Icon } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { SettingsSection } from "./settings-nav";

type ChannelType = "discord" | "slack" | "telegram" | "ntfy" | "email";
type Channel = { id: string; type: ChannelType; label: string; enabled: boolean; events: string[] };

const TYPES: { id: ChannelType; label: string; placeholder: string; help: string }[] = [
  { id: "discord", label: "Discord", placeholder: "https://discord.com/api/webhooks/…", help: "Server settings → Integrations → Webhooks → New webhook → Copy webhook URL." },
  { id: "telegram", label: "Telegram", placeholder: "123456789:AA…|987654321", help: "Create a bot with @BotFather, send it a message, then paste BOT_TOKEN|CHAT_ID (find your chat id with @userinfobot)." },
  { id: "slack", label: "Slack", placeholder: "https://hooks.slack.com/services/…", help: "api.slack.com/apps → your app → Incoming Webhooks → Add New Webhook." },
  { id: "ntfy", label: "ntfy push", placeholder: "https://ntfy.sh/a-long-secret-topic", help: "Install the ntfy app, subscribe to a hard-to-guess topic and paste its URL. Push notifications on your phone, no account needed." },
  { id: "email", label: "Email", placeholder: "", help: "Sent to your account email address." },
];

const EVENTS: [string, string][] = [
  ["run_completed", "A build finished"],
  ["awaiting_input", "The agent asks a question"],
  ["run_failed", "A build failed"],
  ["agent_message", "The agent sends you a message"],
  ["deploy_live", "A published app went live"],
];

function TypeIcon({ type, className }: { type: ChannelType; className?: string }) {
  if (type === "email") return <MailIcon className={className} />;
  if (type === "slack") return <MessageSquareIcon className={className} />;
  return <BrandLogo id={type} className={className} />;
}

export function NotificationsView() {
  const [channels, setChannels] = useState<Channel[] | null>(null);
  const [type, setType] = useState<ChannelType>("discord");
  const [target, setTarget] = useState("");
  const [events, setEvents] = useState<string[]>(["run_completed", "awaiting_input", "run_failed", "agent_message"]);
  const [busy, setBusy] = useState<string | null>(null);
  const def = TYPES.find((t) => t.id === type)!;

  const call = async (method: string, body?: unknown, query = "") => {
    const res = await fetch(`/api/settings/notifications${query}`, { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.error?.message ?? "Something went wrong");
    setChannels(data.channels);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial load
    void call("GET").catch(() => setChannels([]));
  }, []);

  return (
    <div className="space-y-6">
      <SettingsSection title="Notifications" description="Get a message where you already are when a build finishes, fails or needs your answer. The agent can also send you a short note when it decides it's worth it.">
        {!channels ? (
          <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
        ) : channels.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <BellIcon className="size-4" /> No channels yet. Add one below.
          </p>
        ) : (
          <ul className="divide-y">
            {channels.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
                <TypeIcon type={c.type} className="size-4" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{c.label}</p>
                  <p className="text-xs text-muted-foreground">{c.events.map((e) => EVENTS.find(([k]) => k === e)?.[1] ?? e).join(" · ")}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy === c.id}
                  onClick={async () => {
                    setBusy(c.id);
                    const res = await fetch("/api/settings/notifications/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: c.id }) });
                    const data = await res.json().catch(() => null);
                    setBusy(null);
                    if (res.ok) toast.success("Test message sent");
                    else toast.error(data?.error?.message ?? "Delivery failed");
                  }}
                >
                  {busy === c.id ? <LoaderCircleIcon className="animate-spin" /> : <SendIcon />} Test
                </Button>
                <Switch checked={c.enabled} onCheckedChange={(v) => void call("PATCH", { id: c.id, enabled: v }).catch((e) => toast.error(e.message))} aria-label="Enabled" />
                <Button size="icon-sm" variant="ghost" onClick={() => void call("DELETE", undefined, `?id=${c.id}`)} aria-label="Remove channel">
                  <Trash2Icon />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title="Add a channel">
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {TYPES.map((t) => (
              <button
                key={t.id}
                onClick={() => setType(t.id)}
                className={cn("flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition", type === t.id ? "border-primary/50 bg-primary/10" : "text-muted-foreground hover:text-foreground")}
                aria-pressed={type === t.id}
              >
                <TypeIcon type={t.id} className="size-4" /> {t.label}
              </button>
            ))}
          </div>
          {type !== "email" && (
            <div className="max-w-xl space-y-2">
              <Label htmlFor="target">{type === "telegram" ? "Bot token and chat id" : "Webhook or topic URL"}</Label>
              <Input id="target" value={target} onChange={(e) => setTarget(e.target.value)} placeholder={def.placeholder} className="font-mono text-xs" autoComplete="off" spellCheck={false} />
            </div>
          )}
          <p className="max-w-xl text-xs text-muted-foreground">{def.help}</p>
          <div className="grid max-w-xl gap-2 sm:grid-cols-2">
            {EVENTS.map(([k, label]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <Switch checked={events.includes(k)} onCheckedChange={(v) => setEvents((ev) => (v ? [...ev, k] : ev.filter((x) => x !== k)))} />
                {label}
              </label>
            ))}
          </div>
          <Button
            variant="ember"
            disabled={busy === "add" || !events.length || (type !== "email" && !target.trim())}
            onClick={async () => {
              setBusy("add");
              try {
                await call("POST", { type, target, events });
                setTarget("");
                toast.success("Channel added. Send a test to check it.");
              } catch (e) {
                toast.error((e as Error).message);
              }
              setBusy(null);
            }}
          >
            {busy === "add" && <LoaderCircleIcon className="animate-spin" />} Add channel
          </Button>
        </div>
      </SettingsSection>
    </div>
  );
}
