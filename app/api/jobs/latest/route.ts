import { toErrorResponse } from "@/lib/autoclip/errors";
import { listJobs } from "@/lib/autoclip/jobs/store";

export const runtime = "nodejs";

export async function GET() {
  try {
    const jobs = await listJobs();
    const latest = jobs.find(
      (job) =>
        job.status === "completed" &&
        job.result &&
        Array.isArray(job.result.clips) &&
        job.result.clips.length > 0
    );

    if (!latest) {
      return Response.json(
        { success: false, error: { code: "NOT_FOUND", message: "Belum ada job selesai." } },
        { status: 404 }
      );
    }

    return Response.json({
      success: true,
      job: latest,
      result: latest.result,
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}
