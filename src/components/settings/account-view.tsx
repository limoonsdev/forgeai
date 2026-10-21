"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DownloadIcon, KeyRoundIcon, LaptopIcon, LoaderCircleIcon, MailWarningIcon, ShieldCheckIcon, SmartphoneIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Row, SettingsSection } from "./settings-nav";

type Provider = "google" | "github" | "discord" | "apple" | "facebook";
const PROVIDERS: { id: Provider; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "discord", label: "Discord" },
  { id: "apple", label: "Apple" },
  { id: "facebook", label: "Facebook" },
];

type SessionRow = { id: string; token: string; createdAt: string | Date; updatedAt: string | Date; ipAddress?: string | null; userAgent?: string | null };

function describeAgent(ua: string | null | undefined) {
  if (!ua) return { label: "Unknown device", mobile: false };
  const browser = /Edg\//.test(ua) ? "Edge" : /OPR\//.test(ua) ? "Opera" : /Firefox\//.test(ua) ? "Firefox" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : "Browser";
  const os = /iPhone|iPad/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : /Mac OS X/.test(ua) ? "macOS" : /Windows/.test(ua) ? "Windows" : /Linux/.test(ua) ? "Linux" : "";
  return { label: `${browser}${os ? ` on ${os}` : ""}`, mobile: /Mobile|iPhone|Android/.test(ua) };
}

