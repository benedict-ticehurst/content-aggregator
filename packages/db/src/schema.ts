import { index, integer, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const sources = pgTable("sources", {
  id: serial("id").primaryKey(),
  type: text("type").notNull().default("rss"),
  name: text("name").notNull(),
  url: text("url").notNull().unique(),

  // Conditional GET state, so unchanged feeds cost almost nothing to check.
  etag: text("etag"),
  lastModified: text("last_modified"),

  // Health tracking: surface broken feeds instead of failing silently.
  lastFetchedAt: timestamp("last_fetched_at", { withTimezone: true }),
  lastError: text("last_error"),
  consecutiveFailures: integer("consecutive_failures").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const items = pgTable(
  "items",
  {
    id: serial("id").primaryKey(),
    sourceId: integer("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    url: text("url").notNull().unique(), // canonical URL: first line of dedup
    summary: text("summary"),
    author: text("author"),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("items_published_at_idx").on(t.publishedAt),
    index("items_source_id_idx").on(t.sourceId),
  ],
);

export type Source = typeof sources.$inferSelect;
export type Item = typeof items.$inferSelect;