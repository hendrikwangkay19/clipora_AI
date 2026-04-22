import fs from "fs";
import path from "path";
import { analyzeTranscriptWithFallback, HookType } from "@/lib/autoclip/analysis/transcript-analyzer";
import { generateCaptionPayload } from "@/lib/autoclip/captions/generate";
import { writeSubtitleFile } from "@/lib/autoclip/captions/subtitle";
import { appConfig } from "@/lib/autoclip/config";
import { rankSegments } from "@/lib/autoclip/decision/score";
import { downloadYoutubeVideo, isYoutubeUrl } from "@/lib/autoclip/downloader/youtube";
import { AppError } from "@/lib/autoclip/errors";
import {
  appendJobWarning,
  completeJob,
  createJob,
  failJob,
  updateJob,
  updateJobStatus,
} from "@/lib/autoclip/jobs/store";
import { buildProcessVideoResult } from "@/lib/autoclip/metadata/build-result";
import { extractAudio } from "@/lib/autoclip/media/audio";
import { getVideoDurationSeconds } from "@/lib/autoclip/media/probe";
import {
  AspectRatio,
  MusicTrack,
  SubtitleStyle,
  VideoEffects,
  clipVideo,
  getMusicPath,
} from "@/lib/autoclip/media/video";
import {
  ensureDir,
  getArtifactsDir,
  toPublicRelativePath,
  writeJsonFile,
} from "@/lib/autoclip/storage/filesystem";
import { transcribeAudioWithFallback } from "@/lib/autoclip/transcription";
import { CliporaProjectContext, GeneratedClip, PipelineWarning } from "@/lib/autoclip/types";

export type ProcessOptions = {
  aspectRatio?:   AspectRatio;
  maxClips?:      number;
  burnSubtitles?: boolean;
  subtitleStyle?: SubtitleStyle;
  effects?:       VideoEffects;
  musicTrack?:    MusicTrack;
  language?:      string;
  hookType?:      HookType;
  cliporaContext?: CliporaProjectContext;
};

const ALLOWED_LOCAL_ROOT = path.resolve(process.cwd(), ".autoclip");

function assertSafeLocalPath(filePath: string) {
  if (filePath.includes("..") || filePath.includes("\0")) {
    throw new AppError("Path file tidak valid.", "FORBIDDEN_PATH", 403);
  }

  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(ALLOWED_LOCAL_ROOT)) {
    throw new AppError(
      "File lokal harus berada di dalam direktori .autoclip.",
      "FORBIDDEN_PATH",
      403
    );
  }
}

function clampClipDuration(start: number, end: number) {
  const raw = Math.max(1, end - start);
  return Math.max(
    appConfig.clips.minDurationSeconds,
    Math.min(appConfig.clips.maxDurationSeconds, raw)
  );
}

// ─── Pipeline ─────────────────────────────────────────────────────────────────

