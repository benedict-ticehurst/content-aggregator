import { getFeed, getSourceHealth, type FeedItem } from "@/lib/feed";

export const dynamic = "force-dynamic";

const relative = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

function timeAgo(date: Date): string {
  const minutes = Math.round((date.getTime() - Date.now()) / 60_000);
  if (Math.abs(minutes) < 60) return relative.format(minutes, "minute");
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return relative.format(hours, "hour");
  return relative.format(Math.round(hours / 24), "day");
}

function dayLabel(date: Date): string {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return dayFormat.format(date);
}

function groupByDay(items: FeedItem[]) {
  const groups = new Map<string, FeedItem[]>();
  for (const item of items) {
    const label = dayLabel(item.publishedAt);
    groups.set(label, [...(groups.get(label) ?? []), item]);
  }
  return [...groups.entries()];
}

/** A stable hue per source, so each one keeps the same colour mark. */
function sourceHue(id: number) {
  return (id * 137.508) % 360; // the golden angle spreads hues evenly
}

export default async function Home() {
  const [{ items }, health] = await Promise.all([getFeed(60), getSourceHealth()]);

  return (
    <main className="page">
      <header className="masthead">
        <h1>Aggregator</h1>
        <p className="status">
          Following {health.total} {health.total === 1 ? "source" : "sources"}.
          {health.failing > 0 && (
            <span className="warning"> {health.failing} couldn’t be reached on the last check.</span>
          )}
        </p>
      </header>

      {items.length === 0 ? (
        <section className="empty">
          <h2>No posts yet</h2>
          <p>
            Add sources with <code>pnpm db:seed</code>, then start the worker with{" "}
            <code>pnpm dev:worker</code>. New posts appear here after the first fetch.
          </p>
        </section>
      ) : (
        groupByDay(items).map(([label, dayItems]) => (
          <section key={label} className="day" aria-labelledby={`day-${label}`}>
            <h2 id={`day-${label}`} className="day-label">{label}</h2>
            <ol className="items">
              {dayItems.map((item) => (
                <li key={item.id} className="item">
                  <a href={item.url} className="item-title" target="_blank" rel="noopener noreferrer">
                    {item.title}
                  </a>
                  <p className="item-meta">
                    <span
                      className="source-mark"
                      style={{ "--hue": sourceHue(item.sourceId) } as React.CSSProperties}
                      aria-hidden="true"
                    />
                    <span className="source-name">{item.sourceName}</span>
                    <time dateTime={item.publishedAt.toISOString()}>{timeAgo(item.publishedAt)}</time>
                  </p>
                  {item.summary && <p className="item-summary">{item.summary}</p>}
                </li>
              ))}
            </ol>
          </section>
        ))
      )}
    </main>
  );
}