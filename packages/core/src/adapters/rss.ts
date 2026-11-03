import Parser from "rss-parser";
import { canonicalizeUrl } from "../url.js";
import {
  NormalizedItemSchema,
  type FetchResult,
  type NormalizedItem,
  type SourceAdapter,
  type SourceInput,
} from "../types.js";

const USER_AGENT = "AggregatorBot/0.1 (+https://github.com/your-username/aggregator)";
const TIMEOUT_MS = 15_000;
const SUMMARY_MAX = 300;

const parser = new Parser();

/** Collapse whitespace and cut to a readable snippet on a word boundary. */
function toSnippet(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return undefined;
  if (clean.length <= SUMMARY_MAX) return clean;
  const cut = clean.slice(0, SUMMARY_MAX);
  return cut.slice(0, cut.lastIndexOf(" ")) + "…";
}

/** Parse RSS or Atom XML into validated, normalized items. Pure, so it's easy to test. */
export async function parseFeed(xml: string): Promise<{ items: NormalizedItem[]; skipped: number }> {
  const feed = await parser.parseString(xml);
  const items: NormalizedItem[] = [];
  let skipped = 0;

  for (const entry of feed.items) {
    const dateString = entry.isoDate ?? entry.pubDate;
    let url: string | undefined;
    try {
      url = entry.link ? canonicalizeUrl(entry.link) : undefined;
    } catch {
      url = undefined;
    }

    const result = NormalizedItemSchema.safeParse({
      title: entry.title,
      url,
      publishedAt: dateString ? new Date(dateString) : new Date(),
      // contentSnippet is rss-parser's HTML-stripped version of the content.
      summary: toSnippet(entry.contentSnippet ?? entry.summary),
      author: entry.creator ?? (entry as { author?: string }).author ?? undefined,
    });

    if (result.success && !Number.isNaN(result.data.publishedAt.getTime())) {
      items.push(result.data);
    } else {
      skipped++;
    }
  }

  return { items, skipped };
}

export class RssAdapter implements SourceAdapter {
  readonly type = "rss" as const;

  /** fetch is injectable so tests can simulate any HTTP response. */
  constructor(private readonly fetchImpl: typeof fetch = fetch) {}

  async fetch(source: SourceInput): Promise<FetchResult> {
    const headers: Record<string, string> = {
      "User-Agent": USER_AGENT,
      Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
    };
    if (source.etag) headers["If-None-Match"] = source.etag;
    if (source.lastModified) headers["If-Modified-Since"] = source.lastModified;

    const res = await this.fetchImpl(source.url, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

    if (res.status === 304) return { status: "not-modified" };
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${source.url}`);

    const { items, skipped } = await parseFeed(await res.text());
    return {
      status: "ok",
      items,
      skipped,
      etag: res.headers.get("etag") ?? undefined,
      lastModified: res.headers.get("last-modified") ?? undefined,
    };
  }
}