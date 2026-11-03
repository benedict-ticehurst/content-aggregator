import { getAdapter } from "@agg/core";
import { db, eq, items, sources, sql } from "@agg/db";

export interface IngestResult {
  sourceId: number;
  status: "ok" | "not-modified";
  inserted: number;
  skipped: number;
}

export async function ingestSource(sourceId: number): Promise<IngestResult> {
  const source = await db.query.sources.findFirst({ where: eq(sources.id, sourceId) });
  if (!source) throw new Error(`Source ${sourceId} no longer exists`);

  try {
    const adapter = getAdapter(source.type);
    const result = await adapter.fetch(source);

    if (result.status === "not-modified") {
      await markSuccess(sourceId, {});
      return { sourceId, status: "not-modified", inserted: 0, skipped: 0 };
    }

    let inserted = 0;
    if (result.items.length > 0) {
      const rows = await db
        .insert(items)
        .values(result.items.map((item) => ({ ...item, sourceId })))
        // A URL we've already stored (from any source) is a duplicate.
        .onConflictDoNothing({ target: items.url })
        .returning({ id: items.id });
      inserted = rows.length;
    }

    await markSuccess(sourceId, { etag: result.etag, lastModified: result.lastModified });
    return { sourceId, status: "ok", inserted, skipped: result.skipped };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db
      .update(sources)
      .set({
        lastError: message,
        lastFetchedAt: new Date(),
        consecutiveFailures: sql`${sources.consecutiveFailures} + 1`,
      })
      .where(eq(sources.id, sourceId));
    throw err; // Rethrow so BullMQ applies its retry + backoff policy.
  }
}

async function markSuccess(sourceId: number, cache: { etag?: string; lastModified?: string }) {
  await db
    .update(sources)
    .set({
      lastFetchedAt: new Date(),
      lastError: null,
      consecutiveFailures: 0,
      // Only overwrite cache headers when the server sent new ones.
      ...(cache.etag !== undefined && { etag: cache.etag }),
      ...(cache.lastModified !== undefined && { lastModified: cache.lastModified }),
    })
    .where(eq(sources.id, sourceId));
}