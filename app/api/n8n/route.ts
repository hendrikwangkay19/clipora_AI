/**
 * GET  /api/n8n        — Status & health check integrasi n8n
 * POST /api/n8n        — Proses video via pipeline lokal + auto kirim ke n8n post-process
 *
 * Ini adalah entry point utama untuk integrasi n8n.
 * Pipeline lokal (FFmpeg + Gemini) tetap jadi engine pemroses video.
 * n8n hanya menangani post-processing: upload Google Drive, notifikasi, dll.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  processLocalVideo,
  processVideoUrl,
  ProcessOptions,
} from "@/lib/autoclip/pipeline/process-video";
import {
  checkN8nHealth,
  getN8nConfig,
  notifyN8nPostProcess,
  N8nPostProcessPayload,
} from "@/lib/autoclip/n8n/client";
import { toErrorResponse } from "@/lib/autoclip/errors";

export const runtime = "nodejs";
export const maxDuration = 300;

// ─── GET: Status n8n ─────────────────────────────────────────────────────────

export async function GET() {
  const health = await checkN8nHealth();
  const config = getN8nConfig();

  return NextResponse.json({
    success: true,
    n8n: {
      status: health.reachable ? "connected" : "disconnected",
      latencyMs: health.latencyMs,
      error: health.error,
      config: {
        baseUrl: config.baseUrl,
        webhookProcess: config.webhookProcess,
        webhookPostProcess: config.webhookPostProcess,
      },
    },
    architecture: {
      mode: "orchestrator",
      description: "Pipeline lokal memproses video. n8n menangani post-processing (Google Drive, notifikasi).",
      endpoints: {
        "GET /api/n8n": "Status & health check",
        "POST /api/n8n": "Proses video + auto kirim ke n8n",
        "POST /api/n8n/trigger": "Untuk n8n men-trigger pipeline lokal",
        "POST /api/n8n/callback": "Untuk n8n mengirim hasil post-processing",
      },
    },
  });
}

// ─── POST: Proses video + kirim ke n8n ───────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      url?: string;
      localPath?: string;
      options?: Partial<ProcessOptions>;
    };

    const { url, localPath } = body;

    if (!url && !localPath) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Berikan url atau localPath." } },
        { status: 400 },
      );
    }

    // Default options untuk mode n8n (9:16 shorts)
    const options: ProcessOptions = {
      aspectRatio: "9:16",
      maxClips: 3,
      burnSubtitles: true,
      subtitleStyle: "classic",
      effects: { zoom: false, fade: true, colorGrade: false },
      musicTrack: "none",
      hookType: "viral",
      ...body.options,
    };

    console.log(`[n8n] Memulai pipeline lokal untuk: ${url ?? localPath}`);

    // ── Step 1: Jalankan pipeline lokal ──────────────────────────────────────
    const result = localPath
      ? await processLocalVideo(localPath, options)
      : await processVideoUrl(url!, options);

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    // ── Step 2: Kirim hasil ke n8n untuk post-processing ─────────────────────
    const baseUrl = getBaseUrl(req);
    const callbackUrl = `${baseUrl}/api/n8n/callback`;

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
        sourceUrl: url ?? localPath ?? "",
        totalClips: result.clips.length,
        transcriptSummary: result.transcript.summary,
        processedAt: new Date().toISOString(),
      },
      callbackUrl,
    };

    const n8nNotified = await notifyN8nPostProcess(payload);

    // ── Return hasil + status n8n ────────────────────────────────────────────
    return NextResponse.json({
      ...result,
      n8n: {
        notified: n8nNotified,
        postProcessing: n8nNotified
          ? "Clip sedang diupload ke Google Drive oleh n8n. Cek /api/n8n/callback untuk hasilnya."
          : "n8n tidak tersedia. Clip tetap bisa diakses secara lokal via /api/files.",
        callbackUrl,
      },
    });
  } catch (error) {
    const { status, body: errBody } = toErrorResponse(error);
    return NextResponse.json(errBody, { status });
  }
}

function getBaseUrl(req: NextRequest): string {
  const proto = req.headers.get("x-forwarded-proto") ?? "http";
  const host = req.headers.get("host") ?? "localhost:3000";
  return `${proto}://${host}`;
}
