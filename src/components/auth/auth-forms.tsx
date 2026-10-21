"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EyeIcon, EyeOffIcon, GiftIcon, LoaderCircleIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GithubIcon, GoogleIcon } from "./social-icons";

type Social = "github" | "google";

function nextUrl(next?: string | null, prompt?: string | null, saver?: boolean) {
  const base = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (!prompt) return base;
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}prompt=${encodeURIComponent(prompt)}${saver ? "&saver=1" : ""}`;
}

function SocialButtons({ providers, callbackURL }: { providers: Social[]; callbackURL: string }) {
  const [loading, setLoading] = useState<Social | null>(null);
  if (!providers.length) return null;
  return (
    <>
      <div className="grid gap-2">
        {providers.map((p) => (
          <Button
            key={p}
            type="button"
            variant="outline"
            size="lg"
            disabled={loading !== null}
            onClick={async () => {
              setLoading(p);
              const { error } = await authClient.signIn.social({ provider: p, callbackURL });
              if (error) {
                toast.error(error.message ?? "Could not sign in");
                setLoading(null);
              }
            }}
          >
            {loading === p ? <LoaderCircleIcon className="animate-spin" /> : p === "github" ? <GithubIcon className="size-4" /> : <GoogleIcon className="size-4" />}
            Continue with {p === "github" ? "GitHub" : "Google"}
          </Button>
        ))}
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
      <button type="button" onClick={() => setShow((s) => !s)} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" aria-label="Toggle password visibility">
        {show ? <EyeOffIcon className="size-4" /> : <EyeIcon className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ providers, next, prompt, saver }: { providers: Social[]; next?: string; prompt?: string; saver?: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const target = nextUrl(next, prompt, saver);

  return (
    <div>
      <SocialButtons providers={providers} callbackURL={target} />
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setLoading(true);
          const { error } = await authClient.signIn.email({
            email: String(form.get("email")),
            password: String(form.get("password")),
            rememberMe: true,
          });
          if (error) {
            toast.error(error.message ?? "Invalid email or password");
            setLoading(false);
            return;
          }
          router.push(target);
          router.refresh();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
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
}: {
  providers: Social[];
  next?: string;
  prompt?: string;
  saver?: boolean;
  referralCode?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState(referralCode ?? "");
  const [showCode, setShowCode] = useState(Boolean(referralCode));
  const target = nextUrl(next, prompt, saver);

  const rememberCode = () => {
    const c = code.trim().toUpperCase();
    if (/^[A-Z0-9]{4,16}$/.test(c)) document.cookie = `forged_ref=${c}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
  };

  return (
    <div>
      {referralCode && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-primary/30 bg-primary/10 p-3 text-sm">
          <GiftIcon className="size-5 shrink-0 text-primary" />
          <span>
            You&apos;ve been invited! <strong>$5 of free credits</strong> will be added to your account.
          </span>
        </div>
      )}
      <SocialButtons providers={providers} callbackURL={target} />
      <form
        className="space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const form = new FormData(e.currentTarget);
          setLoading(true);
          rememberCode();
          const { error } = await authClient.signUp.email({
            name: String(form.get("name")),
            email: String(form.get("email")),
            password: String(form.get("password")),
          });
          if (error) {
            toast.error(error.message ?? "Could not create your account");
            setLoading(false);
            return;
          }
          toast.success("Welcome to Forged.dev 🔥");
          router.push(target);
          router.refresh();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" autoComplete="name" placeholder="Ada Lovelace" required maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <PasswordInput id="password" name="password" autoComplete="new-password" placeholder="At least 8 characters" required minLength={8} />
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
        <Button type="submit" variant="ember" size="lg" className="w-full" disabled={loading}>
          {loading && <LoaderCircleIcon className="animate-spin" />} Create account
        </Button>
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
        toast.success("Password updated — you can log in now");
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
