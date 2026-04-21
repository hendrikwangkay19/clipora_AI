import { toErrorResponse } from "@/lib/autoclip/errors";
import { readJob } from "@/lib/autoclip/jobs/store";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await context.params;
    const job = await readJob(jobId);

    return Response.json({
      success: true,
      job,
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}
