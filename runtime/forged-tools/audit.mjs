// Usage: node audit.mjs /path  → prints one JSON line with scores and issues (performance, accessibility, SEO, best practices).
import fs from "node:fs";
import { createRequire } from "node:module";
import { connect } from "./browser-lib.mjs";

const path = process.argv[2]?.startsWith("/") ? process.argv[2] : "/";
const require = createRequire(import.meta.url);
const axeSource = fs.readFileSync(require.resolve("axe-core/axe.min.js"), "utf8");
const { browser, page } = await connect();
const consoleErrors = [];
page.on("console", (m) => m.type() === "error" && consoleErrors.push(m.text().slice(0, 200)));
page.on("pageerror", (e) => consoleErrors.push(String(e.message).slice(0, 200)));

const issues = [];
const add = (category, severity, message) => issues.push({ category, severity, message });

try {
  const started = Date.now();
  const res = await page.goto(`http://localhost:3000${path}`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(1200);
  const loadMs = Date.now() - started;
  const metrics = await page.evaluate(() => {
    const nav = performance.getEntriesByType("navigation")[0];
    const res = performance.getEntriesByType("resource");
    let lcp = 0;
    let cls = 0;
    try {
      for (const e of performance.getEntriesByType("largest-contentful-paint")) lcp = Math.max(lcp, e.startTime);
    } catch {}
    try {
      for (const e of performance.getEntriesByType("layout-shift")) if (!e.hadRecentInput) cls += e.value;
    } catch {}
    const imgs = [...document.images];
    const meta = (n) => document.querySelector(`meta[name="${n}"], meta[property="${n}"]`)?.getAttribute("content") ?? "";
    return {
      ttfb: nav ? nav.responseStart - nav.requestStart : 0,
      dcl: nav ? nav.domContentLoadedEventEnd : 0,
      lcp,
      cls,
      requests: res.length,
      bytes: res.reduce((s, r) => s + (r.transferSize || r.encodedBodySize || 0), 0),
      title: document.title,
      description: meta("description"),
      ogTitle: meta("og:title"),
      ogImage: meta("og:image"),
      lang: document.documentElement.lang,
      viewport: Boolean(document.querySelector('meta[name="viewport"]')),
      h1: document.querySelectorAll("h1").length,
      imgsNoAlt: imgs.filter((i) => !i.hasAttribute("alt")).length,
      imgsBig: imgs.filter((i) => i.naturalWidth > 2400).length,
      links: [...document.querySelectorAll("a")].filter((a) => !a.textContent.trim() && !a.getAttribute("aria-label")).length,
      canonical: Boolean(document.querySelector('link[rel="canonical"]')),
    };
  });
  await page.addScriptTag({ content: axeSource });
  const axe = await page.evaluate(async () => {
    const r = await window.axe.run(document, { resultTypes: ["violations"] });
    return r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.length }));
  });

  // Performance
  let perf = 100;
  if (metrics.lcp > 2500) (perf -= metrics.lcp > 4000 ? 35 : 18), add("performance", "warn", `Largest contentful paint is ${(metrics.lcp / 1000).toFixed(1)}s (aim for < 2.5s).`);
  if (metrics.cls > 0.1) (perf -= 15), add("performance", "warn", `Layout shift score is ${metrics.cls.toFixed(2)} (aim for < 0.1). Reserve space for images and fonts.`);
  if (metrics.bytes > 2_500_000) (perf -= 15), add("performance", "warn", `The page downloads ${(metrics.bytes / 1e6).toFixed(1)} MB. Compress images and lazy-load below-the-fold media.`);
  if (metrics.imgsBig) (perf -= 8), add("performance", "info", `${metrics.imgsBig} image(s) are wider than 2400px. Use next/image with proper sizes.`);
  // Accessibility
  let a11y = 100;
  for (const v of axe) {
    const w = v.impact === "critical" ? 15 : v.impact === "serious" ? 10 : v.impact === "moderate" ? 5 : 2;
    a11y -= w;
    add("accessibility", v.impact === "critical" || v.impact === "serious" ? "error" : "warn", `${v.help} (${v.nodes} element${v.nodes > 1 ? "s" : ""}, rule ${v.id})`);
  }
  // SEO
  let seo = 100;
  if (!metrics.title) (seo -= 20), add("seo", "error", "Missing <title>.");
  else if (metrics.title.length > 65) (seo -= 5), add("seo", "info", `Title is ${metrics.title.length} characters (keep under ~60).`);
  if (!metrics.description) (seo -= 15), add("seo", "warn", "Missing meta description.");
  if (metrics.h1 !== 1) (seo -= 10), add("seo", "warn", `Found ${metrics.h1} <h1> elements (use exactly one).`);
  if (!metrics.lang) (seo -= 10), add("seo", "warn", "<html> has no lang attribute.");
  if (!metrics.viewport) (seo -= 15), add("seo", "error", "Missing viewport meta tag.");
  if (!metrics.ogTitle || !metrics.ogImage) (seo -= 8), add("seo", "info", "Add Open Graph title and image for nicer link previews.");
  if (metrics.imgsNoAlt) (seo -= 6), add("seo", "warn", `${metrics.imgsNoAlt} image(s) have no alt text.`);
  if (metrics.links) (seo -= 5), add("seo", "info", `${metrics.links} link(s) have no accessible text.`);
  // Best practices
  let bp = 100;
  if (!res || res.status() >= 400) (bp -= 40), add("best_practices", "error", `The page returned HTTP ${res?.status() ?? "no response"}.`);
  if (consoleErrors.length) (bp -= Math.min(30, consoleErrors.length * 8)), add("best_practices", "warn", `Console errors: ${consoleErrors.slice(0, 3).join(" | ")}`);
  const clamp = (n) => Math.max(0, Math.min(100, Math.round(n)));
  process.stdout.write(
    JSON.stringify({
      path,
      scores: { performance: clamp(perf), accessibility: clamp(a11y), seo: clamp(seo), bestPractices: clamp(bp) },
      metrics: { ...metrics, loadMs },
      issues,
    }),
  );
} catch (err) {
  process.stdout.write(JSON.stringify({ error: String(err.message || err).slice(0, 500) }));
} finally {
  await browser.close().catch(() => {});
}
