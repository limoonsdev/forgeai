"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LoaderCircleIcon, MailWarningIcon } from "lucide-react";
import { authClient } from "@/lib/auth-client";

export function VerifyBanner({ email }: { email: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="border-b border-amber-500/25 bg-amber-500/10">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-sm sm:px-6">
        <MailWarningIcon className="size-4 text-amber-500" />
        <span>Confirm your email to get your free credits.</span>
        <button
          className="inline-flex items-center gap-1.5 font-medium text-foreground underline underline-offset-2 disabled:opacity-60"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const { error } = await authClient.sendVerificationEmail({ email, callbackURL: "/dashboard" });
            setBusy(false);
            if (error) toast.error(error.status === 429 ? "Please wait before asking for another email." : (error.message ?? "Couldn't send the email"));
            else toast.success(`Confirmation email sent to ${email}`);
          }}
        >
          {busy && <LoaderCircleIcon className="size-3.5 animate-spin" />} Resend the email
        </button>
      </div>
    </div>
  );
}
