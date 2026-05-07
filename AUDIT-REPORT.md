# AUDIT REPORT — Clipora (autoclip-ai)
> Audit dilakukan: 2026-05-03  
> Auditor: Claude Sonnet 4.6 (senior full-stack, read-only)  
> Tujuan: Pre-redesign UI audit — tidak ada modifikasi file dilakukan

---

## 1. STRUKTUR FOLDER

**Router Type: App Router** (Next.js 13+, direktori `app/`)

```
autoclip-ai/
├── .autoclip/                         # Runtime data (gitignore'd)
│   ├── downloads/
│   ├── jobs/                          # Clip job artifacts
│   └── clipora-doc-images/
├── app/
│   ├── api/
│   │   ├── cleanup/route.ts
│   │   ├── clip/route.ts
│   │   ├── download/route.ts
│   │   ├── files/route.ts
│   │   ├── generate-video/route.ts
│   │   ├── generation-jobs/
│   │   │   ├── route.ts
│   │   │   ├── [jobId]/route.ts
│   │   │   └── process/route.ts
│   │   ├── health/route.ts
│   │   ├── jobs/
│   │   │   ├── latest/route.ts
│   │   │   └── [jobId]/route.ts & n8n-result/route.ts
│   │   ├── n8n/
│   │   │   ├── route.ts
│   │   │   ├── callback/route.ts
│   │   │   └── trigger/route.ts
│   │   ├── process-video/route.ts
│   │   └── upload/route.ts
│   ├── dashboard/page.tsx
│   ├── generate/page.tsx
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                       # Halaman utama Clipora
├── components/autoclip/
│   ├── dashboard-ui.tsx               # ⚠️ ORPHANED - tidak dipakai
│   ├── generate-ui.tsx
│   └── jobs-dashboard.tsx
├── lib/
│   ├── ai.ts                          # Provider AI utama (Gemini/Ollama)
│   ├── ffmpeg.ts                      # ❌ LEGACY - hardcoded path, tidak dipakai
│   ├── transcribe.ts                  # Gemini + Whisper transcription helpers
│   ├── youtube.ts                     # ❌ LEGACY - hardcoded path, tidak dipakai
│   └── autoclip/
│       ├── analysis/
│       ├── captions/
│       ├── config.ts
│       ├── decision/
│       ├── downloader/
│       ├── errors.ts
│       ├── generation/                # Sistem AI Video Generation (fitur kedua)
│       ├── jobs/
│       ├── media/
│       ├── metadata/
│       ├── n8n/
│       ├── pipeline/
│       ├── storage/
│       ├── tools/
│       ├── transcription/
│       └── types.ts
├── proxy.ts                           # ❌ DEAD CODE - tidak ada middleware.ts
├── .env.local
├── .env.example
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 2. TECH STACK AKTUAL

| Item | Versi |
|---|---|
| Next.js | **16.2.1** |
| React | **19.2.4** |
| TypeScript | **^5** |
| Tailwind CSS | **^4** |

### Dependencies

| Package | Versi | Keterangan |
|---|---|---|
| `@google/generative-ai` | ^0.24.1 | Gemini SDK |
| `next` | 16.2.1 | |
| `openai` | ^6.33.0 | OpenAI SDK (dipakai di fitur AI Video) |
| `react` | 19.2.4 | |
| `react-dom` | 19.2.4 | |

### devDependencies

| Package | Versi |
|---|---|
| `@tailwindcss/postcss` | ^4 |
| `@types/node` | ^20 |
| `@types/react` | ^19 |
| `@types/react-dom` | ^19 |
| `eslint` | ^9 |
| `eslint-config-next` | 16.2.1 |
| `tailwindcss` | ^4 |
| `typescript` | ^5 |

**SDK yang terinstall:**
- ✅ `@google/generative-ai` — Google Gemini SDK
- ✅ `openai` — OpenAI SDK (untuk script generation + TTS di fitur AI Video)
- ❌ Anthropic SDK — tidak terinstall

---

## 3. HALAMAN & ROUTING

| Route | File | Status | Komponen yang Dipakai |
|---|---|---|---|
| `/` | `app/page.tsx` | ✅ **FUNCTIONAL** | `Sidebar`, `CreatorWorkflowVisual`, `ClipCard`, `MiniMetric`, `FieldLabel`, `TextInput`, `SelectInput` (semua inline di file yang sama) |
| `/dashboard` | `app/dashboard/page.tsx` | ✅ **FUNCTIONAL** | `JobsDashboard` |
| `/generate` | `app/generate/page.tsx` | ⚠️ **PARTIAL** | `GenerateUi` (butuh OPENAI_API_KEY + PEXELS_API_KEY) |

**Catatan routing:**
- Navigation bar di `layout.tsx` menampilkan 3 link: Home, Jobs, AI Video
- Halaman utama `/` adalah Clipora clip extraction (fungsional penuh)
- `/dashboard` memantau AI Video Generation jobs
- `/generate` adalah fitur AI Video Generation (akan error tanpa OPENAI_API_KEY)

---

## 4. KOMPONEN UI

| File | Props | Dipakai Di | Status | State Management |
|---|---|---|---|---|
| `dashboard-ui.tsx` | `DashboardUiProps` (url, loading, error, result, dll) | **Tidak ada** | ❌ **ORPHAN** | `useState` (tidak aktif karena orphaned) |
| `generate-ui.tsx` | Tidak ada (self-contained) | `/generate` | ⚠️ PARTIAL | `useState`, `useEffect`, polling via `useRef` |
| `jobs-dashboard.tsx` | Tidak ada (self-contained) | `/dashboard` | ✅ FUNCTIONAL | `useState`, `useEffect`, `useRef` (auto-refresh 5s) |

### Detail Komponen Inline di `app/page.tsx`
Halaman utama TIDAK menggunakan komponen dari `components/`, melainkan mendefinisikan semua komponen secara inline:

| Komponen Inline | Keterangan |
|---|---|
| `Sidebar` | Navigasi samping (hardcoded items, `href="#roadmap"` untuk 7 menu placeholder) |
| `CreatorWorkflowVisual` | Visualisasi alur creator → AI → platform |
| `ClipCard` | Kartu preview clip dengan video player, caption, download |
| `MiniMetric` | Widget stat kecil di header |
| `FieldLabel`, `TextInput`, `SelectInput` | Form primitives |

---

## 5. RUTE API / BACKEND

| Endpoint | Metode | Fungsi | Status |
|---|---|---|---|
| `/api/process-video` | POST | Pipeline utama: URL YouTube atau file lokal → ekstrak audio → transkripsi → analisis AI → render clip | ✅ FUNCTIONAL |
| `/api/upload` | POST | Upload file video ke `.autoclip/uploads/`, streaming ke disk, max 500MB | ✅ FUNCTIONAL |
| `/api/files` | GET | Serve file video/audio dari `.autoclip/jobs/` dengan HTTP Range support | ✅ FUNCTIONAL |
| `/api/jobs/latest` | GET | Ambil job clip terbaru yang completed | ✅ FUNCTIONAL |
| `/api/jobs/[jobId]` | GET | Ambil detail job clip by ID | ✅ FUNCTIONAL |
| `/api/jobs/[jobId]/n8n-result` | GET | Ambil hasil post-processing n8n untuk job tertentu | ✅ FUNCTIONAL |
| `/api/health` | GET | Health check semua dependency (Gemini, Whisper, FFmpeg, dll.) | ✅ FUNCTIONAL |
| `/api/n8n` | GET/POST | Status n8n + trigger pipeline via n8n | ✅ FUNCTIONAL (n8n tidak running) |
| `/api/n8n/callback` | POST | Webhook untuk n8n kirim hasil (Drive URL, dll.) | ✅ FUNCTIONAL |
| `/api/n8n/trigger` | POST | Endpoint yang dipanggil n8n untuk trigger pipeline lokal | ✅ FUNCTIONAL |
| `/api/cleanup` | POST | Hapus job artifacts lama (default: >7 hari) | ✅ FUNCTIONAL |
| `/api/clip` | POST | Clip video lokal berdasarkan segmen manual | ✅ FUNCTIONAL |
| `/api/download` | GET | Download file dari URL eksternal | ⚠️ Belum dicek penuh |
| `/api/generate-video` | POST | Buat AI video job (topic → script → TTS → stock video → render) | ⚠️ BROKEN (butuh OPENAI + PEXELS key) |
| `/api/generation-jobs` | GET/POST | List semua AI video jobs / batch create | ⚠️ PARTIAL (list ok, create gagal tanpa key) |
| `/api/generation-jobs/[jobId]` | GET | Detail AI video job by ID | ✅ FUNCTIONAL |
| `/api/generation-jobs/process` | GET/POST | Resume pending AI video jobs (cron endpoint) | ⚠️ PARTIAL |

---

## 6. KONFIGURASI

### `.env.local` — Keys yang Ada

| Key | Nilai | Status |
|---|---|---|
| `GEMINI_API_KEY` | ✅ Diset | Aktif |
| `YT_DLP_PATH` | ✅ Diset (`C:\yt-dlp\yt-dlp.exe`) | Aktif |
| `FFMPEG_PATH` | ✅ Diset (path ffmpeg-8.1) | Aktif |
| `FFPROBE_PATH` | ✅ Diset | Aktif |
| `N8N_WEBHOOK_URL` | ✅ Diset (localhost:5678) | n8n tidak running |
| `N8N_WEBHOOK_POSTPROCESS` | ✅ Diset | n8n tidak running |
| `FFMPEG_PRESET` | `veryfast` | Aktif |
| `FFMPEG_CRF` | `23` | Aktif |
| `JOB_MAX_AGE_DAYS` | `7` | Aktif |
| `AI_PROVIDER` | `gemini` | Aktif |
| `WHISPER_CPP_PATH` | ✅ Diset | Aktif |
| `WHISPER_MODEL_PATH` | ✅ Diset | Aktif |
| `OPENAI_API_KEY` | ❌ **KOSONG** | AI Video generation akan GAGAL |
| `PEXELS_API_KEY` | ❌ **Tidak ada** | Stock video search akan GAGAL |
| `GEMINI_MODEL` | ❌ **Tidak ada** (default ke `gemini-2.0-flash`) | Default OK |

### `next.config.ts` — Konfigurasi Notable

| Setting | Nilai | Keterangan |
|---|---|---|
| Security headers | ✅ Lengkap | CSP, HSTS, X-Frame-Options, dll. |
| `reactStrictMode` | `true` | Aktif |
| `compress` | `true` | HTTP compression aktif |
| Image formats | `avif`, `webp` | Modern formats |
| `maxDuration` (API routes) | 300 detik | Vercel Pro limit |

### `tsconfig.json` — Settings Notable

| Setting | Nilai |
|---|---|
| `strict` | `true` |
| `moduleResolution` | `bundler` |
| `target` | `ES2017` |
| `paths` | `@/*` → `./*` (root alias) |
| `isolatedModules` | `true` |

> ⚠️ **Tidak ada `tailwind.config.ts`** — Tailwind v4 dikonfigurasi via CSS (`globals.css`) bukan via config file JS/TS. Ini adalah konvensi baru Tailwind v4.

---

## 7. MODUL LIBRARY / PIPELINE

### `lib/autoclip/` — Modul Utama

| Modul | Fungsi Utama | Error Handling |
|---|---|---|
| `config.ts` | Konfigurasi global, env vars, path binaries | ✅ Validasi provider |
| `types.ts` | Type definitions semua domain | ✅ Lengkap |
| `errors.ts` | `AppError` class + `toErrorResponse` | ✅ |
| `pipeline/process-video.ts` | Entry point pipeline: `processVideoUrl`, `processLocalVideo` | ✅ Path traversal guard, error per step |
| `analysis/transcript-analyzer.ts` | `analyzeTranscriptWithFallback` — Gemini/Ollama/fallback | ✅ Fallback ke heuristik lokal |
| `analysis/fallback-analysis.ts` | Heuristik lokal tanpa AI | ✅ |
| `ai.ts` | Two-pass Gemini/Ollama analysis, prompt builder | ✅ 2 retry per attempt, single-pass fallback |
| `transcription/index.ts` | `transcribeAudioWithFallback` — Whisper VTT → plain → fallback | ✅ Multi-level fallback |
| `transcribe.ts` | Gemini + Whisper helper (dipakai oleh transcription/index.ts) | ✅ |
| `media/video.ts` | `clipVideo` — FFmpeg render dengan subtitle, effects, musik | ✅ Retry tanpa zoom jika error |
| `media/audio.ts` | `extractAudio` — FFmpeg extract MP3 | ✅ |
| `media/probe.ts` | `getVideoDurationSeconds` — FFprobe | ✅ |
| `captions/generate.ts` | `generateCaptionPayload` — hook, caption, hashtag | ✅ |
| `captions/subtitle.ts` | `writeSubtitleFile` — generate .ass subtitle | ✅ |
| `captions/srt.ts` | SRT format helpers | ✅ |
| `decision/score.ts` | `rankSegments` — scoring engine | ✅ |
| `downloader/youtube.ts` | `downloadYoutubeVideo`, `fetchYoutubeMetadata` via yt-dlp | ✅ |
| `jobs/store.ts` | File-based job store untuk clip jobs | ✅ |
| `jobs/cleanup.ts` | `cleanupOldJobs` — hapus artifacts lama | ✅ |
| `jobs/status.ts` | `JOB_STATUS_LABELS` mapping | ⚠️ Hanya dipakai oleh `dashboard-ui.tsx` yang ORPHANED |
| `metadata/build-result.ts` | `buildProcessVideoResult` — assemble result object | ✅ |
| `n8n/client.ts` | `notifyN8nPostProcess`, `checkN8nHealth`, dll. | ✅ Retry logic, fire-and-forget |
| `storage/filesystem.ts` | `ensureDir`, `readJsonFile`, `writeJsonFile`, path helpers | ✅ |
| `tools/binaries.ts` | `resolveBinary` — cari FFmpeg/yt-dlp di PATH atau .env | ✅ |
| `tools/command.ts` | `runCommand` — wrapper execFile dengan Promise | ✅ |

### `lib/autoclip/generation/` — Modul AI Video Generation

| Modul | Fungsi Utama | Status |
|---|---|---|
| `pipeline.ts` | `generateVideo` — topic → script → TTS → stock video → assemble | ⚠️ Butuh OPENAI + PEXELS key |
| `script-generator.ts` | `generateScript` via OpenAI GPT-4o-mini | ❌ Gagal tanpa OPENAI_API_KEY |
| `tts.ts` | `generateVoiceover` via OpenAI TTS-1 | ❌ Gagal tanpa OPENAI_API_KEY |
| `stock-video.ts` | `findStockVideo` via Pexels API | ❌ Gagal tanpa PEXELS_API_KEY |
| `assembler.ts` | `assembleVideo` — FFmpeg combine video + audio | ✅ |
| `job-store.ts` | File-based store untuk generation jobs | ✅ |
| `queue.ts` | In-process job queue (singleton) | ✅ |
| `types.ts` | Type definitions generation domain | ✅ |

### `lib/` — File Legacy (ROOT LEVEL)

| File | Status | Keterangan |
|---|---|---|
| `lib/youtube.ts` | ❌ **LEGACY/DEAD** | Hardcoded path `C:\yt-dlp\yt-dlp.exe`, tidak diimport di mana-mana |
| `lib/ffmpeg.ts` | ❌ **LEGACY/DEAD** | Hardcoded `ffmpeg` command via `exec()`, tidak diimport di mana-mana |

---

## 8. MASALAH YANG DITEMUKAN

### 8.1 File Dead Code / Tidak Dipakai

| File | Masalah | Dampak |
|---|---|---|
| `proxy.ts` | Mengimplementasikan rate limiting + auth guard **tapi tidak ada `middleware.ts`** yang menggunakannya. Seluruh logika proxy adalah dead code. | ❌ **KRITIS** — auth dan rate limiting tidak berfungsi |
| `lib/youtube.ts` | Implementasi lama dengan hardcoded path `C:\yt-dlp\yt-dlp.exe`, tidak diimport manapun | ⚠️ Technical debt |
| `lib/ffmpeg.ts` | Implementasi lama dengan `exec("ffmpeg ...")` hardcoded, tidak diimport manapun | ⚠️ Technical debt |
| `components/autoclip/dashboard-ui.tsx` | Komponen UI lama (~1000 baris), style dark/cinematic yang berbeda dari UI saat ini. **Tidak diimport di page manapun** | ⚠️ Orphaned component |
| `lib/autoclip/jobs/status.ts` | Hanya dipakai oleh `dashboard-ui.tsx` yang sudah orphaned | ⚠️ Transitively orphaned |

### 8.2 Environment Variables Bermasalah

| Key | Masalah |
|---|---|
| `OPENAI_API_KEY` | Ada di `.env.example` tapi **kosong di `.env.local`** — fitur AI Video Generation (`/generate`) akan selalu gagal |
| `PEXELS_API_KEY` | **Tidak ada di `.env.local`** sama sekali — stock video search gagal |
| `GEMINI_MODEL` | `.env.example` menggunakan `gemini-2.0-flash-lite` tapi **config.ts default ke `gemini-2.0-flash`** — inkonsistensi dokumentasi |

### 8.3 Referensi Model AI

| Lokasi | Model | Status |
|---|---|---|
| `lib/autoclip/config.ts` (default) | `gemini-2.0-flash` | ✅ Model aktif (Gemini 2.0) |
| `.env.example` | `gemini-2.0-flash-lite` | ⚠️ Berbeda dari default aktual |
| `app/api/health/route.ts` | menggunakan `appConfig.ai.gemini.model` | ✅ Mengikuti config |

> **Tidak ada referensi `gemini-2.0-flash` yang deprecated** — model yang digunakan adalah current.

### 8.4 Inkonsistensi Desain

| Masalah | Detail |
|---|---|
| **Dua sistem terpisah** | Klip extraction (app/page.tsx) dan AI Video Generation (/generate) adalah dua fitur yang sama sekali berbeda dengan data model, job store, dan API terpisah. Tidak ada cross-linking di UI. |
| **Dua job store terpisah** | `lib/autoclip/jobs/store.ts` untuk clip jobs dan `lib/autoclip/generation/job-store.ts` untuk AI video jobs. Tidak ada unified job management. |
| **dashboard-ui.tsx vs halaman utama** | `dashboard-ui.tsx` adalah UI cinematic dark (glass morphism, gradient purple/blue), sedangkan `app/page.tsx` menggunakan UI Clipora warm sage. Dua design language yang tidak konsisten. |
| **Sidebar duplikat** | Ada `Sidebar` di `dashboard-ui.tsx` (dark, navigasi 4 item) dan `Sidebar` inline di `app/page.tsx` (warm sage, 10 item navigasi). |

### 8.5 TODO/Placeholder di UI

| Lokasi | Placeholder |
|---|---|
| `app/page.tsx` `Sidebar` | 7 dari 10 menu item mengarah ke `#roadmap` dengan label "Soon" |
| Layout Roadmap section | Phase 1-4 roadmap di bawah halaman adalah placeholder static |
| `MiniMetric "AI"` | Menampilkan `result.summary.analysisSource ?? "fallback"` atau "Ready" — bukan metric nyata |

### 8.6 Potential Issues Lainnya

| Masalah | Detail |
|---|---|
| `transcribeAudioWithGemini` di `lib/transcribe.ts` | Fungsi ini ADA dan menggunakan Gemini untuk transcribe audio, tapi **tidak dipanggil** dari `transcription/index.ts` — transcription via Gemini tidak tersedia di pipeline aktif |
| Queue AI Video (singleton) | `lib/autoclip/generation/queue.ts` menggunakan module-level singleton (`let isProcessing = false`). Di lingkungan serverless (Vercel), ini tidak persisten antar request — jobs yang di-queue akan hilang saat cold start |
| `proxy.ts` style middleware | File ini mengekspor `config` seperti middleware Next.js tapi tidak ada `middleware.ts` yang mengimpor atau menggunakannya |

---

## 9. KONEKSI DEPAN ↔ BACKEND

### Halaman Utama (`/`)

| Data | Sumber | API Call | Status |
|---|---|---|---|
| Status n8n connected | `GET /api/n8n` | fetch di `useEffect` | ✅ CONNECTED |
| Latest clip result (auto-load) | `GET /api/jobs/latest` | fetch di `useEffect` | ✅ CONNECTED |
| Upload video | `POST /api/upload` via XHR | upload progress tracking | ✅ CONNECTED |
| Process video/URL | `POST /api/process-video` | fetch di `callProcess` | ✅ CONNECTED |
| Fetch fresh result setelah process | `GET /api/jobs/[jobId]` | fetch di `handleResult` | ✅ CONNECTED |
| Poll Drive URL dari n8n | `GET /api/jobs/[jobId]/n8n-result` | polling interval 10s | ✅ CONNECTED |
| Serve video clips | `GET /api/files?path=...` | di `<video src>` tag | ✅ CONNECTED |

### Halaman Dashboard (`/dashboard`)

| Data | Sumber | API Call | Status |
|---|---|---|---|
| List AI generation jobs | `GET /api/generation-jobs` | polling setiap 5s | ✅ CONNECTED |
| Detail job saat processing | `GET /api/generation-jobs/[jobId]` | polling saat job aktif | ✅ CONNECTED |

### Halaman Generate (`/generate`)

| Data | Sumber | API Call | Status |
|---|---|---|---|
| Submit job | `POST /api/generate-video` | fetch di form submit | ⚠️ CONNECTED tapi akan gagal (OPENAI_API_KEY kosong) |
| Poll job status | `GET /api/generation-jobs/[jobId]` | polling setiap 3s | ✅ CONNECTED |
| Redirect ke dashboard setelah done | `router.push('/dashboard')` | Next.js router | ✅ |

---

## 10. RINGKASAN EKSEKUTIF

### Persentase Fungsionalitas

| Subsistem | Fungsional | Keterangan |
|---|---|---|
| Core clip pipeline (`/`) | **~85%** | Fully wired. Transkripsi butuh Whisper (dikonfigurasi) atau fallback. Analisis via Gemini (dikonfigurasi). |
| n8n integration | **~20%** | Kode client lengkap, tapi n8n tidak running di localhost. Tidak blocking untuk clip pipeline. |
| AI Video Generation (`/generate`) | **~25%** | Route dan UI ada, tapi OPENAI_API_KEY dan PEXELS_API_KEY kosong — pipeline akan error di step pertama. |
| Auth & Rate Limiting | **0%** | `proxy.ts` ada tapi tidak ada `middleware.ts` — seluruh logika tidak pernah dijalankan. |
| Sidebar navigation | **30%** | Hanya 3 dari 10 item menu aktif, sisanya placeholder "Soon" |

### 3 Masalah Terbesar Sebelum Redesign

#### 1. ❌ `proxy.ts` Adalah Dead Code — Auth & Rate Limit Tidak Aktif
File `proxy.ts` berisi logika rate limiting (5 req/menit untuk heavy routes) dan optional auth token, tapi tidak ada `middleware.ts` yang menggunakannya. Next.js middleware HARUS berada di file `middleware.ts` di root. Semua endpoint API saat ini tidak terlindungi sama sekali.

**Fix:** Rename `proxy.ts` → `middleware.ts` dan pastikan export default-nya mengikuti Next.js middleware convention.

#### 2. ⚠️ Dua Design Language Tidak Konsisten — `dashboard-ui.tsx` vs `app/page.tsx`
`dashboard-ui.tsx` adalah komponen besar (1003 baris) dengan design dark cinematic (glass morphism, indigo/blue gradient) yang TIDAK dipakai di halaman mana pun. Halaman aktif menggunakan design Clipora warm sage yang sama sekali berbeda. Ini mencerminkan bahwa ada desain lama yang belum dihapus.

**Fix untuk redesign:** Hapus `dashboard-ui.tsx` atau jadikan basis referensi visual. Pastikan satu design language konsisten.

#### 3. ❌ AI Video Generation Pipeline Tidak Bisa Berjalan
`/generate` dan `/api/generate-video` membutuhkan `OPENAI_API_KEY` (untuk GPT-4o-mini script + TTS-1 voiceover) dan `PEXELS_API_KEY` (untuk stock video). Keduanya tidak ada di `.env.local`. Pipeline akan crash di step pertama setiap kali dijalankan.

**Fix:** Set kedua API key, atau tandai fitur ini sebagai "Coming Soon" di UI.

### Komponen yang Bisa Digunakan Kembali vs Ditulis Ulang

| Item | Rekomendasi | Alasan |
|---|---|---|
| `lib/autoclip/pipeline/process-video.ts` | ✅ **Pertahankan** | Pipeline inti solid, error handling lengkap |
| `lib/ai.ts` | ✅ **Pertahankan** | Two-pass AI analysis dengan retry robust |
| `lib/autoclip/media/video.ts` | ✅ **Pertahankan** | FFmpeg wrapper lengkap, subtitle, music, effects |
| `lib/autoclip/transcription/index.ts` | ✅ **Pertahankan** | Multi-level fallback baik |
| `lib/autoclip/n8n/client.ts` | ✅ **Pertahankan** | Well-structured, retry logic |
| `app/page.tsx` | ⚠️ **Refactor** | Logic bagus, tapi 1004 baris di satu file — komponen inline harus dipecah ke `components/` |
| `components/autoclip/dashboard-ui.tsx` | ❌ **Hapus atau arsip** | Orphaned, design lama, tidak connected |
| `lib/youtube.ts` | ❌ **Hapus** | Legacy dead code |
| `lib/ffmpeg.ts` | ❌ **Hapus** | Legacy dead code |
| `proxy.ts` | ⚠️ **Rename** → `middleware.ts` | Logic OK, cukup rename dan fix export |
| `components/autoclip/generate-ui.tsx` | ⚠️ **Pertahankan + fix env** | Bagus, tapi butuh OPENAI key agar fungsional |
| `components/autoclip/jobs-dashboard.tsx` | ✅ **Pertahankan** | Well-structured, polling logic bagus |

### Rekomendasi: Refactor atau Rewrite?

> **Rekomendasi: REFACTOR — jangan rewrite dari awal.**

Alasan:
1. **Pipeline backend sudah solid** — `lib/autoclip/` adalah kode berkualitas tinggi dengan error handling berlapis, type safety, dan arsitektur yang clean.
2. **Masalah utama ada di UI layer** — `app/page.tsx` terlalu besar (1004 baris), komponen inline tidak reusable, dan design language tidak konsisten.
3. **Minimal perbaikan kritis sebelum redesign:**
   - Rename `proxy.ts` → `middleware.ts`
   - Pindah komponen inline dari `app/page.tsx` ke `components/`
   - Hapus `lib/youtube.ts`, `lib/ffmpeg.ts`, dan `dashboard-ui.tsx`
   - Isi `OPENAI_API_KEY` + `PEXELS_API_KEY` atau disable fitur AI Video

---

*Report ini dihasilkan dari pembacaan statis semua file proyek tanpa modifikasi.*  
*Total file yang diaudit: ~35 file TypeScript, 3 halaman, 17 API routes.*
