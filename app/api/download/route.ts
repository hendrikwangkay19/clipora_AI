import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { downloadYoutubeVideo, isYoutubeUrl } from "@/lib/autoclip/downloader/youtube";
import { toErrorResponse } from "@/lib/autoclip/errors";
import { ensureDir } from "@/lib/autoclip/storage/filesystem";

export const runtime = "nodejs";
export const maxDuration = 180;

const DOWNLOADS_DIR = path.join(process.cwd(), ".autoclip", "downloads");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { url?: string };
    const { url } = body;

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Field 'url' wajib diisi." } },
        { status: 400 }
      );
    }

    if (!isYoutubeUrl(url)) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_URL", message: "Hanya URL YouTube yang didukung." } },
        { status: 400 }
      );
    }

    // Buat subfolder unik per download agar tidak saling timpa
    const downloadId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const outputDir = path.join(DOWNLOADS_DIR, downloadId);
    await ensureDir(outputDir);

    const filePath = await downloadYoutubeVideo(url, outputDir);

    return NextResponse.json({ success: true, filePath });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
