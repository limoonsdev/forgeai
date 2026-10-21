/** Starter briefs shown in the Templates gallery. Each one starts a project with a detailed prompt. */
export type TemplateLayout = "landing" | "dashboard" | "store" | "blog" | "portfolio" | "app" | "game" | "docs";

export type Template = {
  id: string;
  name: string;
  category: "Marketing" | "Apps" | "Commerce" | "Content" | "Fun";
  layout: TemplateLayout;
  colors: [string, string, string];
  summary: string;
  prompt: string;
};

export const TEMPLATES: Template[] = [
  {
    id: "saas-landing",
    name: "SaaS landing page",
    category: "Marketing",
    layout: "landing",
    colors: ["#0f172a", "#38bdf8", "#f8fafc"],
    summary: "Hero, product screenshot, features, pricing table, FAQ and a sign-up form.",
    prompt:
      "A landing page for a SaaS called Ledgerly that reconciles invoices automatically for small accounting firms.\nSections: hero with a short headline and a product screenshot mock, three key features with icons, how it works in 3 steps, pricing with 3 tiers (monthly/yearly toggle), testimonials from 3 firms, FAQ, final call to action with an email sign-up form (server action, validation with zod, success message).\nStyle: calm and trustworthy, deep navy with a sky-blue accent, generous whitespace.",
  },
  {
    id: "restaurant",
    name: "Restaurant site",
    category: "Marketing",
    layout: "landing",
    colors: ["#1c1917", "#d97706", "#fef3c7"],
    summary: "Menu with categories, opening hours, map link and a table booking form.",
    prompt:
      "A website for Osteria Lucia, a small Italian restaurant in Bordeaux.\nPages: home (hero photo, short story, opening hours, address with a Google Maps link), menu (antipasti, primi, secondi, dolci with prices in EUR, vegetarian badges, data in a typed file), booking (form with date, time slot, party size, name, phone; validated server action; confirmation screen).\nStyle: warm and editorial, serif headings, cream background, terracotta accent. French and English toggle.",
  },
  {
    id: "analytics-dashboard",
    name: "Analytics dashboard",
    category: "Apps",
    layout: "dashboard",
    colors: ["#09090b", "#a78bfa", "#27272a"],
    summary: "KPI cards, charts, a filterable table and a date range picker.",
    prompt:
      "An analytics dashboard for an online shop.\nLayout: sidebar navigation (Overview, Orders, Customers, Products, Settings), top bar with a date range picker.\nOverview: 4 KPI cards (revenue, orders, conversion rate, average order value) with change vs previous period, a revenue line chart, a bar chart of orders by channel, a table of recent orders with status badges, sorting and search.\nUse realistic mock data generated in a typed module. Dark theme with a violet accent. Charts with recharts.",
  },
  {
    id: "habit-tracker",
    name: "Habit tracker",
    category: "Apps",
    layout: "app",
    colors: ["#052e16", "#22c55e", "#f0fdf4"],
    summary: "Daily check-ins, streaks and a yearly heatmap, saved in the browser.",
    prompt:
      "A habit tracker web app.\nFeatures: add, edit and archive habits (name, emoji, colour, target days per week); a Today view to check habits off; streak counter per habit; a GitHub-style yearly heatmap per habit; weekly summary. Data persisted in localStorage with a small typed store. Keyboard shortcuts for checking habits.\nStyle: friendly and clean, light theme with a green accent, smooth micro-animations.",
  },
  {
    id: "online-store",
    name: "Online store",
    category: "Commerce",
    layout: "store",
    colors: ["#18181b", "#f43f5e", "#fafafa"],
    summary: "Product grid with filters, product pages, cart and checkout form.",
    prompt:
      "An online store for a sneaker brand called Stride.\nPages: home (hero, featured collection, new arrivals), catalogue with filters (size, colour, price range) and sorting, product page (gallery, size picker, add to cart), cart drawer with quantity editing, checkout form (shipping address, order summary) ending on an order confirmation page. Products in a typed data file; cart in a client store persisted to localStorage.\nStyle: bold, high contrast black and white with a coral accent.",
  },
  {
    id: "portfolio",
    name: "Designer portfolio",
    category: "Content",
    layout: "portfolio",
    colors: ["#fafaf9", "#0c0a09", "#e7e5e4"],
    summary: "Project grid, case-study pages and a contact form.",
    prompt:
      "A portfolio for Inès Morel, a product designer.\nPages: home (short intro, selected work grid with hover previews), case study page template (problem, process, outcomes, images), about (bio, experience timeline, tools), contact (form with server action).\nInclude 4 case studies with realistic content in MDX-like typed data.\nStyle: minimal, lots of whitespace, large confident typography, subtle page transitions.",
  },
  {
    id: "blog",
    name: "Blog",
    category: "Content",
    layout: "blog",
    colors: ["#fffbeb", "#b45309", "#1c1917"],
    summary: "Article list with tags, reading pages, RSS feed and newsletter sign-up.",
    prompt:
      "A personal blog about slow travel.\nFeatures: home with featured post and latest articles, tag pages, article pages with reading time, table of contents and related posts, an RSS feed route, a newsletter sign-up form (server action). Articles stored as typed data with Markdown bodies rendered safely.\nStyle: warm and readable, serif body text, comfortable line length, dark mode.",
  },
  {
    id: "docs-site",
    name: "Documentation site",
    category: "Content",
    layout: "docs",
    colors: ["#0b1120", "#f59e0b", "#1e293b"],
    summary: "Sidebar navigation, search, code blocks with copy buttons.",
    prompt:
      "A documentation site for an open-source CLI tool named forge-cli.\nFeatures: left sidebar with sections (Getting started, Guides, Reference, FAQ), client-side search over page titles and headings, pages with code blocks (copy button, syntax highlighting), callouts (note/warning), previous/next links, a version badge.\nWrite 8 realistic pages. Style: technical and crisp, dark theme with an amber accent.",
  },
  {
    id: "booking-app",
    name: "Booking app",
    category: "Apps",
    layout: "app",
    colors: ["#ecfeff", "#0891b2", "#164e63"],
    summary: "Services, calendar with available slots, booking and confirmation.",
    prompt:
      "A booking app for a yoga studio.\nFlow: choose a class type (with duration and price), pick a date on a week calendar, pick an available time slot, enter name and email, confirm. Show a booking summary and an add-to-calendar (.ics) download. Admin page (simple password from an environment variable) listing bookings.\nData kept in memory on the server with a typed module for the demo. Style: soft and calm, teal accent, rounded shapes.",
  },
  {
    id: "event-page",
    name: "Event page",
    category: "Marketing",
    layout: "landing",
    colors: ["#1e1b4b", "#f472b6", "#fdf4ff"],
    summary: "Countdown, speakers, schedule, venue and ticket tiers.",
    prompt:
      "A website for FrontConf Lyon 2027, a one-day frontend conference.\nSections: hero with date, venue and a live countdown, speakers grid (photo placeholders, talk titles), schedule by time with tracks, venue with transport info, ticket tiers with an early-bird badge, sponsors, FAQ, code of conduct page.\nStyle: energetic, deep indigo with pink accents, bold display type.",
  },
  {
    id: "kanban",
    name: "Kanban board",
    category: "Apps",
    layout: "app",
    colors: ["#f8fafc", "#6366f1", "#e2e8f0"],
    summary: "Drag-and-drop columns and cards with labels and due dates.",
    prompt:
      "A Kanban board app.\nFeatures: multiple boards; columns you can add, rename and reorder; cards with title, description, labels, due date and assignee initials; drag and drop between columns (accessible keyboard moves too); filter by label; data saved in localStorage.\nStyle: clean productivity tool, light theme, indigo accent.",
  },
  {
    id: "snake",
    name: "Browser game",
    category: "Fun",
    layout: "game",
    colors: ["#022c22", "#84cc16", "#000000"],
    summary: "Snake with keyboard and touch controls and a high-score table.",
    prompt:
      "Snake, playable in the browser.\nFeatures: canvas rendering at 60 fps, keyboard (arrows/WASD) and swipe controls on mobile, speed increasing every 5 apples, pause with Space, game-over screen with score, a local high-score table (top 10 in localStorage), sound effects toggle.\nStyle: retro arcade, dark green background, lime snake, pixel font for the score.",
  },
];

export function getTemplate(id: string) {
  return TEMPLATES.find((t) => t.id === id);
}
