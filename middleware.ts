/**
 * middleware.ts — Next.js Edge Middleware
 *
 * Berjalan di edge sebelum setiap request diproses.
 * Menangani: rate limiting ringan, request logging, auth guard, & security.
 *
 * Catatan: Untuk rate limiting skala produksi penuh, ganti dengan
 * Upstash Redis + @upstash/ratelimit.
 */

import { NextRequest, NextResponse } from "next/server";

// ─── Config ───────────────────────────────────────────────────────────────────

/** Route yang butuh perlindungan rate-limit ketat */
const HEAVY_ROUTES = [
  "/api/process-video",
  "/api/upload",
  "/api/generate-video",
  "/api/generation-jobs/process",
  "/api/n8n",
];

/** IP yang selalu diblokir (isi jika ada abuse) */
const BLOCKED_IPS: string[] = [];

// ─── Auth ────────────────────────────────────────────────────────────────────

/**
 * Jika API_SECRET_TOKEN diset di .env.local, semua /api/ endpoint
 * memerlukan header: Authorization: Bearer <token>
 * Jika tidak diset, auth dinonaktifkan (mode development).
 */
const API_SECRET_TOKEN = process.env.API_SECRET_TOKEN?.trim() || null;

function checkAuth(req: NextRequest): boolean {
  if (!API_SECRET_TOKEN) return true; // auth disabled
  const authHeader = req.headers.get("authorization") ?? "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === API_SECRET_TOKEN;
}

// ─── In-memory rate limiter (per IP, per route) ────────────────────────────--
// Cocok untuk single-instance local/VPS. Ganti Redis untuk multi-instance.

interface RateEntry {
  count: number;
  resetAt: number;
}

const rateMap = new Map<string, RateEntry>();

/**
 * @param key       unik per IP+route
 * @param limit     max request dalam window
 * @param windowMs  durasi window (ms)
 */
function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateMap.set(key, { count: 1, resetAt: now + windowMs });
    return true; // allowed
  }

  entry.count++;
  if (entry.count > limit) return false; // blocked
  return true;
}

// Bersihkan entri kedaluwarsa setiap 5 menit
if (typeof globalThis !== "undefined") {
  // Edge runtime aman untuk setInterval module-level
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateMap) {
      if (now > entry.resetAt) rateMap.delete(key);
    }
  }, 5 * 60 * 1000);
}

// ─── Middleware (HARUS bernama 'middleware' agar Next.js mengenalinya) ────────

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── 1. IP block list ─────────────────────────────────────────────────────
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  if (BLOCKED_IPS.includes(ip)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  // ── 2. Auth check untuk API routes ─────────────────────────────────────
  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/health")) {
    if (!checkAuth(req)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "Token autentikasi diperlukan. Set header: Authorization: Bearer <token>",
          },
        },
        { status: 401 }
      );
    }
  }

  // ── 3. Rate limiting untuk route berat ──────────────────────────────────
  if (HEAVY_ROUTES.some((r) => pathname.startsWith(r))) {
    // 5 request per menit per IP untuk pipeline berat
    const allowed = checkRateLimit(`${ip}:${pathname}`, 5, 60_000);
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak request. Tunggu sebentar lalu coba lagi.",
          },
        },
        {
          status: 429,
          headers: {
            "Retry-After": "60",
            "X-RateLimit-Limit": "5",
            "X-RateLimit-Window": "60s",
          },
        }
      );
    }
  }

  // ── 4. Rate limiting global (semua API) ──────────────────────────────────
  if (pathname.startsWith("/api/")) {
    // 60 request per menit per IP untuk semua endpoint
    const allowed = checkRateLimit(`global:${ip}`, 60, 60_000);
    if (!allowed) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "RATE_LIMITED",
            message: "Terlalu banyak request. Coba lagi dalam 1 menit.",
          },
        },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }
  }

  // ── 5. Request logging ─────────────────────────────────────────────────
  if (process.env.NODE_ENV === "development") {
    console.log(`[${new Date().toISOString()}] ${req.method} ${pathname} — IP: ${ip}`);
  }

  // ── 6. Lanjutkan request ─────────────────────────────────────────────────
  const res = NextResponse.next();

  // Tambahkan header identifikasi server
  res.headers.set("X-App", "AutoClip-AI");

  return res;
}

// ─── Matcher — jalankan middleware di semua route kecuali static assets ───────

export const config = {
  matcher: [
    /*
     * Match semua path KECUALI:
     * - _next/static  (static files)
     * - _next/image   (image optimization)
     * - favicon.ico
     * - file publik (svg, png, jpg, dll)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$).*)",
  ],
};
