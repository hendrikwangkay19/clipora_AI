import {
  GeneratedClip,
  PipelineWarning,
  ProcessVideoResult,
  ScoredSegment,
  TranscriptResult,
} from "@/lib/autoclip/types";

export function buildProcessVideoResult(options: {
  job: {
    id: string;
    status: "completed";
    url: string;
    createdAt: string;
    updatedAt: string;
  };
  transcript: TranscriptResult;
  segments: ScoredSegment[];
  clips: GeneratedClip[];
  warnings: PipelineWarning[];
  analysisSource: "gemini" | "local" | "fallback";
}): ProcessVideoResult {
  return {
    success: true,
    job: options.job,
    summary: {
      transcriptSource: options.transcript.source,
      analysisSource: options.analysisSource,
      candidateCount: options.segments.length,
      selectedClipCount: options.clips.length,
      topScore: options.segments[0]?.score.total ?? null,
      processingTarget: "local-mvp",
    },
    transcript: options.transcript,
    segments: options.segments,
    clips: options.clips,
    nextSteps: {
      readyForUpload: options.clips.length > 0,
      recommendedPlatforms: ["YouTube Shorts", "TikTok", "Instagram Reels"],
      analyticsFields: ["clip_id", "video_id", "score", "views", "retention", "platform"],
    },
    warnings: options.warnings,
  };
}
