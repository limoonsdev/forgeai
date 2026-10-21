import type { Metadata } from "next";
import Link from "next/link";
import { legalEntity } from "@/lib/legal/entity";
import { ReportForm } from "@/components/legal/report-form";

export const metadata: Metadata = { title: "Report content", description: "Report an app or a shared session built with Forged." };

export default async function ReportPage({ searchParams }: PageProps<"/report">) {
  const sp = await searchParams;
  const url = typeof sp.url === "string" ? sp.url.slice(0, 500) : "";
  return (
    <main className="mx-auto max-w-2xl px-4 pt-28 pb-24 sm:px-6">
      <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">Trust and safety</p>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Report content</h1>
      <p className="mt-3 text-muted-foreground">
        Use this form to report an app published on Forged or a shared session that breaks the law or our{" "}
        <Link href="/legal/acceptable-use" className="text-primary underline underline-offset-2">
          Acceptable Use Policy
        </Link>
        . A person reviews every report. You can also email {legalEntity().abuseEmail}.
      </p>
      <ReportForm initialUrl={url} />
    </main>
  );
}
