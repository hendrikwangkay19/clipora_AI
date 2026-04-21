/**
 * POST /api/cleanup
 *
 * Menghapus job artifacts yang lebih tua dari JOB_MAX_AGE_DAYS (default: 7 hari).
 * Berguna untuk menjaga disk usage tetap terkontrol.
 *
 * Bisa dipanggil manual atau via n8n scheduled workflow.
 */

import { NextResponse } from "next/server";
import { cleanupOldJobs } from "@/lib/autoclip/jobs/cleanup";

export const runtime = "nodejs";

export async function POST() {
  try {
    const result = await cleanupOldJobs();

    return NextResponse.json({
      success: true,
      ...result,
      freedMB: Number((result.freedBytes / 1024 / 1024).toFixed(1)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cleanup gagal.",
      },
      { status: 500 }
    );
  }
}
