import path from "path";
import fs from "fs/promises";
import { appConfig } from "@/lib/autoclip/config";
import { AppError } from "@/lib/autoclip/errors";
import {
  ensureDir,
  getArtifactsDir,
  getJobDir,
  readJsonFile,
  writeJsonFile,
} from "@/lib/autoclip/storage/filesystem";
import {
  JobArtifactPaths,
  JobRecord,
  JobStatus,
  CliporaProjectContext,
  PipelineWarning,
  ProcessVideoResult,
} from "@/lib/autoclip/types";

const JOB_FILE = "job.json";
const RESULT_FILE = "result.json";

function getJobFile(jobId: string) {
  return path.join(getJobDir(jobId), JOB_FILE);
}

function getResultFile(jobId: string) {
  return path.join(getJobDir(jobId), RESULT_FILE);
}

export async function createJob(
  url: string,
  cliporaContext?: CliporaProjectContext
): Promise<JobRecord> {
  await ensureDir(appConfig.jobsDir);

  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const jobDir = getJobDir(id);
  const artifactsDir = getArtifactsDir(id);

  await ensureDir(jobDir);
  await ensureDir(artifactsDir);

  const record: JobRecord = {
    id,
    url,
    status: "queued",
    createdAt: now,
    updatedAt: now,
    cliporaContext,
    warnings: [],
    artifacts: {
      jobDir,
    },
  };

  await writeJsonFile(getJobFile(id), record);
  return record;
}

export async function readJob(jobId: string) {
  try {
    return await readJsonFile<JobRecord>(getJobFile(jobId));
  } catch {
    throw new AppError(`Job ${jobId} was not found.`, "JOB_NOT_FOUND", 404);
  }
}

export async function listJobs(): Promise<JobRecord[]> {
  try {
    const entries = await fs.readdir(appConfig.jobsDir, { withFileTypes: true });
    const jobs: JobRecord[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      try {
        jobs.push(await readJsonFile<JobRecord>(getJobFile(entry.name)));
      } catch {
        // Skip incomplete or corrupted job folders.
      }
    }

    return jobs.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function updateJob(
  jobId: string,
  patch: Partial<Omit<JobRecord, "artifacts">> & { artifacts?: Partial<JobArtifactPaths> }
) {
  const current = await readJob(jobId);
  const next: JobRecord = {
    ...current,
    ...patch,
    artifacts: {
      ...current.artifacts,
      ...patch.artifacts,
    },
    warnings: patch.warnings ?? current.warnings,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(getJobFile(jobId), next);
  return next;
}

export async function updateJobStatus(jobId: string, status: JobStatus) {
  return updateJob(jobId, { status });
}

export async function appendJobWarning(jobId: string, warning: PipelineWarning) {
  const current = await readJob(jobId);
  const warnings = [...current.warnings, warning];
  return updateJob(jobId, { warnings });
}

export async function completeJob(jobId: string, result: ProcessVideoResult) {
  await writeJsonFile(getResultFile(jobId), result);
  return updateJob(jobId, { status: "completed", result });
}

export async function failJob(jobId: string, error: JobRecord["error"]) {
  return updateJob(jobId, { status: "failed", error });
}
