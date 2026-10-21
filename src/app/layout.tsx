import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import { Providers } from "@/components/providers";
import { themeScript } from "@/components/theme-provider";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

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
    { media: "(prefers-color-scheme: dark)", color: "#120e0c" },
    { media: "(prefers-color-scheme: light)", color: "#fdfbf9" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`dark ${geistSans.variable} ${geistMono.variable} ${instrumentSerif.variable} h-full`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
