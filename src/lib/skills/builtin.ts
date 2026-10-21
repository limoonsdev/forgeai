export type SkillDoc = { slug: string; name: string; description: string; content: string; builtin?: boolean };

/** Skills shipped with Forged. Users can disable them or import their own SKILL.md files. */
export const BUILTIN_SKILLS: SkillDoc[] = [
  {
    slug: "ui-components",
    name: "ui-components",
    description: "Build shadcn-style accessible UI components (Button, Dialog, Tabs…) with radix-ui, cva and Tailwind v4.",
    content: `# Accessible UI components (shadcn-style)

Use the pre-installed \`radix-ui\` package for behaviour and Tailwind for styling. Put primitives in \`components/ui/\`.

- Import primitives from the unified package: \`import { Dialog as DialogPrimitive, Slot } from "radix-ui"\`.
- Variants with \`cva\` from \`class-variance-authority\`; merge classes with \`cn()\` from \`@/lib/utils\`.
- Every interactive primitive file starts with \`"use client"\`.
- Button pattern:
\`\`\`tsx
const buttonVariants = cva("inline-flex items-center justify-center gap-2 rounded-lg text-sm font-medium transition disabled:opacity-50", {
  variants: { variant: { default: "bg-neutral-900 text-white hover:bg-neutral-800", outline: "border hover:bg-neutral-50" },
              size: { default: "h-9 px-4", sm: "h-8 px-3 text-xs", lg: "h-11 px-6" } },
  defaultVariants: { variant: "default", size: "default" },
});
\`\`\`
- Always keep focus-visible rings, aria labels on icon-only buttons and keyboard support.
- Prefer composition (Card, CardHeader, CardContent) over giant prop APIs.`,
  },
  {
    slug: "motion-animations",
    name: "motion-animations",
    description: "Tasteful animations with motion/react: entrances, stagger, scroll reveal, layout and hover effects.",
    content: `# Motion animations

Import from \`motion/react\` (the package is \`motion\`, the successor of framer-motion). Components using it need \`"use client"\`.

- Entrance: \`<motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />\`
- Scroll reveal: \`whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }}\`.
- Stagger children with \`variants\` and \`transition: { staggerChildren: 0.06 }\`.
- Parallax: \`const { scrollYProgress } = useScroll({ target: ref }); const y = useTransform(scrollYProgress, [0, 1], [0, -80]);\`
- Respect reduced motion: \`useReducedMotion()\` and skip large movements.
- Keep durations 0.2–0.7s, animate transform/opacity only, never block content behind animations.`,
  },
  {
    slug: "seo-metadata",
    name: "seo-metadata",
    description: "SEO for Next.js App Router: Metadata API, Open Graph images, sitemap.ts, robots.ts and JSON-LD.",
    content: `# SEO in Next.js 16

- \`export const metadata: Metadata = { title: { default, template: "%s · Brand" }, description, openGraph, twitter }\` in app/layout.tsx.
- Per-page dynamic metadata: \`export async function generateMetadata({ params }) { const { slug } = await params; ... }\`.
- \`app/sitemap.ts\` returns \`MetadataRoute.Sitemap\`; \`app/robots.ts\` returns \`MetadataRoute.Robots\`.
- OG image: \`app/opengraph-image.tsx\` using \`ImageResponse\` from \`next/og\` (size 1200×630).
- JSON-LD: render \`<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />\` in a Server Component.
- One \`<h1>\` per page, descriptive link text, \`alt\` on every image, semantic landmarks.`,
  },
  {
    slug: "forms-server-actions",
    name: "forms-server-actions",
    description: "Forms with Server Actions, zod validation, useActionState pending/error states and toasts.",
    content: `# Forms with Server Actions

1. \`app/actions.ts\` with \`"use server"\`: parse \`FormData\` with a zod schema, return \`{ ok: false, errors }\` or \`{ ok: true }\`.
2. Client form component (\`"use client"\`): \`const [state, action, pending] = useActionState(submit, initialState)\` and \`<form action={action}>\`.
3. Show field errors under inputs, disable the submit button while \`pending\`, toast success with \`sonner\` (add \`<Toaster />\` in the layout).
4. Never trust client input; validate again on the server. Revalidate data with \`revalidatePath\` after mutations.
5. Without a database, store submissions in memory (lib/store.ts) and say so in your summary.`,
  },
  {
    slug: "supabase",
    name: "supabase",
    description: "Add Supabase auth and Postgres to a Next.js 16 app with @supabase/ssr (cookies-based sessions).",
    content: `# Supabase in Next.js 16

1. Ask the user for NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (never hardcode), document them in .env.example.
2. install_packages: ["@supabase/supabase-js", "@supabase/ssr"].
3. \`lib/supabase/server.ts\`: \`createServerClient(url, key, { cookies: { getAll: () => cookieStore.getAll(), setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } })\` with \`const cookieStore = await cookies()\`.
4. \`lib/supabase/client.ts\`: \`createBrowserClient(url, key)\`.
5. \`proxy.ts\` refreshes the session on each request and redirects unauthenticated users from protected routes.
6. Use Row Level Security on every table; query from Server Components where possible.`,
  },
  {
    slug: "stripe-payments",
    name: "stripe-payments",
    description: "Stripe Checkout and webhooks in Next.js Route Handlers for one-off payments and subscriptions.",
    content: `# Stripe payments

1. Ask for STRIPE_SECRET_KEY / STRIPE_WEBHOOK_SECRET / price ids; document them in .env.example.
2. install_packages: ["stripe"]. Server-only client in lib/stripe.ts.
3. \`app/api/checkout/route.ts\` (POST): create a Checkout Session (\`mode: "payment" | "subscription"\`, success_url, cancel_url) and return its url; the client redirects with \`window.location.href\`.
4. \`app/api/webhooks/stripe/route.ts\`: read the raw body with \`await req.text()\`, verify with \`stripe.webhooks.constructEvent\`, handle \`checkout.session.completed\` idempotently.
5. Never trust amounts from the client — use price ids on the server.`,
  },
  {
    slug: "dashboards",
    name: "dashboards",
    description: "Data dashboards with recharts: KPI cards, area/bar charts, tables, filters and responsive layouts.",
    content: `# Dashboards

- Layout: sidebar navigation (collapsible on mobile) + top bar + content grid (\`grid gap-4 md:grid-cols-2 xl:grid-cols-4\`).
- KPI cards: label, big value, delta badge (green/red), sparkline.
- Charts with \`recharts\` in client components: \`ResponsiveContainer\` + \`AreaChart\`/\`BarChart\`, gradients via \`<defs>\`, custom Tooltip styled with Tailwind.
- Typed mock data in \`lib/data.ts\`, generated deterministically (no Math.random during render → hydration mismatch).
- Tables: sticky header, zebra rows, empty state, pagination; format numbers with \`Intl.NumberFormat\` and dates with date-fns.`,
  },
  {
    slug: "landing-pages",
    name: "landing-pages",
    description: "High-converting landing page structure, copywriting and visual design patterns for SaaS and products.",
    content: `# Landing pages that convert

Structure: sticky nav → hero (clear value prop in ≤ 8 words, sub-headline, primary + secondary CTA, product visual) → social proof → problem/solution → feature grid or bento → how it works (3 steps) → testimonials → pricing → FAQ → final CTA → footer.

Design: one accent color, 2 font weights for headings, large type scale (text-5xl→7xl hero), generous whitespace (py-24 sections), soft gradients/glows behind the hero, subtle borders (white/10 on dark), consistent radius. Use motion for staggered entrances and scroll reveals. Make CTAs specific ("Start free trial", not "Submit"). Mobile first.`,
  },
];
