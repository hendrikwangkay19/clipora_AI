/**
 * Cron-ready endpoint to resume pending jobs.
 *
 * Call this:
 * - On server startup
 * - Via Windows Task Scheduler / cron to auto-process scheduled jobs
 * - Manually at /api/generation-jobs/process
 *
 * Example cron (Linux/Mac):
 *   0 6 * * * curl -X POST http://localhost:3000/api/generation-jobs/process
 *
 * Example Task Scheduler (Windows): trigger at 6:00 AM daily
 *   Action: curl -X POST http://localhost:3000/api/generation-jobs/process
 */
import { toErrorResponse } from "@/lib/autoclip/errors";
import { resumePendingJobs } from "@/lib/autoclip/generation/queue";

export const runtime = "nodejs";

// POST /api/generation-jobs/process — re-enqueue all pending jobs
export async function POST() {
  try {
    const count = await resumePendingJobs();
    return Response.json({
      success: true,
      message: `Enqueued ${count} pending job(s).`,
      count,
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}

// GET — same thing, useful for browser testing
export async function GET() {
  return POST();
}
