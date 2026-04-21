# Ringkasan AutoClip AI Agent OS MVP

## 1. Tujuan

MVP ini membangun pipeline lokal untuk mengubah 1 URL YouTube menjadi 3-5 short clips yang siap dipakai untuk workflow konten.

Alur utama:

`Input URL -> Download -> Extract Audio -> Transcribe -> Analyze -> Score -> Clip -> Return JSON`

## 2. Yang Sudah Dibangun

- Frontend Next.js App Router untuk input URL dan menampilkan hasil proses
- API `POST /api/process-video` untuk memproses video end-to-end
- API `GET /api/jobs/[jobId]` untuk membaca status/hasil job yang tersimpan
- Modular service layer di `lib/autoclip`
- Penyimpanan job dan artefak lokal di `.autoclip/jobs/<jobId>/`
- Fallback aman jika OpenAI tidak tersedia atau gagal
- Validasi binary `yt-dlp`, `ffmpeg`, dan `ffprobe`
- Decision engine dengan formula PRD:
  - `score = (emotion * 0.4) + (keyword * 0.3) + (curiosity * 0.3)`

## 3. Struktur Folder Utama

```text
app/
  api/
    jobs/[jobId]/route.ts
    process-video/route.ts
  globals.css
  layout.tsx
  page.tsx

lib/autoclip/
  analysis/
  captions/
  decision/
  downloader/
  jobs/
  media/
  metadata/
  pipeline/
  storage/
  tools/
  transcription/
  config.ts
  errors.ts
  types.ts
```

## 4. Fungsi Tiap Modul

- `downloader`
  - download video YouTube via `yt-dlp`
- `media`
  - extract audio, probe duration, generate clips dengan `ffmpeg`
- `transcription`
  - transkripsi OpenAI, fallback transcript lokal jika API tidak siap
- `analysis`
  - analisis transcript dengan OpenAI, fallback heuristik lokal
- `decision`
  - scoring dan ranking segmen terbaik
- `captions`
  - hook, caption, hashtag, subtitle payload versi MVP
- `jobs`
  - status, warning, dan persistensi job
- `storage`
  - util filesystem untuk JSON dan folder job
- `pipeline`
  - orchestration end-to-end dari URL sampai clips

## 5. Response API MVP

Response sukses dari `POST /api/process-video` mencakup:

- `success`
- `job`
- `summary`
- `transcript`
- `segments`
- `clips`
- `nextSteps`
- `warnings`

## 6. UI MVP

Homepage sekarang menampilkan:

- input URL
- status loading
- error/warning
- transcript summary
- ranked segments
- generated clips
- score breakdown

## 7. Konfigurasi Lokal

File env:

- `.env.example`
- `.env.local`

Variable yang dipakai:

- `OPENAI_API_KEY`
- `FFMPEG_PATH`
- `FFPROBE_PATH`
- `YT_DLP_PATH`

## 8. Cara Menjalankan

```bash
npm install
npm run dev
```

Quality checks:

```bash
npm run lint
npm run build
```

## 9. Dependensi/Binary yang Dibutuhkan

- Node.js 20+
- `ffmpeg`
- `ffprobe`
- `yt-dlp`
- OpenAI API key opsional

Catatan:

- Jika `OPENAI_API_KEY` kosong, pipeline tetap bisa dites dengan fallback lokal
- Jika `yt-dlp` tidak ada, API akan memberi error terstruktur dengan instruksi yang jelas
- Jika `ffmpeg` / `ffprobe` tidak ada, API juga akan memberi error terstruktur

## 10. Artefak Output

Job baru disimpan di:

```text
.autoclip/jobs/<jobId>/
  job.json
  result.json
  artifacts/
    source.*
    audio.mp3
    transcript.json
    segments.json
    clip-*.mp4
```

## 11. Batasan Phase 1

Belum dibangun:

- analytics dashboard
- upload ke platform sosial
- queue worker / BullMQ
- database / Supabase / PostgreSQL
- storage cloud
- n8n automation
- subtitle burn-in rendering final

## 12. File Penting

- `app/page.tsx`
- `app/api/process-video/route.ts`
- `app/api/jobs/[jobId]/route.ts`
- `lib/autoclip/pipeline/process-video.ts`
- `lib/autoclip/decision/score.ts`
- `lib/autoclip/transcription/index.ts`
- `lib/autoclip/analysis/transcript-analyzer.ts`
- `README.md`

## 13. Folder Handoff Ini

Folder ini dibuat untuk merangkum hasil implementasi dalam satu tempat.

Isi folder ini:

- `RINGKASAN.md` -> ringkasan lengkap MVP
- `legacy-root-artifacts/` -> arsip artefak lama dari root project yang tidak dipakai pipeline baru
