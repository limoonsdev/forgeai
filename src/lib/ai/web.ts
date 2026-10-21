import "server-only";
import { safeFetch } from "@/lib/server/safe-fetch";

export type SearchResult = { title: string; url: string; snippet: string };

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
}

function stripTags(s: string) {
  return decodeEntities(s.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** Web search: Tavily or Brave when configured, DuckDuckGo HTML otherwise. */
export async function webSearch(query: string, max = 6): Promise<SearchResult[]> {
  if (process.env.TAVILY_API_KEY) {
    const res = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
      body: JSON.stringify({ query, max_results: max, search_depth: "basic" }),
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const data = (await res.json()) as { results: { title: string; url: string; content: string }[] };
      return data.results.map((r) => ({ title: r.title, url: r.url, snippet: r.content.slice(0, 400) }));
    }
  }
  if (process.env.BRAVE_SEARCH_API_KEY) {
    const res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${max}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": process.env.BRAVE_SEARCH_API_KEY },
      signal: AbortSignal.timeout(12_000),
    });
    if (res.ok) {
      const data = (await res.json()) as { web?: { results: { title: string; url: string; description: string }[] } };
      return (data.web?.results ?? []).slice(0, max).map((r) => ({ title: stripTags(r.title), url: r.url, snippet: stripTags(r.description) }));
    }
  }
  const res = await safeFetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, { maxBytes: 1_500_000 });
  const html = res.text();
  const out: SearchResult[] = [];
  const re = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < max) {
    let href = decodeEntities(m[1]);
    const uddg = href.match(/[?&]uddg=([^&]+)/);
    if (uddg) href = decodeURIComponent(uddg[1]);
    if (href.startsWith("//")) href = `https:${href}`;
    if (!/^https?:\/\//.test(href) || href.includes("duckduckgo.com/y.js")) continue;
    out.push({ title: stripTags(m[2]), url: href, snippet: stripTags(m[3]) });
  }
  return out;
}

/** Fetches a public page and returns readable text (title, headings, paragraphs, links). */
export async function webFetch(url: string, maxChars = 15_000) {
  const res = await safeFetch(url, { allowHttp: true, maxBytes: 3_000_000, headers: { Accept: "text/html,application/xhtml+xml,text/plain,application/json;q=0.9,*/*;q=0.5" } });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok) return { url: res.url, status: res.status, title: "", text: `HTTP ${res.status}` };
  if (/json|text\/plain|markdown/.test(type)) return { url: res.url, status: res.status, title: "", text: res.text().slice(0, maxChars) };
  if (!/html|xml/.test(type)) return { url: res.url, status: res.status, title: "", text: `Unsupported content type: ${type}` };
  let html = res.text();
  const title = stripTags(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  html = html
    .replace(/<(script|style|noscript|svg|iframe|template)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi, (_, h, t) => `\n\n${"#".repeat(Number(h[1]))} ${stripTags(t)}\n`)
    .replace(/<a[^>]+href="([^"#][^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, t) => `${stripTags(t)} (${href})`)
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|section|article|tr|br|ul|ol|header|footer|main|nav)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n");
  const text = decodeEntities(html.replace(/<[^>]+>/g, " "))
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
  return { url: res.url, status: res.status, title, text: text.slice(0, maxChars) };
}
