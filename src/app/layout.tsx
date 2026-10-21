import type { Metadata, Viewport } from "next";
import { Archivo, IBM_Plex_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import { themeScript } from "@/lib/theme-script";
import { appearanceScript } from "@/lib/appearance";
import "./globals.css";

// Archivo: a grotesque with a real width axis (expanded for headlines, normal for UI text).
const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin", "latin-ext"], axes: ["wdth"], display: "swap" });
const plexMono = IBM_Plex_Mono({ variable: "--font-plex-mono", subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], display: "swap" });

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "Forged.dev: describe a web app, an agent builds it",
    template: "%s · Forged.dev",
  },
  description:
    "Describe the app you want. An AI agent writes it in Next.js, runs it in its own VM and shows you every step. Publish it or download the code.",
  keywords: ["AI website builder", "Next.js", "AI agent", "app builder"],
  openGraph: {
    title: "Forged.dev",
    description: "Describe a web app. An agent builds it in Next.js and runs it live.",
    url: appUrl,
    siteName: "Forged.dev",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Forged.dev", description: "Describe a web app. An agent builds it in Next.js and runs it live." },
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
