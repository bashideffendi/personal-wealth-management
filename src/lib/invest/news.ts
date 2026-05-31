import "server-only";

/**
 * Aggregate financial news from Indonesian sources via RSS.
 * All feeds are public, no API key needed.
 *
 * Ported from kelolainvestasi (finance/invest/lib/news.ts) — self-contained,
 * zero deps beyond `server-only`.
 */

export interface NewsItem {
  source: string;
  title: string;
  link: string;
  pubDate: string;
  pubDateMs: number;
  description?: string;
}

// RSS sources — Indonesia finance / markets focused
export const SOURCES: { name: string; url: string }[] = [
  {
    name: "CNBC Indonesia Market",
    url: "https://www.cnbcindonesia.com/market/rss",
  },
  {
    name: "Detik Finance",
    url: "https://rss.detik.com/index.php/finance",
  },
  {
    name: "Bisnis.com Market",
    url: "https://market.bisnis.com/rss",
  },
  {
    name: "Kontan Investasi",
    url: "https://investasi.kontan.co.id/rss",
  },
  {
    name: "IDX Channel",
    url: "https://www.idxchannel.com/feed",
  },
];

/**
 * Extract text content from an XML element, handling CDATA and nested tags.
 */
function extractTag(xml: string, tag: string): string | undefined {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = xml.match(re);
  if (!m) return undefined;
  // Strip CDATA wrapper
  let content = m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
  // Strip basic HTML tags for description
  content = content.replace(/<[^>]+>/g, "").trim();
  return content || undefined;
}

function parseRSS(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, "title");
    const link = extractTag(itemXml, "link");
    const pubDate = extractTag(itemXml, "pubDate");
    const description = extractTag(itemXml, "description");
    if (!title || !link) continue;
    const pubDateMs = pubDate ? Date.parse(pubDate) : 0;
    items.push({
      source,
      title,
      link,
      pubDate: pubDate ?? "",
      pubDateMs: isNaN(pubDateMs) ? 0 : pubDateMs,
      description: description?.slice(0, 200),
    });
  }
  return items;
}

export async function getAllNews(): Promise<{
  items: NewsItem[];
  errors: string[];
}> {
  const settled = await Promise.allSettled(
    SOURCES.map(async (s) => {
      const res = await fetch(s.url, {
        next: { revalidate: 600 }, // 10 min cache
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`${s.name}: HTTP ${res.status}`);
      const xml = await res.text();
      return { source: s.name, items: parseRSS(xml, s.name) };
    }),
  );

  const items: NewsItem[] = [];
  const errors: string[] = [];
  for (const r of settled) {
    if (r.status === "fulfilled") {
      items.push(...r.value.items);
    } else {
      errors.push(r.reason?.message ?? "unknown");
    }
  }

  // Sort newest first, dedupe by link
  const seen = new Set<string>();
  const unique: NewsItem[] = [];
  items.sort((a, b) => b.pubDateMs - a.pubDateMs);
  for (const i of items) {
    if (seen.has(i.link)) continue;
    seen.add(i.link);
    unique.push(i);
  }
  return { items: unique.slice(0, 100), errors };
}

/**
 * Filter news by ticker mention (simple keyword match in title).
 */
export function filterByTicker(items: NewsItem[], ticker: string): NewsItem[] {
  const t = ticker.toUpperCase();
  return items.filter(
    (i) =>
      i.title.toUpperCase().includes(t) ||
      (i.description ?? "").toUpperCase().includes(t),
  );
}
