"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Flag = { id: string; category: string; excerpt: string; action: string; createdAt: string; userId: string; email: string; banned: boolean; restricted: boolean };
type Report = { id: string; url: string; reason: string; details: string; email: string | null; createdAt: string };
type Ban = { cidr: string; reason: string; expiresAt: string | null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card/60">
      <h2 className="border-b px-5 py-3 font-semibold">{title}</h2>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function AdminActions({ blocked, flags, reports, bans, deployDomain }: { blocked: { reason: string; n: number }[]; flags: Flag[]; reports: Report[]; bans: Ban[]; deployDomain: string }) {
  const router = useRouter();
  const [cidr, setCidr] = useState("");
  const act = async (body: Record<string, unknown>, done = "Done") => {
    const res = await fetch("/api/admin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => null);
    if (!res.ok) return toast.error(data?.error?.message ?? "Failed");
    toast.success(done);
    router.refresh();
  };
  const subdomainOf = (url: string) => {
    try {
      const h = new URL(url).hostname;
      return deployDomain && h.endsWith(`.${deployDomain}`) ? h.slice(0, -deployDomain.length - 1) : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <Section title={`Open abuse reports (${reports.length})`}>
        {reports.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing to review.</p>
        ) : (
          <ul className="divide-y">
            {reports.map((r) => {
              const sub = subdomainOf(r.url);
              return (
                <li key={r.id} className="space-y-2 py-3 first:pt-0">
                  <p className="text-sm">
                    <span className="mr-2 rounded bg-destructive/15 px-1.5 py-px font-mono text-[10px] text-destructive uppercase">{r.reason}</span>
                    <a href={r.url} target="_blank" rel="noreferrer noopener nofollow" className="font-mono text-xs underline">
                      {r.url}
                    </a>
                  </p>
                  {r.details && <p className="text-sm whitespace-pre-wrap text-muted-foreground">{r.details}</p>}
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.createdAt).toLocaleString()} · {r.email ?? "anonymous"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {sub && (
                      <Button size="sm" variant="destructive" onClick={async () => (await act({ action: "takedown", subdomain: sub }, "App taken down"), act({ action: "report", reportId: r.id, status: "actioned" }))}>
                        Take down {sub}
                      </Button>
                    )}
                    <Button size="sm" variant="outline" onClick={() => act({ action: "report", reportId: r.id, status: "actioned" }, "Marked as handled")}>
                      Mark handled
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => act({ action: "report", reportId: r.id, status: "dismissed" }, "Dismissed")}>
                      Dismiss
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <Section title="Moderation (latest blocked prompts)">
        {flags.length === 0 ? (
          <p className="text-sm text-muted-foreground">No flags.</p>
        ) : (
          <ul className="divide-y">
            {flags.map((f) => (
              <li key={f.id} className="flex flex-wrap items-start gap-3 py-3 first:pt-0">
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="mr-2 rounded bg-muted px-1.5 py-px font-mono text-[10px] uppercase">{f.category}</span>
                    {f.email} <span className="text-xs text-muted-foreground">· {f.action} · {new Date(f.createdAt).toLocaleString()}</span>
                  </p>
                  <p className="mt-1 truncate font-mono text-xs text-muted-foreground">{f.excerpt}</p>
                </div>
                {f.banned ? (
                  <Button size="sm" variant="outline" onClick={() => act({ action: "unban", userId: f.userId }, "Unbanned")}>
                    Unban
                  </Button>
                ) : (
                  <>
                    {f.restricted ? (
                      <Button size="sm" variant="outline" onClick={() => act({ action: "unrestrict", userId: f.userId }, "Restriction lifted")}>
                        Lift restriction
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => act({ action: "restrict", userId: f.userId }, "Restricted")}>
                        Restrict
                      </Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => act({ action: "ban", userId: f.userId }, "Banned")}>
                      Ban
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="Blocked sign-ups (24 h)">
          {blocked.length === 0 ? (
            <p className="text-sm text-muted-foreground">None.</p>
          ) : (
            <ul className="space-y-1 font-mono text-sm">
              {blocked.map((b) => (
                <li key={b.reason} className="flex justify-between">
                  <span>{b.reason}</span>
                  <span className="tabular-nums">{b.n}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
        <Section title="IP bans">
          <form
            className="mb-4 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void act({ action: "ip_ban", cidr: cidr.trim(), days: 30 }, "Banned for 30 days").then(() => setCidr(""));
            }}
          >
            <Input value={cidr} onChange={(e) => setCidr(e.target.value)} placeholder="203.0.113.0/24" className="font-mono" />
            <Button type="submit" variant="outline" disabled={!cidr.trim()}>
              Ban 30 days
            </Button>
          </form>
          <ul className="divide-y text-sm">
            {bans.map((b) => (
              <li key={b.cidr} className="flex items-center gap-3 py-2">
                <span className="font-mono">{b.cidr}</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">
                  {b.reason} {b.expiresAt ? `· until ${new Date(b.expiresAt).toLocaleDateString()}` : "· permanent"}
                </span>
                <Button size="sm" variant="ghost" onClick={() => act({ action: "ip_unban", cidr: b.cidr }, "Removed")}>
                  Remove
                </Button>
              </li>
            ))}
          </ul>
        </Section>
      </div>
    </div>
  );
}
