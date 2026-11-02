import { z } from "zod";

/** Every adapter converts its source's raw data into this one shape. */
export const NormalizedItemSchema = z.object({
  title: z.string().trim().min(1).max(500),
  url: z.string().url(),
  publishedAt: z.date(),
  summary: z.string().max(500).optional(),
  author: z.string().max(200).optional(),
});

export type NormalizedItem = z.infer<typeof NormalizedItemSchema>;

export type SourceType = "rss";

/** The subset of a stored source that adapters need. */
export interface SourceInput {
  url: string;
  etag?: string | null;
  lastModified?: string | null;
}

export type FetchResult =
  | { status: "not-modified" }
  | {
      status: "ok";
      items: NormalizedItem[];
      skipped: number; // entries dropped for failing validation
      etag?: string;
      lastModified?: string;
    };

export interface SourceAdapter {
  type: SourceType;
  fetch(source: SourceInput): Promise<FetchResult>;
}