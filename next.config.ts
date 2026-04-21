import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

/**
 * Security headers untuk production.
 * Referensi: https://nextjs.org/docs/advanced-features/security-headers
 */
const securityHeaders = [
  // Mencegah clickjacking
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  // Mencegah MIME sniffing
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Referrer policy
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Permissions policy — matikan fitur browser yang tidak dipakai
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS — aktif di production saja
  ...(!isDev
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
  // Content Security Policy — sesuaikan jika ada CDN/embed pihak ketiga
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js hot reload butuh 'unsafe-eval' di dev
      isDev ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "font-src 'self'",
      "connect-src 'self'",
      "frame-ancestors 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  // ── Security headers ────────────────────────────────────────────────────────
  async headers() {
    return [
      {
        // Terapkan ke semua route
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // ── Image optimization ──────────────────────────────────────────────────────
  images: {
    // Format modern untuk kompresi lebih baik
    formats: ["image/avif", "image/webp"],
    // Maksimal cache 1 hari di browser, 7 hari di CDN
    minimumCacheTTL: 60 * 60 * 24,
    // Domain yang diizinkan untuk remote images (tambah jika perlu)
    remotePatterns: [],
  },

  // ── Build & bundling ────────────────────────────────────────────────────────
  // Aktifkan React Strict Mode untuk mendeteksi masalah lebih awal
  reactStrictMode: true,

  // Compress response HTTP
  compress: true,

  // ── Logging (production) ───────────────────────────────────────────────────
  logging: {
    fetches: {
      fullUrl: isDev,
    },
  },

};

export default nextConfig;
