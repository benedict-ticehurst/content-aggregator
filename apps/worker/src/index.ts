import { Queue, Worker, type Job } from "bullmq";
import { Redis } from "ioredis";
import { closeDb, db, sources } from "@agg/db";
import { ingestSource } from "./ingest.js";

const QUEUE_NAME = "feeds";
const INTERVAL_MINUTES = Number(process.env.FETCH_INTERVAL_MINUTES ?? 15);
const CONCURRENCY = 5;

const connection = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
  maxRetriesPerRequest: null, // required by BullMQ workers
});

type JobData = { kind: "schedule-all" } | { kind: "fetch-source"; sourceId: number };

const queue = new Queue<JobData>(QUEUE_NAME, {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 30_000 },
    removeOnComplete: 500,
    removeOnFail: 1000,
  },
});

async function scheduleAll() {
  const all = await db.select({ id: sources.id }).from(sources);
  const bucket = Math.floor(Date.now() / (INTERVAL_MINUTES * 60_000));
  await queue.addBulk(
    all.map((s) => ({
      name: "fetch-source",
      data: { kind: "fetch-source" as const, sourceId: s.id },
      // Same id within one interval = BullMQ ignores the duplicate.
      opts: { jobId: `fetch-${s.id}-${bucket}` },
    })),
  );
  return { enqueued: all.length };
}

const worker = new Worker<JobData>(
  QUEUE_NAME,
  async (job: Job<JobData>) => {
    if (job.data.kind === "schedule-all") return scheduleAll();
    return ingestSource(job.data.sourceId);
  },
  { connection, concurrency: CONCURRENCY },
);

worker.on("completed", (job, result) => {
  if (job.data.kind === "fetch-source") {
    const r = result as Awaited<ReturnType<typeof ingestSource>>;
    console.log(`[source ${r.sourceId}] ${r.status}, +${r.inserted} new, ${r.skipped} skipped`);
  } else {
    console.log(`Scheduled ${(result as { enqueued: number }).enqueued} source(s)`);
  }
});

worker.on("failed", (job, err) => {
  const attempt = `${job?.attemptsMade ?? "?"}/${job?.opts.attempts ?? "?"}`;
  console.error(`[job ${job?.id}] failed (attempt ${attempt}): ${err.message}`);
});

// Run every INTERVAL_MINUTES, and once immediately on startup.
await queue.upsertJobScheduler(
  "schedule-all",
  { every: INTERVAL_MINUTES * 60_000, immediately: true },
  { name: "schedule-all", data: { kind: "schedule-all" } },
);

console.log(`Worker running: checking all sources every ${INTERVAL_MINUTES} min`);

let shuttingDown = false;
async function shutdown() {
  // Package managers can forward more than one signal; only close once.
  if (shuttingDown) return;
  shuttingDown = true;
  console.log("Shutting down…");
  try {
    await worker.close();
    await queue.close();
    await connection.quit();
    await closeDb();
  } catch (err) {
    console.error("Error during shutdown:", err);
  }
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);