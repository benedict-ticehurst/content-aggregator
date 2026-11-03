import { readFile } from "node:fs/promises";
import { describe, expect, it, vi } from "vitest";
import { RssAdapter, parseFeed } from "../src/adapters/rss.js";

const fixture = (name: string) => readFile(new URL(`./fixtures/${name}`, import.meta.url), "utf8");

describe("parseFeed", () => {
  it("normalizes RSS items and skips invalid entries", async () => {
    const { items, skipped } = await parseFeed(await fixture("sample-rss.xml"));
    expect(items).toHaveLength(2);
    expect(skipped).toBe(2); // empty title + missing link

    const [first] = items;
    expect(first).toMatchObject({
      title: "Shipping a job queue in a weekend",
      url: "https://example.com/posts/job-queue",
      author: "Ada Example",
    });
    expect(first?.publishedAt.toISOString()).toBe("2026-10-26T09:30:00.000Z");
    expect(first?.summary).toBe("We needed retries, backoff and visibility into failures.");
  });

  it("handles Atom feeds", async () => {
    const { items } = await parseFeed(await fixture("sample-atom.xml"));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      title: "Writing adapters that don't break",
      url: "https://atom.example.org/2026/adapters",
      summary: "Validate everything at the boundary.",
    });
  });
});

describe("RssAdapter", () => {
  it("sends conditional headers and handles 304 Not Modified", async () => {
    const fetchMock = vi.fn(async () => new Response(null, { status: 304 }));
    const adapter = new RssAdapter(fetchMock as unknown as typeof fetch);

    const result = await adapter.fetch({
      url: "https://example.com/feed.xml",
      etag: '"abc123"',
      lastModified: "Mon, 26 Oct 2026 09:30:00 GMT",
    });

    expect(result).toEqual({ status: "not-modified" });
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers["If-None-Match"]).toBe('"abc123"');
    expect(headers["If-Modified-Since"]).toBe("Mon, 26 Oct 2026 09:30:00 GMT");
  });

  it("returns items plus caching headers on 200", async () => {
    const xml = await fixture("sample-rss.xml");
    const fetchMock = vi.fn(async () => new Response(xml, { status: 200, headers: { etag: '"v2"' } }));
    const adapter = new RssAdapter(fetchMock as unknown as typeof fetch);

    const result = await adapter.fetch({ url: "https://example.com/feed.xml" });
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.items).toHaveLength(2);
      expect(result.etag).toBe('"v2"');
    }
  });

  it("throws on HTTP errors so the job queue can retry", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 503 }));
    const adapter = new RssAdapter(fetchMock as unknown as typeof fetch);
    await expect(adapter.fetch({ url: "https://example.com/feed.xml" })).rejects.toThrow("HTTP 503");
  });
});