async function runPipeline(
  sourceVideo: string,
  jobId: string,
  inputLabel: string,
  options: ProcessOptions
) {
  const artifactsDir = getArtifactsDir(jobId);
  const warnings: PipelineWarning[] = [];
  const {
    aspectRatio    = "16:9",
    maxClips       = 5,
    burnSubtitles  = true,
    subtitleStyle  = "classic",
    effects        = {},
    musicTrack     = "none",
    language,
    hookType       = "viral",
  } = options;

  const musicPath = getMusicPath(musicTrack) ?? undefined;

  await updateJob(jobId, { artifacts: { sourceVideo } });

  // ── Ekstrak audio (kecil, untuk transkripsi) ──────────────────────────────
  await updateJobStatus(jobId, "extracting_audio");
  const audioPath = path.join(artifactsDir, "audio.mp3");
  await extractAudio(sourceVideo, audioPath);
  await updateJob(jobId, { artifacts: { sourceVideo, audio: audioPath } });

  const durationSeconds = await getVideoDurationSeconds(sourceVideo);

  // ── Transkripsi ───────────────────────────────────────────────────────────
  await updateJobStatus(jobId, "transcribing");
  const transcriptionResult = await transcribeAudioWithFallback({
    audioPath,
    durationSeconds,
    language,
  });
  if (transcriptionResult.warning) {
    warnings.push(transcriptionResult.warning);
    await appendJobWarning(jobId, transcriptionResult.warning);
  }

  const transcriptPath = path.join(artifactsDir, "transcript.json");
  await writeJsonFile(transcriptPath, transcriptionResult.transcript);
  await updateJob(jobId, {
    artifacts: { sourceVideo, audio: audioPath, transcript: transcriptPath },
  });

  // ── Analisis + scoring ────────────────────────────────────────────────────
  await updateJobStatus(jobId, "analyzing");
  const analysisResult = await analyzeTranscriptWithFallback(
    transcriptionResult.transcript,
    hookType
  );
  if (analysisResult.warning) {
    warnings.push(analysisResult.warning);
    await appendJobWarning(jobId, analysisResult.warning);
  }

  await updateJobStatus(jobId, "scoring");
  const rankedSegments = rankSegments(analysisResult.segments);
  const segmentsPath = path.join(artifactsDir, "segments.json");
  await writeJsonFile(segmentsPath, rankedSegments);
  await updateJob(jobId, {
    artifacts: { sourceVideo, audio: audioPath, transcript: transcriptPath, segments: segmentsPath },
  });

  // ── Render clip (parallel, max 2 concurrent untuk hemat CPU) ──────────────
  await updateJobStatus(jobId, "clipping");
  const topSegments = rankedSegments.slice(0, Math.min(maxClips, 10));
  const MAX_CONCURRENT = 2;

  async function renderClip(segment: typeof topSegments[0]) {
    const duration   = clampClipDuration(segment.start, segment.end);
    const outputPath = path.join(artifactsDir, `clip-${segment.rank}.mp4`);

    // Generate file subtitle .ass (style sudah embed di dalamnya)
    let subtitlePath: string | undefined;
    if (burnSubtitles && transcriptionResult.transcript.chunks.length > 0) {
      const assFilePath = path.join(artifactsDir, `clip-${segment.rank}.ass`);
      const written = await writeSubtitleFile(
        assFilePath,
        transcriptionResult.transcript.chunks,
        segment.start,
        segment.start + duration,
        subtitleStyle,
        aspectRatio,
      );
      if (written) subtitlePath = written;
    }

    await clipVideo({
      inputPath:    sourceVideo,
      outputPath,
      start:        segment.start,
      duration,
      aspectRatio,
      subtitlePath,
      effects,
      musicPath,
    });

    return {
      id:             `${jobId}-clip-${segment.rank}`,
      filePath:       outputPath,
      relativePath:   toPublicRelativePath(outputPath),
      start:          segment.start,
      end:            segment.start + duration,
      duration,
      transcriptText: segment.text,
      score:          segment.score,
      caption:        generateCaptionPayload(segment),
    } satisfies GeneratedClip;
  }

  // Render clips in batches of MAX_CONCURRENT
  const clips: GeneratedClip[] = [];
  for (let i = 0; i < topSegments.length; i += MAX_CONCURRENT) {
    const batch = topSegments.slice(i, i + MAX_CONCURRENT);
    const batchResults = await Promise.all(batch.map(renderClip));
    clips.push(...batchResults);
  }

  // ── Simpan hasil ──────────────────────────────────────────────────────────
  const completedJob = await updateJobStatus(jobId, "completed");
  const result = buildProcessVideoResult({
    job: {
      id:        completedJob.id,
      status:    "completed",
      url:       inputLabel,
      createdAt: completedJob.createdAt,
      updatedAt: new Date().toISOString(),
    },
    transcript: transcriptionResult.transcript,
    segments:   rankedSegments,
    clips,
    warnings,
    analysisSource: analysisResult.source,
  });

  const resultPath = path.join(artifactsDir, "result.json");
  await writeJsonFile(resultPath, result);
  await updateJob(jobId, {
    artifacts: {
      sourceVideo,
      audio:      audioPath,
      transcript: transcriptPath,
      segments:   segmentsPath,
      result:     resultPath,
    },
  });
  await completeJob(jobId, result);

  return result;
}

// ─── Entry points ─────────────────────────────────────────────────────────────

export async function processVideoUrl(url: string, options: ProcessOptions = {}) {
  if (!url.trim()) {
    throw new AppError("URL YouTube diperlukan.", "INVALID_INPUT", 400);
  }
  if (!isYoutubeUrl(url)) {
    throw new AppError("Hanya URL YouTube yang didukung.", "INVALID_URL", 400);
  }

  const job         = await createJob(url, options.cliporaContext);
  const artifactsDir = getArtifactsDir(job.id);

  try {
    await ensureDir(artifactsDir);
    await updateJobStatus(job.id, "downloading");
    const sourceVideo = await downloadYoutubeVideo(url, artifactsDir);
    return await runPipeline(sourceVideo, job.id, url, options);
  } catch (error) {
    await failJob(job.id, {
      code:    error instanceof AppError ? error.code : "PIPELINE_FAILED",
      message: error instanceof Error ? error.message : "Pipeline gagal.",
    });
    throw error;
  }
}

export async function processLocalVideo(filePath: string, options: ProcessOptions = {}) {
  if (!filePath.trim()) {
    throw new AppError("Path file diperlukan.", "INVALID_INPUT", 400);
  }
  assertSafeLocalPath(filePath);
  if (!fs.existsSync(filePath)) {
    throw new AppError(`File tidak ditemukan: ${filePath}`, "FILE_NOT_FOUND", 400);
  }

  const job         = await createJob(filePath, options.cliporaContext);
  const artifactsDir = getArtifactsDir(job.id);

  try {
    await ensureDir(artifactsDir);
    return await runPipeline(filePath, job.id, path.basename(filePath), options);
  } catch (error) {
    await failJob(job.id, {
      code:    error instanceof AppError ? error.code : "PIPELINE_FAILED",
      message: error instanceof Error ? error.message : "Pipeline gagal.",
    });
    throw error;
  }
}
