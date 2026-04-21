/**
 * GET /api/health
 *
 * Health-check endpoint untuk monitoring & deployment verification.
 * Memeriksa: environment variables, binary tools (ffmpeg, yt-dlp),
 * dan koneksi Gemini API key.
 *
 * Response cepat — tidak menjalankan pipeline sungguhan.
 */

import { NextResponse } from "next/server";
import fs from "fs";
import { appConfig } from "@/lib/autoclip/config";

// ─── Types ────────────────────────────────────────────────────────────────────

type CheckStatus = "ok" | "warn" | "error";

interface Check {
  name: string;
  status: CheckStatus;
  message: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: Check[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function checkBinary(label: string, envPath: string | null | undefined): Check {
  if (envPath) {
    const exists = fs.existsSync(envPath);
    return {
      name: label,
      status: exists ? "ok" : "error",
      message: exists
        ? `Found at ${envPath}`
        : `Configured but NOT found at: ${envPath}`,
    };
  }
  // Not configured via env — assume available on PATH (best-effort)
  return {
    name: label,
    status: "warn",
    message: "Not set in .env — must be available on system PATH",
  };
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<HealthResponse>> {
  const checks: Check[] = [];

  // 1. Gemini API key
  const geminiKey = process.env.GEMINI_API_KEY;
  checks.push({
    name: "GEMINI_API_KEY",
    status: geminiKey && geminiKey.length > 10 ? "ok" : "warn",
    message: geminiKey
      ? "Present — Gemini transcription & analysis enabled"
      : "Missing — transcription & analysis will use fallback heuristics",
  });

  // 2. Pexels API key (optional — stock video)
  const pexelsKey = process.env.PEXELS_API_KEY;
  checks.push({
    name: "PEXELS_API_KEY",
    status: pexelsKey && pexelsKey !== "PASTE_YOUR_PEXELS_KEY_HERE" ? "ok" : "warn",
    message:
      pexelsKey && pexelsKey !== "PASTE_YOUR_PEXELS_KEY_HERE"
        ? "Present"
        : "Missing (optional — stock video for generation)",
  });

  // 3. Binary: ffmpeg
  checks.push(checkBinary("ffmpeg", appConfig.binaries.ffmpeg));

  // 4. Binary: ffprobe
  checks.push(checkBinary("ffprobe", appConfig.binaries.ffprobe));

  // 5. Binary: yt-dlp
  checks.push(checkBinary("yt-dlp", appConfig.binaries.ytDlp));

  // 6. Jobs directory writable
  const jobsDir = ".autoclip/jobs";
  try {
    fs.mkdirSync(jobsDir, { recursive: true });
    checks.push({ name: "jobs_storage", status: "ok", message: `Writable: ${jobsDir}` });
  } catch {
    checks.push({
      name: "jobs_storage",
      status: "error",
      message: `Cannot write to ${jobsDir} — check permissions`,
    });
  }

  // ── Aggregate status ──────────────────────────────────────────────────────
  const hasError = checks.some((c) => c.status === "error");
  const hasWarn = checks.some((c) => c.status === "warn");

  const overallStatus: HealthResponse["status"] = hasError
    ? "unhealthy"
    : hasWarn
      ? "degraded"
      : "healthy";

  const body: HealthResponse = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    uptime: process.uptime(),
    checks,
  };

  // HTTP 200 even for degraded — only 503 for truly unhealthy
  return NextResponse.json(body, { status: hasError ? 503 : 200 });
}
