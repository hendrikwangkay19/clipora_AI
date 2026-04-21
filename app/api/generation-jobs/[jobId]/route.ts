import { toErrorResponse } from "@/lib/autoclip/errors";
import { getGenerationJob } from "@/lib/autoclip/generation/job-store";

export const runtime = "nodejs";

// GET /api/generation-jobs/:jobId — single job status (used for polling)
export async function GET(
  _req: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const job = await getGenerationJob(jobId);
    return Response.json({ success: true, job });
  } catch (error) {
    if (error instanceof Error && error.message.includes("not found")) {
      return Response.json(
        { success: false, error: { code: "NOT_FOUND", message: error.message } },
        { status: 404 }
      );
    }
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}
