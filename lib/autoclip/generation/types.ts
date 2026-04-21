export type VideoStyle = "informative" | "motivational" | "educational" | "story";
export type VideoLanguage = "id" | "en";
export type TtsVoice = "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer";
export type VideoDuration = 30 | 60;

// ─── Input ────────────────────────────────────────────────────────────────────

export type GenerateVideoInput = {
  topic: string;
  style?: VideoStyle;
  language?: VideoLanguage;
  durationSeconds?: VideoDuration;
  voice?: TtsVoice;
};

export type BatchGenerateInput = {
  topics: string[];
  style?: VideoStyle;
  language?: VideoLanguage;
  durationSeconds?: VideoDuration;
  voice?: TtsVoice;
};

// ─── Script ───────────────────────────────────────────────────────────────────

export type GeneratedScript = {
  title: string;
  hook: string;
  body: string;
  cta: string;
  fullScript: string;
  keywords: string[];
};

// ─── Stock Video ──────────────────────────────────────────────────────────────

export type StockVideoInfo = {
  id: number;
  url: string;
  width: number;
  height: number;
  duration: number;
};

// ─── Pipeline Status (granular steps) ────────────────────────────────────────

export type GenerateVideoStatus =
  | "generating_script"
  | "generating_voice"
  | "fetching_stock_video"
  | "assembling_video"
  | "completed"
  | "failed";

// ─── Job (persisted) ──────────────────────────────────────────────────────────

export type GenerationJobStatus = "pending" | "processing" | "completed" | "failed";

export type GenerationJob = {
  id: string;
  topic: string;
  style: VideoStyle;
  language: VideoLanguage;
  durationSeconds: VideoDuration;
  voice: TtsVoice;
  status: GenerationJobStatus;
  pipelineStatus?: GenerateVideoStatus;
  videoUrl?: string;
  script?: GeneratedScript;
  error?: string;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
};

// ─── API Responses ────────────────────────────────────────────────────────────

export type GenerateVideoResult = {
  success: true;
  jobId: string;
  topic: string;
  style: VideoStyle;
  language: VideoLanguage;
  script: GeneratedScript;
  videoUrl: string;
  durationSeconds: number;
  createdAt: string;
};

export type GenerateVideoErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type GenerateVideoResponse = GenerateVideoResult | GenerateVideoErrorResponse;

export type CreateJobResponse = {
  success: true;
  jobId: string;
  status: GenerationJobStatus;
  message: string;
};

export type BatchCreateJobResponse = {
  success: true;
  jobs: Array<{ jobId: string; topic: string; status: GenerationJobStatus }>;
  total: number;
};