export function AccountView({
  user,
  hasPassword,
  enabledProviders,
  bonusMessage,
}: {
  user: { name: string; email: string; emailVerified: boolean; image: string | null; createdAt: string; username: string | null };
  hasPassword: boolean;
  enabledProviders: Provider[];
  bonusMessage: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username ?? "");
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState("");
  const [accounts, setAccounts] = useState<{ id: string; providerId: string }[] | null>(null);
  const linked = accounts?.map((a) => a.providerId) ?? null;
  const [sessions, setSessions] = useState<SessionRow[] | null>(null);
  const [current, setCurrent] = useState<string | null>(null);

  const load = async () => {
    const [acc, ses, me] = await Promise.all([authClient.listAccounts(), authClient.listSessions(), authClient.getSession()]);
    setAccounts((acc.data ?? []).map((a: { id: string; providerId: string }) => ({ id: a.id, providerId: a.providerId })));
    setSessions((ses.data ?? []) as SessionRow[]);
    setCurrent(me.data?.session?.token ?? null);
  };
  useEffect(() => {
    void load();
  }, []);

  const signInMethods = (linked?.length ?? 0) + (hasPassword && !linked?.includes("credential") ? 1 : 0);

  return (
    <div className="space-y-6">
      {!user.emailVerified && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <MailWarningIcon className="size-5 text-amber-500" />
          <p className="flex-1">Confirm your email to unlock your free credits and publishing.</p>
          <Button
            size="sm"
            variant="outline"
            disabled={busy === "verify"}
            onClick={async () => {
              setBusy("verify");
              const { error } = await authClient.sendVerificationEmail({ email: user.email, callbackURL: "/settings/account" });
              setBusy(null);
              if (error) toast.error(error.status === 429 ? "Please wait before asking for another email." : (error.message ?? "Couldn't send the email"));
              else toast.success("Confirmation email sent");
            }}
          >
            {busy === "verify" && <LoaderCircleIcon className="animate-spin" />} Send confirmation email
          </Button>
        </div>
      )}
      {bonusMessage && <p className="rounded-2xl border bg-card/60 p-4 text-sm text-muted-foreground">{bonusMessage}</p>}

      <SettingsSection title="Profile">
        <div className="flex items-center gap-4">
          <Avatar src={user.image} name={user.name} className="size-14 text-base" />
          <div>
            <p className="font-medium">{user.email}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              {user.emailVerified ? (
                <>
                  <ShieldCheckIcon className="size-3.5 text-success" /> Verified
                </>
              ) : (
                "Not verified"
              )}
              <span>· Member since {new Date(user.createdAt).toLocaleDateString()}</span>
            </p>
          </div>
        </div>
        <div className="mt-6 grid max-w-xl gap-5">
          <form
            className="flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("name");
              const { error } = await authClient.updateUser({ name: name.trim() });
              setBusy(null);
              if (error) toast.error(error.message ?? "Could not update");
              else {
                toast.success("Name updated");
                router.refresh();
              }
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="name">Display name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </div>
            <Button type="submit" variant="outline" disabled={busy === "name" || name === user.name || !name.trim()}>
              {busy === "name" && <LoaderCircleIcon className="animate-spin" />} Save
            </Button>
          </form>
          <form
            className="flex items-end gap-2"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy("username");
              const res = await fetch("/api/account", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username }) });
              const data = await res.json().catch(() => ({}));
              setBusy(null);
              if (!res.ok) toast.error(data?.error?.message ?? "Could not update the username");
              else {
                toast.success("Username updated");
                router.refresh();
              }
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={24} className="font-mono" />
              <p className="text-xs text-muted-foreground">
                Published apps use it: <span className="font-mono text-foreground">{username || "username"}-project</span>. Changing it doesn&apos;t move apps already published.
              </p>
            </div>
            <Button type="submit" variant="outline" className="mb-6" disabled={busy === "username" || username === user.username || username.length < 3}>
              {busy === "username" && <LoaderCircleIcon className="animate-spin" />} Save
            </Button>
          </form>
        </div>
      </SettingsSection>

      <SettingsSection title="Sign-in methods" description="Link several so you never get locked out.">
        <div className="divide-y">
          <Row label="Email and password" hint={hasPassword ? "Enabled" : "Not set. Use “Forgot password” on the log-in page to create one."}>
            <KeyRoundIcon className="size-4 text-muted-foreground" />
          </Row>
          {PROVIDERS.map((p) => {
            const isLinked = linked?.includes(p.id);
            const on = enabledProviders.includes(p.id);
            return (
              <Row key={p.id} label={p.label} hint={isLinked ? "Connected" : on ? "Not connected" : "Coming soon"}>
                <div className="flex items-center gap-3">
                  <BrandLogo id={p.id} className="size-4" />
                  {isLinked ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === p.id || signInMethods <= 1}
                      title={signInMethods <= 1 ? "Add another sign-in method first" : undefined}
                      onClick={async () => {
                        setBusy(p.id);
                        const target = accounts?.find((a) => a.providerId === p.id);
                        if (!target) return setBusy(null);
                        const { error } = await authClient.unlinkAccount({ accountId: target.id });
                        setBusy(null);
                        if (error) toast.error(error.message ?? "Could not disconnect");
                        else void load();
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!on || busy === p.id}
                      onClick={async () => {
                        setBusy(p.id);
                        const { error } = await authClient.linkSocial({ provider: p.id, callbackURL: "/settings/account" });
                        if (error) {
                          setBusy(null);
                          toast.error(error.message ?? "Could not connect");
                        }
                      }}
                    >
                      {on ? "Connect" : "Soon"}
                    </Button>
                  )}
                </div>
              </Row>
            );
          })}
        </div>
      </SettingsSection>

      {hasPassword && (
        <SettingsSection title="Password">
          <form
            className="grid max-w-md gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy("password");
              const { error } = await authClient.changePassword({ currentPassword: String(f.get("current")), newPassword: String(f.get("next")), revokeOtherSessions: true });
              setBusy(null);
              if (error) toast.error(error.message ?? "Could not change the password");
              else {
                toast.success("Password changed. Other sessions were signed out.");
                (e.target as HTMLFormElement).reset();
                void load();
              }
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="current">Current password</Label>
              <Input id="current" name="current" type="password" required autoComplete="current-password" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="next">New password</Label>
              <Input id="next" name="next" type="password" required minLength={8} maxLength={128} autoComplete="new-password" />
            </div>
            <Button type="submit" variant="outline" className="w-fit" disabled={busy === "password"}>
              {busy === "password" && <LoaderCircleIcon className="animate-spin" />} Change password
            </Button>
          </form>
        </SettingsSection>
      )}

      <SettingsSection
        title="Active sessions"
        description="Devices currently signed in to your account."
        action={
          (sessions?.length ?? 0) > 1 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await authClient.revokeOtherSessions();
                toast.success("Signed out everywhere else");
                void load();
              }}
            >
              Sign out other sessions
            </Button>
          ) : undefined
        }
      >
        {!sessions ? (
          <LoaderCircleIcon className="size-4 animate-spin text-muted-foreground" />
        ) : (
          <ul className="divide-y">
            {sessions.map((s) => {
              const d = describeAgent(s.userAgent);
              const isCurrent = s.token === current;
              return (
                <li key={s.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  {d.mobile ? <SmartphoneIcon className="size-4 text-muted-foreground" /> : <LaptopIcon className="size-4 text-muted-foreground" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {d.label} {isCurrent && <span className="ml-1 rounded-full bg-success/15 px-1.5 py-px text-[10px] font-semibold text-success">This device</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.ipAddress ?? "Unknown IP"} · last active {new Date(s.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  {!isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await authClient.revokeSession({ token: s.token });
                        void load();
                      }}
                    >
                      Sign out
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </SettingsSection>

      <SettingsSection title="Your data" description="Download a copy of everything Forged stores about you: profile, projects with their source code, conversations, credits and settings.">
        <Button asChild variant="outline">
          <a href="/api/account/export" download>
            <DownloadIcon /> Download my data (.zip)
          </a>
        </Button>
      </SettingsSection>

      <SettingsSection title="Delete account" description="Deletes your projects, published apps, conversations, connectors and remaining credits. This can't be undone.">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="destructive">Delete my account</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete your account?</DialogTitle>
              <DialogDescription>
                Everything is removed within 30 days, backups included. Type <strong>DELETE</strong> to confirm.
              </DialogDescription>
            </DialogHeader>
            <Input value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="DELETE" />
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={confirm !== "DELETE" || busy === "delete"}
                onClick={async () => {
                  setBusy("delete");
                  const { error } = await authClient.deleteUser({ callbackURL: "/" });
                  setBusy(null);
                  if (error) return toast.error(error.message?.includes("fresh") ? "For safety, log out and log in again, then retry." : (error.message ?? "Could not delete the account"));
                  toast.success("Your account was deleted");
                  router.push("/");
                  router.refresh();
                }}
              >
                {busy === "delete" && <LoaderCircleIcon className="animate-spin" />} Delete forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SettingsSection>
    </div>
  );
}
