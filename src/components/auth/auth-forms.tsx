"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CheckIcon, EyeIcon, EyeOffIcon, GiftIcon, LoaderCircleIcon, ShieldCheckIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { prepareSignupProof } from "@/lib/client/signup-proof";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type Social = "google" | "github" | "discord" | "apple" | "facebook";

const PROVIDERS: { id: Social; label: string }[] = [
  { id: "google", label: "Google" },
  { id: "github", label: "GitHub" },
  { id: "discord", label: "Discord" },
  { id: "apple", label: "Apple" },
  { id: "facebook", label: "Facebook" },
];

function nextUrl(next?: string | null, prompt?: string | null, saver?: boolean) {
  const base = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (!prompt) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}prompt=${encodeURIComponent(prompt)}${saver ? "&saver=1" : ""}`;
}

/**
 * Runs the sign-up security check in the background as soon as the form appears, so it is
 * usually done before the user finishes typing. Proofs expire after ~9 minutes and are refreshed.
 */
function useSignupProof(enabled: boolean) {
  const [state, setState] = useState<{ phase: "idle" | "working" | "ready" | "error"; progress: number; error?: string }>({ phase: "idle", progress: 0 });
  const expires = useRef(0);
  const inflight = useRef<Promise<boolean> | null>(null);

  const run = useCallback(() => {
    if (inflight.current) return inflight.current;
    if (expires.current > Date.now()) return Promise.resolve(true);
    setState({ phase: "working", progress: 0 });
    inflight.current = prepareSignupProof((p) => setState((s) => ({ ...s, progress: p })))
      .then((r) => {
        expires.current = r.expiresAt;
        setState({ phase: "ready", progress: 1 });
        return true;
      })
      .catch((err: Error) => {
        setState({ phase: "error", progress: 0, error: err.message });
        return false;
      })
      .finally(() => {
        inflight.current = null;
      });
    return inflight.current;
  }, []);

  useEffect(() => {
    if (enabled) void run();
  }, [enabled, run]);

  return { state, ensure: run, invalidate: () => (expires.current = 0) };
}

function ProofBadge({ state }: { state: ReturnType<typeof useSignupProof>["state"] }) {
  if (state.phase === "idle") return null;
  return (
    <p className={cn("flex items-center gap-2 text-xs", state.phase === "error" ? "text-destructive" : "text-muted-foreground")} aria-live="polite">
      {state.phase === "working" ? (
        <LoaderCircleIcon className="size-3.5 animate-spin" />
      ) : state.phase === "ready" ? (
        <ShieldCheckIcon className="size-3.5 text-success" />
      ) : (
        <ShieldCheckIcon className="size-3.5" />
      )}
      {state.phase === "working" ? `Running a quick security check… ${Math.round(state.progress * 100)}%` : state.phase === "ready" ? "Security check passed" : state.error}
    </p>
  );
}

function SocialButtons({ enabled, callbackURL, beforeRedirect }: { enabled: Social[]; callbackURL: string; beforeRedirect?: () => Promise<boolean> }) {
  const [loading, setLoading] = useState<Social | null>(null);
  const start = async (p: Social) => {
    setLoading(p);
    if (beforeRedirect && !(await beforeRedirect())) {
      setLoading(null);
      return;
    }
    const { error } = await authClient.signIn.social({ provider: p, callbackURL, errorCallbackURL: "/login?error=oauth", newUserCallbackURL: callbackURL });
    if (error) {
      toast.error(error.message ?? "Could not sign in");
      setLoading(null);
    }
  };
  const button = (p: (typeof PROVIDERS)[number], wide: boolean) => {
    const on = enabled.includes(p.id);
    const inner = (
      <Button
        key={p.id}
        type="button"
        variant="outline"
        size="lg"
        disabled={!on || loading !== null}
        onClick={() => on && start(p.id)}
        className={cn("relative w-full", !on && "opacity-60")}
        aria-label={on ? `Continue with ${p.label}` : `${p.label} sign-in coming soon`}
        data-testid={`oauth-${p.id}`}
      >
        {loading === p.id ? <LoaderCircleIcon className="animate-spin" /> : <BrandLogo id={p.id} className="size-4" />}
        {wide ? `Continue with ${p.label}` : p.label}
        {!on && <span className="absolute -top-2 right-2 rounded-full border bg-background px-1.5 font-mono text-[9px] tracking-wide text-muted-foreground uppercase">Soon</span>}
      </Button>
    );
    return on ? inner : (
      <Tooltip key={p.id} content={`${p.label} sign-in is coming soon`}>
        <span className="block">{inner}</span>
      </Tooltip>
    );
  };
  return (
    <>
      <div className="grid gap-2">
        {button(PROVIDERS[0], true)}
        <div className="grid grid-cols-2 gap-2">{PROVIDERS.slice(1).map((p) => button(p, false))}</div>
      </div>
      <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or with email <span className="h-px flex-1 bg-border" />
      </div>
    </>
  );
}

function PasswordInput(props: React.ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? "text" : "password"} className="pr-10" />
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

function strength(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw) && /[^\w]/.test(pw)) score++;
  if (/^(.)\1+$/.test(pw) || /^(password|12345678|azerty|qwerty)/i.test(pw)) score = 0;
  return score;
}

export function LoginForm({ providers, next, prompt, saver, error }: { providers: Social[]; next?: string; prompt?: string; saver?: boolean; error?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const target = nextUrl(next, prompt, saver);
  // OAuth from the login page can create a new account: prepare the proof only when it's used.
  const proof = useSignupProof(false);

  useEffect(() => {
    if (error) toast.error(error === "oauth" ? "That sign-in didn't complete. Try again or use another method." : error);
  }, [error]);

  return (
    <div>
      <SocialButtons enabled={providers} callbackURL={target} beforeRedirect={() => proof.ensure()} />
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setLoading(true);
          const { error } = await authClient.signIn.email({ email: String(form.get("email")), password: String(form.get("password")), rememberMe: true });
          if (error) {
            toast.error(error.status === 429 ? "Too many attempts. Wait a few minutes." : (error.message ?? "Invalid email or password"));
            setLoading(false);
            return;
          }
          router.push(target);
          router.refresh();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-foreground">
              Forgot password?
            </Link>
          </div>
          <PasswordInput id="password" name="password" autoComplete="current-password" required minLength={8} />
        </div>
        <Button type="submit" variant="ember" size="lg" className="w-full" disabled={loading}>
          {loading && <LoaderCircleIcon className="animate-spin" />} Log in
        </Button>
        {proof.state.phase !== "idle" && <ProofBadge state={proof.state} />}
      </form>
    </div>
  );
}

export function SignupForm({
  providers,
  next,
  prompt,
  saver,
  referralCode,
  verificationRequired,
}: {
  providers: Social[];
  next?: string;
  prompt?: string;
  saver?: boolean;
  referralCode?: string | null;
  verificationRequired: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(referralCode ?? "");
  const [showCode, setShowCode] = useState(Boolean(referralCode));
  const [password, setPassword] = useState("");
  const [accepted, setAccepted] = useState(false);
  const mountedAt = useRef(0);
  const target = nextUrl(next, prompt, saver);
  const proof = useSignupProof(true);
  const pwScore = strength(password);

  useEffect(() => {
    mountedAt.current = Date.now();
  }, []);

  const rememberCode = () => {
    const c = code.trim().toUpperCase();
    if (/^[A-Z0-9]{4,16}$/.test(c)) document.cookie = `forged_ref=${c}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  };

  return (
    <div>
      {referralCode && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
          <GiftIcon className="size-5 shrink-0 text-primary" />
          <span>You were invited. You&apos;ll get $5 of credits once you confirm your email.</span>
        </div>
      )}
      <SocialButtons
        enabled={providers}
        callbackURL={target}
        beforeRedirect={async () => {
          if (!accepted) {
            toast.error("Please accept the Terms and Privacy Policy first.");
            return false;
          }
          rememberCode();
          return proof.ensure();
        }}
      />
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          if (form.get("website")) return; // honeypot
          if (!accepted) {
            toast.error("Please accept the Terms and Privacy Policy.");
            return;
          }
          if (Date.now() - mountedAt.current < 2500) await new Promise((r) => setTimeout(r, 2500));
          setLoading(true);
          rememberCode();
          if (!(await proof.ensure())) {
            setLoading(false);
            return;
          }
          const email = String(form.get("email"));
          const { data, error } = await authClient.signUp.email({ name: String(form.get("name")), email, password });
          proof.invalidate();
          if (error) {
            toast.error(error.status === 429 ? "Too many sign-up attempts from this network. Try again later." : (error.message ?? "Could not create your account"));
            setLoading(false);
            void proof.ensure();
            return;
          }
          const verified = !verificationRequired || Boolean((data as { user?: { emailVerified?: boolean } } | null)?.user?.emailVerified);
          router.push(verified ? target : `/verify-email?email=${encodeURIComponent(email)}&next=${encodeURIComponent(target)}`);
          router.refresh();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" required maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={200} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" name="password" autoComplete="new-password" placeholder="At least 8 characters" required minLength={8} maxLength={128} value={password} onChange={(e) => setPassword(e.target.value)} />
          {password && (
            <div className="flex items-center gap-2" aria-live="polite">
              <div className="flex flex-1 gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <span key={i} className={cn("h-1 flex-1 rounded-full bg-muted transition-colors", i <= pwScore && (pwScore <= 1 ? "bg-destructive" : pwScore === 2 ? "bg-amber-500" : "bg-success"))} />
                ))}
              </div>
              <span className="w-12 text-right text-[11px] text-muted-foreground">{["Weak", "Weak", "Fair", "Good", "Strong"][pwScore]}</span>
            </div>
          )}
        </div>
        {showCode ? (
          <div className="space-y-2">
            <Label htmlFor="ref">Referral code</Label>
            <Input id="ref" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ABCD2345" className="font-mono uppercase" maxLength={16} />
          </div>
        ) : (
          <button type="button" onClick={() => setShowCode(true)} className="text-xs text-muted-foreground hover:text-foreground">
            Have a referral code?
          </button>
        )}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" />
        <label className="flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
          <Checkbox checked={accepted} onCheckedChange={(c) => setAccepted(c === true)} className="mt-0.5" data-testid="accept-terms" />
          <span>
            I&apos;m at least 16 and I accept the{" "}
            <Link href="/legal/terms" target="_blank" className="text-foreground underline underline-offset-2">
              Terms
            </Link>
            ,{" "}
            <Link href="/legal/acceptable-use" target="_blank" className="text-foreground underline underline-offset-2">
              Acceptable Use Policy
            </Link>{" "}
            and{" "}
            <Link href="/legal/privacy" target="_blank" className="text-foreground underline underline-offset-2">
              Privacy Policy
            </Link>
            .
          </span>
        </label>
        <Button type="submit" variant="ember" size="lg" className="w-full" disabled={loading || proof.state.phase === "error"} data-testid="signup-submit">
          {loading ? <LoaderCircleIcon className="animate-spin" /> : proof.state.phase === "ready" ? <CheckIcon /> : null} Create account
        </Button>
        <ProofBadge state={proof.state} />
      </form>
    </div>
  );
}

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent)
    return (
      <div className="rounded-xl border bg-card p-4 text-sm">
        If an account exists for this email, a reset link is on its way. Check your inbox (and spam folder).
      </div>
    );
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        setLoading(true);
        const email = String(new FormData(e.currentTarget).get("email"));
        const { error } = await authClient.requestPasswordReset({ email, redirectTo: "/reset-password" });
        setLoading(false);
        if (error) toast.error(error.message ?? "Could not send the email");
        else setSent(true);
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" required placeholder="you@company.com" />
      </div>
      <Button type="submit" variant="ember" size="lg" className="w-full" disabled={loading}>
        {loading && <LoaderCircleIcon className="animate-spin" />} Send reset link
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  if (!token) return <p className="text-sm text-destructive">This reset link is invalid or has expired.</p>;
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const form = new FormData(e.currentTarget);
        const password = String(form.get("password"));
        if (password !== String(form.get("confirm"))) {
          toast.error("Passwords do not match");
          return;
        }
        setLoading(true);
        const { error } = await authClient.resetPassword({ newPassword: password, token });
        setLoading(false);
        if (error) {
          toast.error(error.message ?? "Could not reset your password");
          return;
        }
        toast.success("Password updated. You can log in now.");
        router.push("/login");
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="password">New password</Label>
        <PasswordInput id="password" name="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirm">Confirm password</Label>
        <PasswordInput id="confirm" name="confirm" required minLength={8} autoComplete="new-password" />
      </div>
      <Button type="submit" variant="ember" size="lg" className="w-full" disabled={loading}>
        {loading && <LoaderCircleIcon className="animate-spin" />} Update password
      </Button>
    </form>
  );
}
