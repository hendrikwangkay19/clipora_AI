import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { appConfig } from "@/lib/autoclip/config";
import { clipVideo } from "@/lib/autoclip/media/video";
import { toErrorResponse } from "@/lib/autoclip/errors";
import { ensureDir } from "@/lib/autoclip/storage/filesystem";

export const runtime = "nodejs";
export const maxDuration = 180;

type Segment = { start: number; end: number; text: string };

// ─── Security: hanya izinkan file di dalam .autoclip/ ────────────────────────
const ALLOWED_ROOT = path.resolve(appConfig.dataDir);

function isPathSafe(filePath: string): boolean {
  // Reject path traversal patterns
  if (filePath.includes("..") || filePath.includes("\0")) return false;
  const resolved = path.resolve(filePath);
  return resolved.startsWith(ALLOWED_ROOT);
}

function buildCaption(segment: Segment, index: number): string {
  const words = segment.text.trim().split(/\s+/).slice(0, 8).join(" ");
  return words || `Clip ${index + 1}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { filePath?: string; segments?: Segment[] };
    const { filePath, segments } = body;

    if (!filePath || typeof filePath !== "string" || !filePath.trim()) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Field 'filePath' wajib diisi." } },
        { status: 400 }
      );
    }

    // Validasi keamanan: filePath harus di dalam .autoclip/
    if (!isPathSafe(filePath)) {
      return NextResponse.json(
        { success: false, error: { code: "FORBIDDEN", message: "Akses file di luar direktori yang diizinkan." } },
        { status: 403 }
      );
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: { code: "FILE_NOT_FOUND", message: `File tidak ditemukan: ${filePath}` } },
        { status: 400 }
      );
    }

    if (!Array.isArray(segments) || segments.length === 0) {
      return NextResponse.json(
        { success: false, error: { code: "INVALID_INPUT", message: "Field 'segments' harus array dengan minimal 1 item." } },
        { status: 400 }
      );
    }

    const clipsDir = path.join(path.dirname(filePath), "clips");
    await ensureDir(clipsDir);

    const clips: { filePath: string; caption: string }[] = [];

    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      const duration = Math.max(1, seg.end - seg.start);
      const outputPath = path.join(clipsDir, `clip-${i + 1}.mp4`);

      await clipVideo({
        inputPath: filePath,
        outputPath,
        start: seg.start,
        duration,
      });

      clips.push({
        filePath: outputPath,
        caption: buildCaption(seg, i),
      });
    }

    return NextResponse.json({ success: true, clips });
  } catch (error) {
    const { status, body } = toErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
