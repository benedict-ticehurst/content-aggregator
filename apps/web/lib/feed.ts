import { db, desc, eq, items, sources, sql } from "@agg/db";

export interface FeedItem {
  id: number;
  title: string;
  url: string;
  summary: string | null;
  author: string | null;
  publishedAt: Date;
  sourceId: number;
  sourceName: string;
}

export interface FeedCursor {
  publishedAt: Date;
  id: number;
}

export async function getFeed(limit = 50, cursor?: FeedCursor) {
  const rows = await db
    .select({
      id: items.id,
      title: items.title,
      url: items.url,
      summary: items.summary,
      author: items.author,
      publishedAt: items.publishedAt,
      sourceId: sources.id,
      sourceName: sources.name,
    })
    .from(items)
    .innerJoin(sources, eq(items.sourceId, sources.id))
    .where(
      cursor
        ? sql`(${items.publishedAt}, ${items.id}) < (${cursor.publishedAt.toISOString()}, ${cursor.id})`
        : undefined,
    )
    .orderBy(desc(items.publishedAt), desc(items.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page.at(-1);
  return {
    items: page as FeedItem[],
    nextCursor: hasMore && last ? { publishedAt: last.publishedAt, id: last.id } : null,
  };
}

export async function getSourceHealth() {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      failing: sql<number>`count(*) filter (where ${sources.consecutiveFailures} > 0)::int`,
    })
    .from(sources);
  return row ?? { total: 0, failing: 0 };
}