/**
 * GET /api/jobs/[jobId]/n8n-result
 *
 * Mengambil hasil post-processing n8n (Google Drive links, dll).
 * Digunakan oleh frontend untuk polling setelah pipeline selesai.
 */

import { NextResponse } from "next/server";
import path from "path";
import { readJsonFile, getJobDir } from "@/lib/autoclip/storage/filesystem";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  if (!jobId || jobId.includes("..") || jobId.includes("/")) {
    return NextResponse.json({ success: false, error: "Invalid jobId." }, { status: 400 });
  }

  try {
    const n8nResultFile = path.join(getJobDir(jobId), "n8n-result.json");
    const data = await readJsonFile<{
      receivedAt: string;
      success: boolean;
      results: Array<{
        clipIndex: number;
        driveUrl?: string;
        driveFileId?: string;
        fileName?: string;
      }>;
      error?: string;
    }>(n8nResultFile);

    return NextResponse.json(data);
  } catch {
    // File doesn't exist yet — n8n hasn't called back
    return NextResponse.json(
      { success: false, pending: true, message: "n8n belum mengirim hasil." },
      { status: 404 },
    );
  }
}
