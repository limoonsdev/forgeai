import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { isLegalDoc, legalEntity, legalMarkdown, LEGAL_DOCS, LEGAL_TITLES, pickLang } from "@/lib/legal";
import { cn } from "@/lib/utils";

export async function generateMetadata({ params }: PageProps<"/legal/[doc]">): Promise<Metadata> {
  const { doc } = await params;
  if (!isLegalDoc(doc)) return {};
  return { title: LEGAL_TITLES[doc].en, alternates: { languages: { en: `/legal/${doc}?lang=en`, fr: `/legal/${doc}?lang=fr` } } };
}

export default async function LegalPage({ params, searchParams }: PageProps<"/legal/[doc]">) {
  const { doc } = await params;
  if (!isLegalDoc(doc)) notFound();
  const lang = await pickLang((await searchParams).lang);
  const e = legalEntity();
  return (
    <main className="mx-auto grid max-w-6xl gap-10 px-4 pt-28 pb-24 sm:px-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="lg:sticky lg:top-28 lg:self-start">
        <nav aria-label="Legal" className="flex gap-1 overflow-x-auto pb-2 lg:flex-col lg:pb-0">
          {LEGAL_DOCS.map((d) => (
            <Link
              key={d}
              href={`/legal/${d}?lang=${lang}`}
              className={cn("shrink-0 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground", d === doc && "bg-accent text-foreground")}
            >
              {LEGAL_TITLES[d][lang]}
            </Link>
          ))}
          <Link href="/report" className="shrink-0 rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:text-foreground">
            {lang === "fr" ? "Signaler un contenu" : "Report content"}
          </Link>
        </nav>
      </aside>
      <article lang={lang}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-xs tracking-[0.18em] text-primary uppercase">{lang === "fr" ? "Informations légales" : "Legal"}</p>
          <div className="flex rounded-lg border p-0.5 text-xs" role="group" aria-label="Language">
            {(["en", "fr"] as const).map((l) => (
              <Link key={l} href={`/legal/${doc}?lang=${l}`} hrefLang={l} className={cn("rounded-md px-2.5 py-1", l === lang ? "bg-accent text-foreground" : "text-muted-foreground")}>
                {l === "en" ? "English" : "Français"}
              </Link>
            ))}
          </div>
        </div>
        <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">{LEGAL_TITLES[doc][lang]}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {lang === "fr" ? "Dernière mise à jour" : "Last updated"}: {e.updated}
        </p>
        <div className="legal-prose mt-8">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{legalMarkdown(doc, lang)}</ReactMarkdown>
        </div>
      </article>
    </main>
  );
}
