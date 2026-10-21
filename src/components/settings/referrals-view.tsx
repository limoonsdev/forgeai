"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon, GiftIcon, MailIcon, RocketIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCredits } from "@/lib/utils";
import { SettingsSection } from "./settings-nav";

type Ref = { id: string; status: string; rewardMicros: number; createdAt: string; name: string };

export function ReferralsView({ code, link, earned, pending, referrals, rewardUsd }: { code: string; link: string; earned: number; pending: number; referrals: Ref[]; rewardUsd: number }) {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (value: string, key: string) => {
    await navigator.clipboard.writeText(value).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };
  const message = `I'm building apps with AI on Forged.dev — sign up with my link and get $${rewardUsd} of free credits: ${link}`;

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-8">
        <div className="absolute -top-20 -right-20 size-64 rounded-full bg-[#ff7a1a]/25 blur-3xl" />
        <div className="relative">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-ember shadow-[0_10px_30px_-10px_rgba(255,106,26,0.9)]">
            <GiftIcon className="size-6 text-white" />
          </div>
          <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">
            Give ${rewardUsd}, get ${rewardUsd}.
          </h2>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Your friends get <strong className="text-foreground">${rewardUsd} of credits</strong> when they sign up with your link. You earn{" "}
            <strong className="text-foreground">${rewardUsd}</strong> as soon as they forge their first app. No limit.
          </p>
          <div className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row">
            <input readOnly value={link} className="h-11 min-w-0 flex-1 rounded-xl border bg-background/60 px-4 font-mono text-sm" data-testid="referral-link" />
            <Button variant="ember" size="lg" onClick={() => copy(link, "link")}>
              {copied === "link" ? <CheckIcon /> : <CopyIcon />} {copied === "link" ? "Copied!" : "Copy link"}
            </Button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">Or share your code</span>
            <button onClick={() => copy(code, "code")} className="rounded-lg border bg-background/60 px-2.5 py-1 font-mono font-semibold tracking-wider">
              {code}
            </button>
            <Button asChild size="sm" variant="outline">
              <a href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer">
                Share on X
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`} target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`mailto:?subject=${encodeURIComponent("$5 of free AI credits on Forged.dev")}&body=${encodeURIComponent(message)}`}>
                <MailIcon /> Email
              </a>
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Friends invited", String(referrals.length)],
          ["Credits earned", formatCredits(earned)],
          ["Waiting for first app", String(pending)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-2xl border bg-card/60 p-5">
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <SettingsSection title="How it works">
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            [CopyIcon, "Share your link", "Send it to friends, post it, put it in your bio."],
            [UserPlusIcon, "They sign up", `They instantly get $${rewardUsd} of credits on their new account.`],
            [RocketIcon, "They forge an app", `You get $${rewardUsd} as soon as their first agent run completes.`],
          ].map(([Icon, title, body], i) => {
            const I = Icon as typeof CopyIcon;
            return (
              <div key={i} className="rounded-xl border bg-background/40 p-4">
                <I className="size-4 text-primary" />
                <p className="mt-3 text-sm font-medium">{title as string}</p>
                <p className="mt-1 text-xs text-muted-foreground">{body as string}</p>
              </div>
            );
          })}
        </div>
      </SettingsSection>

      <SettingsSection title="Your referrals">
        {referrals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No referrals yet — share your link to start earning.</p>
        ) : (
          <ul className="divide-y">
            {referrals.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-3 text-sm">
                <span>{r.name}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</span>
                  {r.status === "rewarded" ? <Badge variant="success">+{formatCredits(r.rewardMicros)}</Badge> : <Badge variant="outline">Pending</Badge>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </div>
  );
}
