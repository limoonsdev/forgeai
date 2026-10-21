import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/auth-forms";
import { enabledSocialProviders } from "@/lib/auth";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = typeof sp.next === "string" ? sp.next : undefined;
  const prompt = typeof sp.prompt === "string" ? sp.prompt : undefined;
  const signupHref = `/signup${prompt ? `?prompt=${encodeURIComponent(prompt)}` : ""}`;
  return (
    <AuthShell
      title="Welcome back"
      subtitle={
        <>
          New to Forged?{" "}
          <Link href={signupHref} className="text-primary hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <LoginForm providers={enabledSocialProviders} next={next} prompt={prompt} saver={sp.saver === "1"} />
    </AuthShell>
  );
}
