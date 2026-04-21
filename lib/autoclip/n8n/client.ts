/**
 * n8n Client — Komunikasi antara Next.js dan n8n.
 *
 * Arsitektur:
 * ┌──────────┐    trigger     ┌─────────┐    post-process    ┌──────────────┐
 * │ Next.js  │ ──────────────→│  n8n    │ ──────────────────→│ Google Drive │
 * │ Pipeline │    (webhook)   │ Workflow│    (upload, etc)   │ Notification │
 * │ (lokal)  │←──────────────│         │                    │   etc.       │
 * └──────────┘    callback    └─────────┘                    └──────────────┘
 *
 * n8n TIDAK memproses video — hanya orchestrate post-processing.
 * Pipeline lokal (FFmpeg + Gemini) tetap jadi engine utama.
 */

// ─── Config ──────────────────────────────────────────────────────────────────

const N8N_BASE_URL = process.env.N8N_WEBHOOK_URL?.trim()?.replace(/\/webhook\/.*$/, "") || "http://localhost:5678";
const N8N_WEBHOOK_PROCESS = process.env.N8N_WEBHOOK_URL?.trim() || `${N8N_BASE_URL}/webhook/video-process`;
const N8N_WEBHOOK_POSTPROCESS = process.env.N8N_WEBHOOK_POSTPROCESS?.trim() || `${N8N_BASE_URL}/webhook/post-process`;

const TIMEOUT_MS = 30_000; // 30 detik max untuk notifikasi ke n8n
const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 2000;

// ─── Types ───────────────────────────────────────────────────────────────────

export type N8nPostProcessPayload = {
  jobId: string;
  clips: Array<{
    filePath: string;
    relativePath: string;
    fileName: string;
    caption: string;
    hashtags: string[];
    score: number;
    durationSeconds: number;
  }>;
  metadata: {
    sourceUrl: string;
    totalClips: number;
    transcriptSummary: string;
    processedAt: string;
  };
  callbackUrl: string; // URL untuk n8n callback setelah selesai
};

export type N8nCallbackPayload = {
  jobId: string;
  success: boolean;
  results?: Array<{
    clipIndex: number;
    driveUrl?: string;
    driveFileId?: string;
    error?: string;
  }>;
  error?: string;
};

export type N8nHealthStatus = {
  reachable: boolean;
  latencyMs: number;
  error?: string;
};

// ─── Helper ──────────────────────────────────────────────────────────────────

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = MAX_RETRIES,
): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const startMs = Date.now();
      const res = await fetch(url, {
        ...init,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      const elapsed = Date.now() - startMs;
      console.log(`[n8n-client] ${init.method ?? "GET"} ${url} → ${res.status} (${elapsed}ms) [attempt ${attempt + 1}]`);
      return res;
    } catch (err) {
      console.warn(
        `[n8n-client] Attempt ${attempt + 1}/${retries + 1} failed:`,
        err instanceof Error ? err.message : err,
      );
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
  }
  return null;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Cek apakah n8n bisa dihubungi.
 */
export async function checkN8nHealth(): Promise<N8nHealthStatus> {
  const startMs = Date.now();
  try {
    const res = await fetch(`${N8N_BASE_URL}/healthz`, {
      signal: AbortSignal.timeout(5000),
    });
    return {
      reachable: res.ok,
      latencyMs: Date.now() - startMs,
    };
  } catch (err) {
    return {
      reachable: false,
      latencyMs: Date.now() - startMs,
      error: err instanceof Error ? err.message : "Tidak dapat terhubung ke n8n",
    };
  }
}

/**
 * Kirim hasil clip ke n8n untuk post-processing (upload Google Drive, dll).
 * Fire-and-forget: tidak menunggu n8n selesai memproses.
 * n8n akan callback ke /api/n8n/callback ketika selesai.
 *
 * @returns true jika berhasil dikirim, false jika n8n tidak tersedia
 */
export async function notifyN8nPostProcess(payload: N8nPostProcessPayload): Promise<boolean> {
  console.log(`[n8n-client] Mengirim ${payload.clips.length} clip ke n8n untuk post-processing (job: ${payload.jobId})`);

  const res = await fetchWithRetry(N8N_WEBHOOK_POSTPROCESS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res) {
    console.warn("[n8n-client] n8n tidak tersedia untuk post-processing. Clip tetap tersedia secara lokal.");
    return false;
  }

  if (!res.ok) {
    console.warn(`[n8n-client] n8n returned ${res.status} untuk post-processing.`);
    return false;
  }

  console.log("[n8n-client] Post-processing request berhasil dikirim ke n8n.");
  return true;
}

/**
 * Kirim video URL ke n8n untuk diproses (mode orchestrator penuh).
 * Ini OPSIONAL — hanya digunakan jika user memilih mode n8n.
 */
export async function sendToN8nForProcessing(body: {
  url?: string;
  localPath?: string;
  options?: Record<string, unknown>;
}): Promise<{ ok: boolean; data?: unknown; error?: string }> {
  const res = await fetchWithRetry(N8N_WEBHOOK_PROCESS, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res) {
    return { ok: false, error: "n8n tidak tersedia." };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const data = await res.json();
    return { ok: res.ok, data };
  }

  return { ok: res.ok, data: await res.text() };
}

/**
 * URL konfigurasi n8n — untuk debugging / health check.
 */
export function getN8nConfig() {
  return {
    baseUrl: N8N_BASE_URL,
    webhookProcess: N8N_WEBHOOK_PROCESS,
    webhookPostProcess: N8N_WEBHOOK_POSTPROCESS,
  };
}
