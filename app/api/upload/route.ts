import fs from "fs/promises";
import path from "path";
import { appConfig } from "@/lib/autoclip/config";
import { ensureDir } from "@/lib/autoclip/storage/filesystem";

export const runtime = "nodejs";

const UPLOADS_DIR = path.join(appConfig.dataDir, "uploads");
const MAX_SIZE_BYTES = 500 * 1024 * 1024; // 500MB
const ALLOWED_EXTS = new Set([".mp4", ".mov", ".avi", ".mkv", ".webm", ".m4v"]);

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("video");

    if (!file || !(file instanceof File)) {
      return Response.json(
        { success: false, error: "No video file provided." },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return Response.json(
        { success: false, error: "File too large. Max 500MB." },
        { status: 400 }
      );
    }

    const ext = path.extname(file.name).toLowerCase() || ".mp4";
    if (!ALLOWED_EXTS.has(ext)) {
      return Response.json(
        { success: false, error: `Unsupported format: ${ext}. Use MP4, MOV, MKV, AVI.` },
        { status: 400 }
      );
    }

    await ensureDir(UPLOADS_DIR);

    const fileName = `${crypto.randomUUID()}${ext}`;
    const filePath = path.join(UPLOADS_DIR, fileName);

    const bytes = await file.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(bytes));

    return Response.json({
      success: true,
      localPath: filePath,
      fileName: file.name,
      sizeBytes: file.size,
    });
  } catch (error) {
    return Response.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Upload failed.",
      },
      { status: 500 }
    );
  }
}
