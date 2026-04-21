import { toErrorResponse } from "@/lib/autoclip/errors";
import { createGenerationJob } from "@/lib/autoclip/generation/job-store";
import { enqueueJob } from "@/lib/autoclip/generation/queue";
import { GenerateVideoInput, CreateJobResponse } from "@/lib/autoclip/generation/types";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as GenerateVideoInput;

    const topic = body.topic?.trim();
    if (!topic) {
      return Response.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Topic is required." } },
        { status: 400 }
      );
    }
    if (topic.length > 200) {
      return Response.json(
        {
          success: false,
          error: { code: "INVALID_INPUT", message: "Topic must be under 200 characters." },
        },
        { status: 400 }
      );
    }

    // Create job record in file store
    const job = await createGenerationJob(body);

    // Enqueue — returns immediately, processing happens in background
    enqueueJob(job.id);

    const response: CreateJobResponse = {
      success: true,
      jobId: job.id,
      status: job.status,
      message: "Job created. Poll /api/generation-jobs/{jobId} for status.",
    };

    return Response.json(response, { status: 202 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}
