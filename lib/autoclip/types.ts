export type JobStatus =
  | "queued"
  | "downloading"
  | "extracting_audio"
  | "transcribing"
  | "analyzing"
  | "scoring"
  | "clipping"
  | "completed"
  | "failed";

export type JobArtifactPaths = {
  jobDir: string;
  sourceVideo?: string;
  audio?: string;
  transcript?: string;
  segments?: string;
  result?: string;
};

export type TranscriptChunk = {
  start: number;
  end: number;
  text: string;
};

export type TranscriptResult = {
  text: string;
  chunks: TranscriptChunk[];
  source: "gemini" | "local" | "fallback";
  language?: string;
  summary: string;
};

export type CandidateSegment = {
  start: number;
  end: number;
  text: string;
  reason: string;
  keywords: string[];
};

export type ScoreBreakdown = {
  emotion: number;
  keyword: number;
  curiosity: number;
  total: number;
};

export type ScoredSegment = CandidateSegment & {
  score: ScoreBreakdown;
  rank: number;
};

export type ClipCaption = {
  hook: string;
  caption: string;
  hashtags: string[];
  subtitleText: string;
};

export type GeneratedClip = {
  id: string;
  filePath: string;
  relativePath: string;
  start: number;
  end: number;
  duration: number;
  transcriptText: string;
  score: ScoreBreakdown;
  caption: ClipCaption;
};

export type PipelineWarning = {
  step: string;
  message: string;
};

export type CliporaProjectContext = {
  projectName?: string;
  workspaceName?: string;
  objective?: "sales" | "awareness" | "education" | "testimonial" | "live_recap" | "branding";
  targetChannels?: string[];
  tone?: "warm" | "premium" | "friendly" | "persuasive" | "educational";
  cta?: string;
  brandPreset?: string;
};

export type JobSummary = {
  transcriptSource: TranscriptResult["source"];
  analysisSource: "gemini" | "local" | "fallback";
  candidateCount: number;
  selectedClipCount: number;
  topScore: number | null;
  processingTarget: "local-mvp";
};

export type NextStepMetadata = {
  readyForUpload: boolean;
  recommendedPlatforms: string[];
  analyticsFields: string[];
};

export type ProcessVideoResult = {
  success: true;
  job: {
    id: string;
    status: JobStatus;
    url: string;
    createdAt: string;
    updatedAt: string;
  };
  summary: JobSummary;
  transcript: TranscriptResult;
  segments: ScoredSegment[];
  clips: GeneratedClip[];
  nextSteps: NextStepMetadata;
  warnings: PipelineWarning[];
};

export type ErrorResponse = {
  success: false;
  error: {
    code: string;
    message: string;
    details?: string[];
  };
};

export type ProcessVideoResponse = ProcessVideoResult | ErrorResponse;

export type JobRecord = {
  id: string;
  url: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  cliporaContext?: CliporaProjectContext;
  warnings: PipelineWarning[];
  artifacts: JobArtifactPaths;
  result?: ProcessVideoResult;
  error?: ErrorResponse["error"];
};
