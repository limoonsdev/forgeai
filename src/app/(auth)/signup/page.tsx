import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/auth-forms";
import { enabledSocialProviders } from "@/lib/auth";
import { REF_COOKIE } from "@/lib/config";
import { emailConfigured } from "@/lib/server/email";

export const metadata: Metadata = { title: "Sign up" };

export default async function SignupPage({ searchParams }: PageProps<"/signup">) {
  const sp = await searchParams;
  const jar = await cookies();
  const fromQuery = typeof sp.ref === "string" ? sp.ref.toUpperCase() : null;
  const referral = fromQuery ?? jar.get(REF_COOKIE)?.value ?? null;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const prompt = typeof sp.prompt === "string" ? sp.prompt : undefined;
  return (
    <AuthShell
      title="Create your account"
      subtitle={
        <>
          Already have an account?{" "}
          <Link href={`/login${prompt ? `?prompt=${encodeURIComponent(prompt)}` : ""}`} className="text-primary hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <SignupForm providers={enabledSocialProviders} next={next} prompt={prompt} saver={sp.saver === "1"} referralCode={referral} verificationRequired={emailConfigured()} />
    </AuthShell>
  );
}
