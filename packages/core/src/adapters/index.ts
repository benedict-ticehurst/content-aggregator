import { RssAdapter } from "./rss.js";
import type { SourceAdapter, SourceType } from "../types.js";

const adapters: Record<SourceType, SourceAdapter> = {
  rss: new RssAdapter(),
};

export function getAdapter(type: string): SourceAdapter {
  const adapter = adapters[type as SourceType];
  if (!adapter) throw new Error(`No adapter registered for source type "${type}"`);
  return adapter;
}

export { RssAdapter, parseFeed } from "./rss.js";