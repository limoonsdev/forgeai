import type { Metadata } from "next";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const sp = await searchParams;
  const token = typeof sp.token === "string" ? sp.token : null;
  return (
    <AuthShell title="Choose a new password" subtitle="Pick something strong — at least 8 characters.">
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}
