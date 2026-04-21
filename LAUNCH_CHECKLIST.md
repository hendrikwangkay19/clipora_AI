# 🚀 AutoClip AI — Production Launch Checklist

> **Project**: AutoClip AI  
> **Stack**: Next.js 16 · TypeScript · React 19 · OpenAI · FFmpeg  
> **Dikelola dengan**: ⬡ Claude Code (Anthropic)  
> **Tanggal audit**: April 2026  
> **Status**: `[ ]` Belum  `[x]` Selesai  `[~]` Partial / Perlu perhatian

---

## 🔴 CRITICAL — Wajib selesai sebelum deploy

### Keamanan Lingkungan (Environment Security)

- [x] `.gitignore` dibuat dan mencakup `.env.local`, `.env*`, `.autoclip/`, `node_modules/`
- [ ] **ROTASI API KEY** — `.env.local` pernah terekspos; segera buat key baru di:
  - [ ] OpenAI Platform → [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
  - [ ] Groq Console → [console.groq.com](https://console.groq.com)
  - [ ] Pexels API → [pexels.com/api](https://www.pexels.com/api/)
- [ ] Verifikasi `.env.local` tidak pernah di-commit ke git (`git log --all --full-history -- .env.local`)
- [ ] `.env.example` tidak mengandung value nyata (hanya placeholder kosong) ✅
- [x] `next.config.ts` dikonfigurasi dengan security headers (CSP, HSTS, X-Frame-Options, dll)
- [x] `middleware.ts` aktif — rate limiting & IP guard pada API routes

### Konfigurasi Production

- [ ] Set `NODE_ENV=production` di environment hosting
- [ ] Semua `console.log` debug dihapus atau dikondisikan (`if (isDev)`)
- [ ] API keys & secrets **tidak pernah** dikirim ke client-side (cek `"use client"` files)
- [ ] `next build` berhasil tanpa error (`npm run build`)
- [ ] `npm run lint` tidak ada error (hanya warning yang diizinkan)

---

## 🟡 PENTING — Selesaikan sebelum traffic nyata

### Error Logging & Monitoring

- [ ] **Pilih error monitoring**: Sentry (gratis tier), LogRocket, atau Axiom
  ```bash
  # Contoh setup Sentry:
  npm install @sentry/nextjs
  npx @sentry/wizard@latest -i nextjs
  ```
- [ ] Tambahkan `app/error.tsx` — global error boundary untuk halaman
- [ ] Tambahkan `app/not-found.tsx` — halaman 404 kustom
- [ ] Cek `/api/health` mengembalikan `200` dengan semua check `ok` atau `warn`
- [ ] API error responses konsisten menggunakan format `{ success: false, error: { code, message } }`
- [ ] Tidak ada `try/catch` kosong yang menelan error tanpa logging
- [ ] File log pipeline tersimpan di `.autoclip/logs/` (jika diimplementasikan)

### Binary Tools Verification

- [ ] `ffmpeg` — verifikasi path di `.env.local` masih valid
- [ ] `ffprobe` — verifikasi path di `.env.local` masih valid
- [ ] `yt-dlp` — pastikan versi terbaru (sering diperbarui untuk bypass YouTube):
  ```bash
  # Update yt-dlp:
  yt-dlp -U
  # atau re-download dari: https://github.com/yt-dlp/yt-dlp/releases
  ```
- [ ] Test pipeline end-to-end dengan video pendek YouTube (< 3 menit) sebelum go-live

---

## 🟢 OPTIMASI — Disarankan untuk performa terbaik

### Optimasi Gambar & Aset

- [ ] Ganti `public/` default SVG (next.svg, vercel.svg, dll) dengan aset brand AutoClip
- [ ] Buat `public/favicon.ico` resolusi tinggi (32×32 & 64×64)
- [ ] Tambahkan `public/og-image.png` (1200×630) untuk Open Graph social preview
- [ ] Tambahkan `public/apple-touch-icon.png` (180×180) untuk iOS
- [ ] Audit ukuran semua gambar — gunakan WebP/AVIF (sudah dikonfigurasi di `next.config.ts`)
- [ ] Tidak ada gambar > 200KB yang di-load tanpa lazy loading
- [ ] Video thumbnail menggunakan `<video preload="metadata">` ✅ (sudah ada di `page.tsx`)

### Performa & Bundle

- [ ] Jalankan `npm run build` dan periksa ukuran bundle:
  ```bash
  npm run build
  # Cek output: semua route < 100kB first load JS
  ```
- [ ] Aktifkan `next/font` untuk font lokal agar tidak ada render-blocking font dari CDN
- [ ] Audit Lighthouse score: target **Performance > 85**, **Accessibility > 90**
  ```
  # Di Chrome DevTools → Lighthouse → Generate report
  ```
- [ ] Cek tidak ada re-render tidak perlu (`React.memo`, `useCallback` sudah ada ✅)

### Aksesibilitas (a11y)

- [ ] Semua `<button>` memiliki `aria-label` atau teks yang deskriptif
- [ ] Semua `<input>` memiliki `<label>` yang terhubung
- [ ] Kontras warna minimum 4.5:1 untuk teks normal
- [ ] Navigasi bisa diakses via keyboard (Tab / Enter / Esc)
- [ ] Video player memiliki kontrol aksibel (`controls` attribute ✅)

---

## 📋 DEPLOYMENT STEPS — Urutan yang benar

```bash
# Langkah 1 — Pastikan tidak ada file sensitif di git
git status
git diff --cached

# Langkah 2 — Lint & type check
npm run lint
npx tsc --noEmit

# Langkah 3 — Production build
npm run build

# Langkah 4 — Test health check
npm start &
curl http://localhost:3000/api/health | jq .

# Langkah 5 — Test pipeline dengan video pendek
# Buka http://localhost:3000 → paste YouTube URL → proses

# Langkah 6 — Deploy ke server
# (Vercel / Railway / VPS / Docker — sesuaikan dengan target)
```

---

## 🏥 HEALTH CHECK — Apa yang diperiksa `/api/health`

| Check | Status OK | Status WARN | Status ERROR |
|---|---|---|---|
| `OPENAI_API_KEY` | Key valid (`sk-...`) | Key tidak ada (pakai fallback) | — |
| `GROQ_API_KEY` | Key ada | Tidak ada (optional) | — |
| `PEXELS_API_KEY` | Key ada | Tidak ada / placeholder | — |
| `ffmpeg` | File ada di path | Tidak dikonfigurasi via env | File tidak ditemukan |
| `ffprobe` | File ada di path | Tidak dikonfigurasi via env | File tidak ditemukan |
| `yt-dlp` | File ada di path | Tidak dikonfigurasi via env | File tidak ditemukan |
| `jobs_storage` | `.autoclip/jobs` writable | — | Tidak bisa write |

**Response shape:**
```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "2026-04-11T10:00:00.000Z",
  "version": "0.1.0",
  "uptime": 123.45,
  "checks": [
    { "name": "OPENAI_API_KEY", "status": "ok", "message": "Present" }
  ]
}
```

---

## 🔒 SECURITY HARDENING CHECKLIST

| Item | Status | Catatan |
|---|---|---|
| `.gitignore` mencakup `.env*` | ✅ Done | |
| Security headers (CSP, HSTS, X-Frame) | ✅ Done | `next.config.ts` |
| Rate limiting API routes | ✅ Done | `middleware.ts` — in-memory |
| API key di server-side only | ✅ Partial | Periksa ulang `"use client"` files |
| Input validation URL YouTube | ✅ Partial | Tambahkan regex validation |
| File upload size limit | ✅ Partial | 500MB di UI — enforce di server juga |
| Rotasi API key setelah exposure | ❌ TODO | **Kritis — lakukan segera** |
| HTTPS only (production) | ⬜ TODO | Konfigurasi di hosting provider |
| Rate limit per user (Redis) | ⬜ TODO | Upgrade dari in-memory middleware |
| Auth/login (jika multi-user) | ⬜ TODO | Tambahkan NextAuth jika perlu |

---

## 📦 PHASE 2 — Roadmap Fitur Selanjutnya

Fitur-fitur ini belum ada dan direkomendasikan untuk iterasi berikutnya:

- [ ] **Queue Worker** (BullMQ/Redis) — agar request tidak timeout saat video panjang
- [ ] **Database** (PostgreSQL/Prisma) — ganti file-based job store
- [ ] **Cloud Storage** (S3/R2) — agar output clips tidak hilang saat server restart
- [ ] **Auth** (NextAuth) — jika akan diakses lebih dari satu orang
- [ ] **Analytics Dashboard** — statistik clip, view count, download count
- [ ] **Burned-in captions** — render subtitle langsung ke video (FFmpeg drawtext)
- [ ] **Social Upload** — direct post ke TikTok/IG/YouTube Shorts API
- [ ] **Webhook** — notifikasi saat job selesai (Discord, Slack, email)
- [ ] **Docker** — containerize agar reproducible di mana saja

---

## 🤖 Tentang Audit Ini

Audit dan file-file berikut dibuat oleh **Claude Code** (Anthropic):

| File | Keterangan |
|---|---|
| `.gitignore` | Mencegah commit file sensitif |
| `next.config.ts` | Security headers + image optimization |
| `app/layout.tsx` | Navigasi lengkap + footer + Claude Code badge |
| `app/api/health/route.ts` | Health check endpoint |
| `middleware.ts` | Rate limiting & security guard |
| `LAUNCH_CHECKLIST.md` | Dokumen ini |
| `README.md` | Dokumentasi profesional diperbarui |

> **Dibuat dengan ⬡ Claude Code · AutoClip AI · April 2026**
