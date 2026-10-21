import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailPanel } from "@/components/auth/verify-email";

export const metadata: Metadata = { title: "Confirm your email" };

export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  const sp = await searchParams;
  const email = typeof sp.email === "string" ? sp.email.slice(0, 200) : "";
  const next = typeof sp.next === "string" && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/dashboard";
  return (
    <AuthShell title="Check your inbox" subtitle={email ? <>We sent a confirmation link to <span className="text-foreground">{email}</span>.</> : "We sent you a confirmation link."}>
      <VerifyEmailPanel email={email} next={next} />
    </AuthShell>
  );
}
