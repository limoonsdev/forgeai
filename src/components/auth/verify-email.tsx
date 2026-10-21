"use client";

import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { LoaderCircleIcon, MailCheckIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export function VerifyEmailPanel({ email, next }: { email: string; next: string }) {
  const [sending, setSending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const resend = async () => {
    if (!email) return;
    setSending(true);
    const { error } = await authClient.sendVerificationEmail({ email, callbackURL: next });
    setSending(false);
    if (error) toast.error(error.status === 429 ? "Please wait before asking for another email." : (error.message ?? "Couldn't send the email"));
    else {
      toast.success("Email sent");
      setCooldown(60);
      const t = setInterval(() => setCooldown((c) => (c <= 1 ? (clearInterval(t), 0) : c - 1)), 1000);
    }
  };
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3 rounded-xl border bg-card/60 p-4 text-sm">
        <MailCheckIcon className="mt-0.5 size-5 shrink-0 text-primary" />
        <p className="text-muted-foreground">
          Open the link in the email to confirm your address. Your free credits are added right after. The link is valid for 24 hours; check your spam folder if you don&apos;t see it.
        </p>
      </div>
      <Button asChild variant="ember" size="lg" className="w-full">
        <Link href={next}>Continue to Forged</Link>
      </Button>
      {email && (
        <Button variant="ghost" className="w-full" onClick={resend} disabled={sending || cooldown > 0}>
          {sending && <LoaderCircleIcon className="animate-spin" />}
          {cooldown > 0 ? `Resend available in ${cooldown}s` : "Resend the email"}
        </Button>
      )}
    </div>
  );
}
