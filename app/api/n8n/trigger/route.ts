/**
 * POST /api/n8n/trigger
 *
 * Endpoint yang bisa dipanggil oleh n8n untuk men-trigger pipeline lokal.
 * Berguna saat n8n digunakan sebagai scheduler — misalnya:
 * - n8n schedule: setiap jam cek YouTube channel → kirim URL ke sini
 * - n8n workflow: terima URL dari Telegram bot → forward ke sini
 *
 * Setelah pipeline selesai, hasilnya otomatis dikirim ke n8n post-process webhook.
 */

import { NextResponse } from "next/server";
import {
  processLocalVideo,
  processVideoUrl,
  ProcessOptions,
} from "@/lib/autoclip/pipeline/process-video";
import { notifyN8nPostProcess, N8nPostProcessPayload } from "@/lib/autoclip/n8n/client";
import { toErrorResponse } from "@/lib/autoclip/errors";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 menit untuk pipeline penuh

export async function POST(req: Request) {
  try {
    const body = await req.json() as {
      url?: string;
      localPath?: string;
      options?: Partial<ProcessOptions>;
      skipPostProcess?: boolean; // true = hanya proses lokal, jangan kirim ke n8n
    };

    const { url, localPath, skipPostProcess } = body;

    if (!url && !localPath) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Berikan url atau localPath." } },
        { status: 400 },
      );
    }

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

    console.log(`[n8n/trigger] Pipeline lokal dimulai — ${url ?? localPath}`);

    // Jalankan pipeline lokal
    const result = localPath
      ? await processLocalVideo(localPath, options)
      : await processVideoUrl(url!, options);

    // Kirim hasil ke n8n untuk post-processing (jika tidak di-skip)
    let n8nNotified = false;
    if (!skipPostProcess && result.success) {
      const callbackUrl = `${getBaseUrl(req)}/api/n8n/callback`;

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

      n8nNotified = await notifyN8nPostProcess(payload);
    }

    return NextResponse.json({
      ...result,
      n8n: {
        notified: n8nNotified,
        message: n8nNotified
          ? "Hasil dikirim ke n8n untuk post-processing (Google Drive upload, dll)."
          : "n8n tidak tersedia. Clip tetap bisa diakses secara lokal.",
      },
    });
  } catch (error) {
    const { status, body: errBody } = toErrorResponse(error);
    return NextResponse.json(errBody, { status });
  }
}

function getBaseUrl(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}
