import { JobStatus } from "@/lib/autoclip/types";

export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  queued: "Queued",
  downloading: "Downloading source video",
  extracting_audio: "Extracting audio",
  transcribing: "Transcribing audio",
  analyzing: "Analyzing transcript",
  scoring: "Ranking viral candidates",
  clipping: "Generating clips",
  completed: "Completed",
  failed: "Failed",
};
