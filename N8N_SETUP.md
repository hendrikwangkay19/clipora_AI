# AutoClip AI — Panduan Setup n8n

## Arsitektur

AutoClip AI menggunakan arsitektur **Orchestrator + Pipeline Lokal**:

```
┌──────────┐    trigger     ┌─────────┐    post-process    ┌──────────────┐
│ Next.js  │ ──────────────→│  n8n    │ ──────────────────→│ Google Drive │
│ Pipeline │    (webhook)   │ Workflow│    (upload, etc)   │ Notification │
│ (lokal)  │←──────────────│         │                    │   etc.       │
└──────────┘    callback    └─────────┘                    └──────────────┘
```

Pipeline lokal (FFmpeg + Gemini) memproses video. n8n menangani post-processing saja (upload Google Drive, notifikasi, scheduling).

## Prasyarat

- Node.js 18+
- n8n self-hosted berjalan di `http://localhost:5678`
- Google Cloud project dengan Drive API aktif (untuk upload Google Drive)

## Langkah 1: Konfigurasi Environment

Tambahkan ke `.env.local`:

```env
# URL webhook n8n (opsional, default localhost:5678)
N8N_WEBHOOK_URL=http://localhost:5678/webhook/video-process
N8N_WEBHOOK_POSTPROCESS=http://localhost:5678/webhook/post-process
```

## Langkah 2: Import Workflow ke n8n

Ada 2 workflow template di folder `n8n-workflows/`:

### Workflow 1: Post-Process (Upload Google Drive)

File: `n8n-workflows/01-post-process-upload-gdrive.json`

1. Buka n8n di `http://localhost:5678`
2. Klik **Add workflow** > **Import from file**
3. Pilih file `01-post-process-upload-gdrive.json`
4. Konfigurasi:
   - Buka node **Upload ke Google Drive**
   - Ganti `GANTI_DENGAN_FOLDER_ID_GOOGLE_DRIVE` dengan ID folder Google Drive tujuan
   - Ganti credential `GANTI_CREDENTIAL_ID` dengan OAuth2 credential Google Drive kamu
5. **Activate** workflow

### Workflow 2: Scheduler (YouTube Monitor)

File: `n8n-workflows/02-scheduler-youtube-monitor.json`

1. Import file `02-scheduler-youtube-monitor.json` ke n8n
2. Buka node **Daftar Video URL**
3. Tambahkan URL video YouTube yang ingin dimonitor
4. Sesuaikan interval scheduler (default: setiap 6 jam)
5. **Activate** workflow

## Langkah 3: Setup Google Drive OAuth2 di n8n

1. Buka [Google Cloud Console](https://console.cloud.google.com/)
2. Buat project baru atau pilih project yang ada
3. Aktifkan **Google Drive API**
4. Buat OAuth2 credentials:
   - Application type: **Web application**
   - Authorized redirect URI: `http://localhost:5678/rest/oauth2-credential/callback`
5. Di n8n:
   - Buka **Credentials** > **Add credential**
   - Pilih **Google Drive OAuth2 API**
   - Masukkan Client ID dan Client Secret dari Google Cloud
   - Klik **Connect** dan authorize

## API Endpoints

| Endpoint | Method | Deskripsi |
|----------|--------|-----------|
| `/api/n8n` | GET | Health check & status n8n |
| `/api/n8n` | POST | Proses video + auto kirim ke n8n |
| `/api/n8n/trigger` | POST | Untuk n8n men-trigger pipeline lokal |
| `/api/n8n/callback` | POST | Untuk n8n mengirim hasil post-processing |
| `/api/jobs/[id]/n8n-result` | GET | Ambil hasil Google Drive upload |

## Alur Kerja

### Mode Normal (dari UI)

1. User upload video atau tempel URL YouTube di web UI
2. Pipeline lokal memproses video (download, transkrip, analisis, render clip)
3. Setelah selesai, Next.js otomatis mengirim clip ke n8n webhook (`/webhook/post-process`)
4. n8n upload clip ke Google Drive
5. n8n callback ke `/api/n8n/callback` dengan link Google Drive
6. Frontend menampilkan link Google Drive di clip card

### Mode Scheduler (dari n8n)

1. n8n schedule trigger berjalan setiap X jam
2. n8n mengirim URL video ke `/api/n8n/trigger`
3. Pipeline lokal memproses video
4. Hasil otomatis dikirim kembali ke n8n untuk post-processing

## Troubleshooting

### n8n tidak terhubung

- Pastikan n8n berjalan: `curl http://localhost:5678/healthz`
- Cek env variable `N8N_WEBHOOK_URL` di `.env.local`
- Cek status via API: `GET /api/n8n`

### Upload Google Drive gagal

- Pastikan OAuth2 credential sudah di-authorize di n8n
- Pastikan folder ID Google Drive benar
- Cek log di n8n execution history

### Pipeline timeout

- Default timeout 5 menit (`maxDuration: 300`)
- Video yang sangat panjang mungkin perlu timeout lebih besar
- Pertimbangkan untuk membagi video menjadi bagian-bagian lebih kecil

## Mode Degradasi

Jika n8n tidak tersedia, AutoClip tetap berfungsi normal. Clip tetap bisa diakses secara lokal via `/api/files`. Status n8n ditampilkan di UI sebagai indikator koneksi.
