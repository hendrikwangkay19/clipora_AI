/**
 * In-process job queue for video generation.
 *
 * Design:
 * - Processes ONE job at a time (prevents FFmpeg/API overload)
 * - Module-level state persists across requests in same process
 * - Non-blocking: enqueue() returns immediately, processing runs in background
 * - On server restart: pending jobs in file store are NOT auto-resumed
 *   (call resumePendingJobs() at startup, or via cron)
 *
 * Phase 3 upgrade path: replace with BullMQ + Redis without changing call sites.
 */
import { generateVideo } from "./pipeline";
import {
  getGenerationJob,
  listPendingJobs,
  markJobCompleted,
  markJobFailed,
  markJobPipelineStep,
  markJobProcessing,
} from "./job-store";
import { GenerateVideoInput } from "./types";

// ─── Queue State (module-level singleton) ─────────────────────────────────────

let isProcessing = false;
const queue: string[] = []; // array of jobIds

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Add a job to the queue and start processing if idle.
 * Returns immediately — does NOT wait for the job to finish.
 */
export function enqueueJob(jobId: string): void {
  queue.push(jobId);
  void drainQueue();
}

/**
 * Returns current queue snapshot for monitoring.
 */
export function getQueueState() {
  return {
    isProcessing,
    queueLength: queue.length,
    pendingJobIds: [...queue],
  };
}

/**
 * Load all pending jobs from disk and re-enqueue them.
 * Call this once when the server starts to recover from restarts.
 */
export async function resumePendingJobs(): Promise<number> {
  const pending = await listPendingJobs();
  for (const job of pending) {
    if (!queue.includes(job.id)) {
      queue.push(job.id);
    }
  }
  if (queue.length > 0) {
    void drainQueue();
  }
  return pending.length;
}

// ─── Internal Queue Drain ─────────────────────────────────────────────────────

async function drainQueue(): Promise<void> {
  if (isProcessing) return;
  if (queue.length === 0) return;

  isProcessing = true;

  while (queue.length > 0) {
    const jobId = queue.shift()!;
    await runJob(jobId);
  }

  isProcessing = false;
}

async function runJob(jobId: string): Promise<void> {
  let job;
  try {
    job = await getGenerationJob(jobId);
  } catch {
    // Job file gone — skip silently
    return;
  }

  // Skip if already processed (e.g. duplicate enqueue)
  if (job.status === "completed" || job.status === "failed") return;

  await markJobProcessing(jobId);

  try {
    const input: GenerateVideoInput = {
      topic: job.topic,
      style: job.style,
      language: job.language,
      durationSeconds: job.durationSeconds,
      voice: job.voice,
    };

    const result = await generateVideo(input, async (status) => {
      await markJobPipelineStep(jobId, status);
    });

    await markJobCompleted(jobId, result.videoUrl, result.script, result.durationSeconds);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await markJobFailed(jobId, message);
  }
}
