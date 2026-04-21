import { toErrorResponse } from "@/lib/autoclip/errors";
import { createGenerationJob } from "@/lib/autoclip/generation/job-store";
import { enqueueJob, getQueueState } from "@/lib/autoclip/generation/queue";
import {
  listGenerationJobs,
} from "@/lib/autoclip/generation/job-store";
import {
  BatchGenerateInput,
  BatchCreateJobResponse,
} from "@/lib/autoclip/generation/types";

export const runtime = "nodejs";

// GET /api/generation-jobs — list all jobs + queue state
export async function GET() {
  try {
    const jobs = await listGenerationJobs();
    const queue = getQueueState();

    return Response.json({
      success: true,
      jobs,
      queue,
      total: jobs.length,
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}

// POST /api/generation-jobs — batch create jobs
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as BatchGenerateInput;

    if (!Array.isArray(body.topics) || body.topics.length === 0) {
      return Response.json(
        {
          success: false,
          error: { code: "INVALID_INPUT", message: "topics array is required and must not be empty." },
        },
        { status: 400 }
      );
    }

    if (body.topics.length > 20) {
      return Response.json(
        {
          success: false,
          error: { code: "INVALID_INPUT", message: "Maximum 20 topics per batch." },
        },
        { status: 400 }
      );
    }

    const validTopics = body.topics
      .map((t) => t?.trim())
      .filter((t): t is string => typeof t === "string" && t.length > 0 && t.length <= 200);

    if (validTopics.length === 0) {
      return Response.json(
        { success: false, error: { code: "INVALID_INPUT", message: "No valid topics provided." } },
        { status: 400 }
      );
    }

    const created = [];
    for (const topic of validTopics) {
      const job = await createGenerationJob({
        topic,
        style: body.style,
        language: body.language,
        durationSeconds: body.durationSeconds,
        voice: body.voice,
      });
      enqueueJob(job.id);
      created.push({ jobId: job.id, topic: job.topic, status: job.status });
    }

    const response: BatchCreateJobResponse = {
      success: true,
      jobs: created,
      total: created.length,
    };

    return Response.json(response, { status: 202 });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}
