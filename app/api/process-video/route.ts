import { toErrorResponse } from "@/lib/autoclip/errors";
import {
  processLocalVideo,
  processVideoUrl,
  ProcessOptions,
} from "@/lib/autoclip/pipeline/process-video";
import { AspectRatio, MusicTrack, SubtitleStyle, VideoEffects } from "@/lib/autoclip/media/video";
import { HookType } from "@/lib/autoclip/analysis/transcript-analyzer";
import {
  notifyN8nPostProcess,
  N8nPostProcessPayload,
} from "@/lib/autoclip/n8n/client";
import { CliporaProjectContext, ProcessVideoResult } from "@/lib/autoclip/types";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      url?: string;
      localPath?: string;
      aspectRatio?: AspectRatio;
      maxClips?: number;
      burnSubtitles?: boolean;
      subtitleStyle?: SubtitleStyle;
      effects?: VideoEffects;
      musicTrack?: MusicTrack;
      language?: string;
      hookType?: HookType;
      cliporaContext?: CliporaProjectContext;
    };

    const options: ProcessOptions = {
      aspectRatio: body.aspectRatio ?? "16:9",
      maxClips: typeof body.maxClips === "number" ? Math.min(body.maxClips, 10) : 5,
      burnSubtitles: body.burnSubtitles !== false,
      subtitleStyle: body.subtitleStyle ?? "classic",
      // Default: zoom OFF (sangat CPU-intensive), fade ON, colorGrade OFF
      effects: {
        zoom: body.effects?.zoom ?? false,
        fade: body.effects?.fade ?? true,
        colorGrade: body.effects?.colorGrade ?? false,
      },
      musicTrack: body.musicTrack ?? "none",
      language: body.language,
      hookType: body.hookType ?? "viral",
      cliporaContext: body.cliporaContext,
    };

    let result: ProcessVideoResult;

    if (body.localPath) {
      result = await processLocalVideo(body.localPath, options);
    } else if (body.url) {
      result = await processVideoUrl(body.url, options);
    } else {
      return Response.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Berikan url atau localPath." } },
        { status: 400 }
      );
    }

    if (!result.success) {
      return Response.json(result, { status: 500 });
    }

    // ── Auto-notify n8n untuk post-processing (upload Google Drive, dll) ─────
    const host = req.headers.get("host") ?? "localhost:3000";
    const proto = req.headers.get("x-forwarded-proto") ?? "http";
    const callbackUrl = `${proto}://${host}/api/n8n/callback`;

    const payload: N8nPostProcessPayload = {
      jobId: result.job.id,
      clips: result.clips.map((clip, i) => ({
        filePath: clip.filePath,
        relativePath: clip.relativePath,
        fileName: `clip-${i + 1}.mp4`,
        caption: clip.caption.caption,
        hashtags: clip.caption.hashtags,
        score: clip.score.total,
        durationSeconds: clip.duration,
      })),
      metadata: {
        sourceUrl: body.url ?? body.localPath ?? "",
        totalClips: result.clips.length,
        transcriptSummary: result.transcript.summary,
        processedAt: new Date().toISOString(),
      },
      callbackUrl,
    };

    // Fire-and-forget: jangan block response untuk n8n
    const n8nNotified = await notifyN8nPostProcess(payload).catch(() => false);

    return Response.json({
      ...result,
      n8n: {
        notified: n8nNotified,
        postProcessing: n8nNotified
          ? "Clip sedang diupload ke Google Drive oleh n8n."
          : "n8n tidak tersedia. Clip tetap tersedia secara lokal.",
        callbackUrl: n8nNotified ? callbackUrl : undefined,
      },
    });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return Response.json(body, { status });
  }
}
