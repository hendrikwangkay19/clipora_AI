# ✂ AutoClip AI

> **Video panjang → short clips viral, otomatis.**  
> Upload video atau paste link YouTube — AI memilih momen terbaik, merender 1080p + subtitle.

[![Built with Claude Code](https://img.shields.io/badge/Built%20with-Claude%20Code-blueviolet?logo=anthropic&logoColor=white)](https://claude.ai/claude-code)
[![Next.js](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://typescriptlang.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-API-green?logo=openai)](https://platform.openai.com)

---

## Fitur Utama

- **Upload video langsung** (MP4, MOV, MKV, AVI — maks 500MB) atau paste YouTube URL
- **Transkripsi AI** via OpenAI Whisper atau Groq (fallback lokal jika API tidak ada)
- **Analisis viral** — AI memberi skor tiap segmen berdasarkan Emotion, Keyword, Curiosity
- **Render 1080p + subtitle otomatis** via FFmpeg
- **Caption & hashtag** langsung bisa dicopy untuk TikTok / Reels / Shorts
- **Jobs dashboard** — pantau status semua job yang pernah dijalankan
- **Health check endpoint** `/api/health` untuk monitoring

---

## Stack Teknologi

| Layer | Teknologi |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19 + Tailwind CSS 4 |
| AI — Analisis | OpenAI GPT-4o |
| AI — Transkripsi | OpenAI Whisper / Groq Whisper |
| Video Processing | FFmpeg + ffprobe |
| Download | yt-dlp |
| Storage | File system lokal (`.autoclip/jobs/`) |
| Development | Claude Code (Anthropic) |

---

## Prasyarat Sistem

- **Node.js** 20 atau lebih baru
- **ffmpeg** & **ffprobe** — untuk memotong dan memproses video
- **yt-dlp** — untuk download dari YouTube
- **OpenAI API Key** — opsional (ada fallback jika tidak ada)

### Download binary (Windows)

| Tool | Download |
|---|---|
| ffmpeg | [gyan.dev/ffmpeg/builds](https://www.gyan.dev/ffmpeg/builds/) |
| yt-dlp | [github.com/yt-dlp/releases](https://github.com/yt-dlp/yt-dlp/releases) |

---

## Setup & Menjalankan

```bash
# 1. Clone / download project
git clone <repo-url>
cd autoclip-ai

# 2. Install dependencies
npm install

# 3. Konfigurasi environment
cp .env.example .env.local
# Edit .env.local — isi path binary dan API keys

# 4. Jalankan development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## Konfigurasi Environment (`.env.local`)

```env
# AI — pilih salah satu atau keduanya
OPENAI_API_KEY=sk-...         # dari platform.openai.com
GROQ_API_KEY_AutoClip=gsk_... # dari console.groq.com (lebih cepat, gratis)

# Video generation (opsional)
PEXELS_API_KEY=...            # dari pexels.com/api

# Path binary (wajib jika tidak ada di PATH)
FFMPEG_PATH=C:\path\to\ffmpeg.exe
FFPROBE_PATH=C:\path\to\ffprobe.exe
YT_DLP_PATH=C:\path\to\yt-dlp.exe
```

> **Penting:** Jangan pernah commit `.env.local` ke git.  
> File ini sudah tercantum di `.gitignore`.

---

## Struktur Proyek

```
autoclip-ai/
├── app/
│   ├── api/
│   │   ├── health/         # GET /api/health — monitoring & deployment check
│   │   ├── process-video/  # POST — pipeline utama (URL atau localPath)
│   │   ├── upload/         # POST — upload file video
│   │   ├── jobs/           # GET /api/jobs/[jobId]
│   │   ├── generate-video/ # POST — generate video dari script AI
│   │   └── generation-jobs/
│   ├── dashboard/          # Halaman riwayat job
│   ├── generate/           # Halaman generate video AI
│   ├── globals.css
│   ├── layout.tsx          # Header navigasi + footer
│   └── page.tsx            # Halaman utama (upload + hasil clip)
│
├── components/autoclip/
│   ├── dashboard-ui.tsx
│   ├── generate-ui.tsx
│   └── jobs-dashboard.tsx
│
├── lib/autoclip/
│   ├── analysis/           # Analisis transcript (AI + fallback)
│   ├── captions/           # Generate SRT subtitle
│   ├── decision/           # Scoring algoritma
│   ├── downloader/         # YouTube downloader
│   ├── generation/         # Script, TTS, stock video, assembler
│   ├── jobs/               # Job store & status
│   ├── media/              # Audio/video processing
│   ├── metadata/           # Build result metadata
│   ├── pipeline/           # Orchestrator pipeline
│   ├── storage/            # Filesystem helpers
│   ├── tools/              # Binary resolver & command runner
│   ├── transcription/      # Whisper/Groq transcription
│   ├── config.ts
│   ├── errors.ts
│   └── types.ts
│
├── middleware.ts            # Rate limiting & security guard (Edge)
├── next.config.ts           # Security headers + image optimization
├── .gitignore               # Melindungi .env & artifacts dari git
├── .env.example             # Template environment — tanpa nilai nyata
└── LAUNCH_CHECKLIST.md      # Checklist produksi lengkap
```

---

## API Endpoints

### `POST /api/process-video`

Pipeline utama — YouTube URL atau file lokal.

```json
// Request
{
  "url": "https://www.youtube.com/watch?v=...",
  "aspectRatio": "16:9",
  "maxClips": 5,
  "burnSubtitles": true
}
```

```json
// Response sukses
{
  "success": true,
  "job": { "id": "...", "url": "..." },
  "clips": [
    {
      "id": "clip-1",
      "score": { "total": 2.4, "emotion": 1.0, "keyword": 0.8, "curiosity": 0.6 },
      "caption": { "hook": "...", "caption": "...", "hashtags": ["#viral"] }
    }
  ],
  "warnings": []
}
```

### `GET /api/health`

Cek status sistem sebelum deploy.

```bash
curl http://localhost:3000/api/health
```

```json
{
  "status": "healthy",
  "timestamp": "2026-04-11T10:00:00.000Z",
  "version": "0.1.0",
  "uptime": 42.1,
  "checks": [
    { "name": "OPENAI_API_KEY", "status": "ok", "message": "Present" },
    { "name": "ffmpeg", "status": "ok", "message": "Found at C:\\..." }
  ]
}
```

### `GET /api/jobs/[jobId]`

Ambil record job untuk polling atau riwayat.

---

## Scripts

```bash
npm run dev      # Development server (http://localhost:3000)
npm run build    # Production build
npm run start    # Jalankan production build
npm run lint     # ESLint check
```

---

## Output Artifacts

Setiap job menyimpan file di `.autoclip/jobs/<jobId>/`:

```
artifacts/
  source.*          # Video asli
  audio.mp3         # Audio hasil ekstraksi
  transcript.json   # Hasil transkripsi
  segments.json     # Segmen yang dipilih AI
  clip-1.mp4        # Clip hasil render
  clip-1.srt        # Subtitle SRT
job.json            # Metadata job
result.json         # Hasil lengkap
```

---

## Troubleshooting

**`yt-dlp not found`** — Pastikan path diset di `.env.local` atau binary ada di PATH.

**`ffmpeg not found`** — Cek `FFMPEG_PATH` dan `FFPROBE_PATH` di `.env.local`.

**`npm run build` gagal di Windows** — Jalankan ulang di terminal admin / PowerShell biasa (bukan restricted shell).

**Clip tidak keluar / error pipeline** — Cek `/api/health` untuk melihat komponen mana yang bermasalah.

---

## Roadmap Phase 2

- [ ] Queue worker (BullMQ + Redis) — pipeline non-blocking
- [ ] Database persistence (PostgreSQL + Prisma)
- [ ] Cloud storage (S3 / Cloudflare R2)
- [ ] Auth multi-user (NextAuth.js)
- [ ] Direct upload ke TikTok / IG / Shorts API
- [ ] Analytics dashboard

---

## Development

Proyek ini dikembangkan dengan bantuan **⬡ Claude Code** oleh Anthropic — AI coding agent yang membantu arsitektur, penulisan kode, audit keamanan, dan dokumentasi.

> Lihat [`LAUNCH_CHECKLIST.md`](./LAUNCH_CHECKLIST.md) untuk daftar lengkap langkah sebelum deployment.

---

*AutoClip AI · Personal Tool · v0.1.0 · Built with ⬡ Claude Code*
