import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { themeScript } from "@/components/theme-provider";
import { appearanceScript } from "@/lib/appearance";
import "./globals.css";

// Archivo: a grotesque with a real width axis (expanded for headlines, normal for UI text).
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin", "latin-ext"], axes: ["wdth"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Forged.dev — Forge production-ready Next.js apps with AI",
    template: "%s · Forged.dev",
  },
  description:
    "Describe your idea. Forged's AI agent writes, runs and previews a real Next.js app in a cloud VM — then you ship it. Choose your model, save tokens, share sessions.",
  keywords: ["AI website builder", "Next.js", "AI agent", "app builder", "Lovable alternative", "v0 alternative"],
  openGraph: {
    title: "Forged.dev — Forge apps from a single prompt",
    description: "The AI agent that forges real Next.js apps in a live VM.",
    url: appUrl,
    siteName: "Forged.dev",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Forged.dev", description: "Forge real Next.js apps from a single prompt." },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d0a09" },
    { media: "(prefers-color-scheme: light)", color: "#fbf8f5" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${archivo.variable} ${plexMono.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript + appearanceScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
