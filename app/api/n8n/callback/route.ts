/**
 * POST /api/n8n/callback
 *
 * Endpoint yang dipanggil oleh n8n setelah post-processing selesai.
 * Contoh: setelah upload clip ke Google Drive, n8n kirim link hasilnya ke sini.
 *
 * n8n harus mengirim JSON:
 * {
 *   "jobId": "uuid",
 *   "success": true,
 *   "results": [
 *     { "clipIndex": 0, "driveUrl": "https://drive.google.com/...", "driveFileId": "..." },
 *     { "clipIndex": 1, "driveUrl": "https://drive.google.com/...", "driveFileId": "..." }
 *   ]
 * }
 */

import { NextResponse } from "next/server";
import path from "path";
import { readJsonFile, writeJsonFile, getJobDir } from "@/lib/autoclip/storage/filesystem";
import { JobRecord } from "@/lib/autoclip/types";
import { N8nCallbackPayload } from "@/lib/autoclip/n8n/client";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as N8nCallbackPayload;

    if (!body.jobId) {
      return NextResponse.json(
        { success: false, error: "jobId is required." },
        { status: 400 },
      );
    }

    console.log(`[n8n/callback] Menerima callback untuk job ${body.jobId}, success: ${body.success}`);

    // Baca job record yang ada
    const jobFile = path.join(getJobDir(body.jobId), "job.json");
    let jobRecord: JobRecord;
    try {
      jobRecord = await readJsonFile<JobRecord>(jobFile);
    } catch {
      console.error(`[n8n/callback] Job ${body.jobId} tidak ditemukan.`);
      return NextResponse.json(
        { success: false, error: `Job ${body.jobId} not found.` },
        { status: 404 },
      );
    }

    // Simpan hasil n8n ke job record
    const n8nResult = {
      receivedAt: new Date().toISOString(),
      success: body.success,
      results: body.results ?? [],
      error: body.error,
    };

    // Update job record dengan data dari n8n
    const updatedRecord = {
      ...jobRecord,
      n8nResult,
      updatedAt: new Date().toISOString(),
    };

    await writeJsonFile(jobFile, updatedRecord);

    // Juga simpan n8n result terpisah untuk akses cepat
    const n8nResultFile = path.join(getJobDir(body.jobId), "n8n-result.json");
    await writeJsonFile(n8nResultFile, n8nResult);

    console.log(
      `[n8n/callback] Job ${body.jobId} updated. ${body.results?.length ?? 0} clip results received.`,
    );

    return NextResponse.json({
      success: true,
      message: `Callback untuk job ${body.jobId} berhasil diproses.`,
      clipCount: body.results?.length ?? 0,
    });
  } catch (error) {
    console.error("[n8n/callback] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Callback processing failed.",
      },
      { status: 500 },
    );
  }
}
