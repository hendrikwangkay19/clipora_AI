/**
 * File-based job store for generation jobs.
 * Stores metadata in .autoclip/generation-jobs/{jobId}/job.json
 * Videos are served from public/generated/{jobId}/output.mp4
 *
 * Designed to be replaced by Supabase/PostgreSQL in Phase 3
 * without changing the call sites — just swap this module.
 */
import fs from "fs/promises";
import path from "path";
import { ensureDir, readJsonFile, writeJsonFile } from "@/lib/autoclip/storage/filesystem";
import {
  GenerationJob,
  GenerateVideoStatus,
  GeneratedScript,
  GenerateVideoInput,
  VideoStyle,
  VideoLanguage,
  VideoDuration,
  TtsVoice,
} from "./types";

const JOBS_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  ".autoclip",
  "generation-jobs"
);

function jobFilePath(jobId: string) {
  return path.join(JOBS_DIR, jobId, "job.json");
}

// ─── Write ────────────────────────────────────────────────────────────────────

export async function createGenerationJob(input: GenerateVideoInput): Promise<GenerationJob> {
  await ensureDir(JOBS_DIR);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  const job: GenerationJob = {
    id,
    topic: input.topic.trim(),
    style: (input.style ?? "informative") as VideoStyle,
    language: (input.language ?? "id") as VideoLanguage,
    durationSeconds: (input.durationSeconds ?? 60) as VideoDuration,
    voice: (input.voice ?? "nova") as TtsVoice,
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  await ensureDir(path.dirname(jobFilePath(id)));
  await writeJsonFile(jobFilePath(id), job);
  return job;
}

export async function updateGenerationJob(
  jobId: string,
  patch: Partial<
    Pick<
      GenerationJob,
      | "status"
      | "pipelineStatus"
      | "videoUrl"
      | "script"
      | "error"
      | "startedAt"
      | "completedAt"
    >
  >
): Promise<GenerationJob> {
  const current = await getGenerationJob(jobId);
  const updated: GenerationJob = {
    ...current,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonFile(jobFilePath(jobId), updated);
  return updated;
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export async function getGenerationJob(jobId: string): Promise<GenerationJob> {
  try {
    return await readJsonFile<GenerationJob>(jobFilePath(jobId));
  } catch {
    throw new Error(`Generation job ${jobId} not found.`);
  }
}

export async function listGenerationJobs(): Promise<GenerationJob[]> {
  try {
    const entries = await fs.readdir(JOBS_DIR, { withFileTypes: true });
    const jobs: GenerationJob[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        const job = await readJsonFile<GenerationJob>(
          path.join(JOBS_DIR, entry.name, "job.json")
        );
        jobs.push(job);
      } catch {
        // Skip corrupted job files
      }
    }

    // Newest first
    return jobs.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function listPendingJobs(): Promise<GenerationJob[]> {
  const all = await listGenerationJobs();
  return all.filter((j) => j.status === "pending");
}

// ─── Convenience status helpers ───────────────────────────────────────────────

export async function markJobProcessing(jobId: string) {
  return updateGenerationJob(jobId, {
    status: "processing",
    startedAt: new Date().toISOString(),
  });
}

export async function markJobPipelineStep(jobId: string, step: GenerateVideoStatus) {
  return updateGenerationJob(jobId, { pipelineStatus: step });
}

export async function markJobCompleted(
  jobId: string,
  videoUrl: string,
  script: GeneratedScript,
  durationSeconds: number
) {
  void durationSeconds;

  return updateGenerationJob(jobId, {
    status: "completed",
    pipelineStatus: "completed",
    videoUrl,
    script,
    completedAt: new Date().toISOString(),
  });
}

export async function markJobFailed(jobId: string, errorMessage: string) {
  return updateGenerationJob(jobId, {
    status: "failed",
    pipelineStatus: "failed",
    error: errorMessage,
    completedAt: new Date().toISOString(),
  });
}
