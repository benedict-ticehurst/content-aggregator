import { closeDb, db } from "./client.js";
import { sources } from "./schema.js";

const starterFeeds = [
  { name: "Hacker News", url: "https://hnrss.org/frontpage" },
  { name: "The GitHub Blog", url: "https://github.blog/feed/" },
  { name: "Cloudflare Blog", url: "https://blog.cloudflare.com/rss/" },
  { name: "Smashing Magazine", url: "https://www.smashingmagazine.com/feed/" },
];

const inserted = await db
  .insert(sources)
  .values(starterFeeds.map((f) => ({ ...f, type: "rss" })))
  .onConflictDoNothing({ target: sources.url })
  .returning({ id: sources.id });

console.log(`Seeded ${inserted.length} new source(s).`);
await closeDb();