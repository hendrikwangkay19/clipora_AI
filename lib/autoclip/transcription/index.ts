import fs from "fs";
import path from "path";
import { transcribeAudioWithLocalWhisper } from "@/lib/transcribe";
import { appConfig } from "@/lib/autoclip/config";
import { runCommand } from "@/lib/autoclip/tools/command";
import { PipelineWarning, TranscriptChunk, TranscriptResult } from "@/lib/autoclip/types";

function isLocalWhisperReady() {
  return Boolean(appConfig.ai.whisper.binaryPath && appConfig.ai.whisper.modelPath);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function summarize(chunks: TranscriptChunk[]): string {
  return chunks.slice(0, 3).map((c) => c.text).join(" ").slice(0, 280);
}

function splitIntoChunks(text: string, durationSeconds: number): TranscriptChunk[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const safeDuration = Math.max(1, durationSeconds);
  const chunkDuration = safeDuration / Math.max(sentences.length, 1);

  return sentences.length > 0
    ? sentences.map((sentence, i) => ({
        start: Math.round(i * chunkDuration * 10) / 10,
        end:   Math.round((i + 1) * chunkDuration * 10) / 10,
        text:  sentence,
      }))
    : [{ start: 0, end: safeDuration, text }];
}

function buildFallbackChunks(durationSeconds: number): TranscriptChunk[] {
  const safe = Math.max(45, Math.round(durationSeconds) || 90);
  const size = Math.max(15, Math.floor(safe / 5));
  const texts = [
    "Bagian awal biasanya menjadi hook utama: perhatikan janji, masalah, atau konteks yang memancing rasa ingin tahu.",
    "Bagian berikutnya diperlakukan sebagai momen edukatif yang dapat dibuat menjadi insight singkat untuk audiens.",
    "Bagian tengah dianalisis sebagai potensi cerita, konflik, atau perubahan sudut pandang yang cocok untuk short clip.",
    "Bagian ini bisa menjadi konten tips karena memuat penjelasan yang dapat dipotong menjadi langkah praktis.",
    "Bagian akhir sering cocok untuk rangkuman, CTA, atau penutup yang mengarahkan audiens ke aksi berikutnya.",
  ];

  return texts.map<TranscriptChunk>((text, i) => ({
    start: i * size,
    end:   Math.min((i + 1) * size, safe),
    text,
  }));
}

// ─── VTT Parsing (timestamp nyata dari Whisper) ───────────────────────────────

function parseVTTTime(timeStr: string): number {
  // Accepts HH:MM:SS.mmm or MM:SS.mmm
  const parts = timeStr.trim().split(":");
  if (parts.length === 3) {
    return parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
  }
  if (parts.length === 2) {
    return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
  }
  return NaN;
}

function parseVTT(vttText: string): TranscriptChunk[] {
  const chunks: TranscriptChunk[] = [];

  for (const block of vttText.split(/\n\n+/)) {
    const lines = block.trim().split("\n");
    const timeIdx = lines.findIndex((l) => l.includes("-->"));
    if (timeIdx === -1) continue;

    const [startStr, endStr] = lines[timeIdx].split("-->").map((s) => s.trim());
    const start = parseVTTTime(startStr);
    const end   = parseVTTTime(endStr);
    if (!Number.isFinite(start) || !Number.isFinite(end)) continue;

    const text = lines.slice(timeIdx + 1).join(" ").replace(/<[^>]+>/g, "").trim();
    if (!text) continue;

    chunks.push({ start, end, text });
  }

  return chunks;
}

// ─── Whisper Caller ───────────────────────────────────────────────────────────

async function convertToWav(audioPath: string): Promise<string> {
  const ffmpegPath = appConfig.binaries.ffmpeg;
  if (!ffmpegPath) throw new Error("FFMPEG_PATH belum dikonfigurasi");

  const wavPath = path.join(
    path.dirname(audioPath),
    `${path.basename(audioPath, path.extname(audioPath))}-whisper.wav`
  );

  // Whisper.cpp hanya menerima WAV 16kHz mono 16-bit PCM
  await runCommand(ffmpegPath, [
    "-y", "-i", audioPath,
    "-ar", "16000",
    "-ac", "1",
    "-c:a", "pcm_s16le",
    wavPath,
  ], { maxBuffer: 1024 * 1024 * 64 });

  if (!fs.existsSync(wavPath)) throw new Error("Konversi ke WAV gagal");
  console.log("[transcribe] Konversi WAV selesai:", wavPath);
  return wavPath;
}

async function transcribeWithWhisperVTT(options: {
  audioPath: string;
  language?: string;
}): Promise<TranscriptChunk[]> {
  const { binaryPath, modelPath } = appConfig.ai.whisper;
  if (!binaryPath || !modelPath) throw new Error("Whisper belum dikonfigurasi");

  // Konversi ke WAV 16kHz mono 16-bit PCM — format satu-satunya yang didukung whisper.cpp
  const wavPath = await convertToWav(options.audioPath);

  const outputBase = path.join(
    path.dirname(wavPath),
    `whisper-${path.basename(wavPath, ".wav")}-${Date.now()}`
  );

  const args = [
    "-m", modelPath,
    "-f", wavPath,
    "-ovtt",
    "-of", outputBase,
    "--max-len", "1",
    "--split-on-word",
  ];
  if (options.language && options.language !== "auto") args.push("-l", options.language);

  console.log("[transcribe] Whisper VTT:", binaryPath);
  await runCommand(binaryPath, args, { maxBuffer: 1024 * 1024 * 64 });

  // Hapus WAV sementara setelah selesai
  try { fs.unlinkSync(wavPath); } catch { /* abaikan */ }

  const vttPath = `${outputBase}.vtt`;
  if (!fs.existsSync(vttPath)) throw new Error("Whisper tidak menghasilkan file .vtt");

  const chunks = parseVTT(fs.readFileSync(vttPath, "utf8"));
  try { fs.unlinkSync(vttPath); } catch { /* abaikan */ }
  if (chunks.length === 0) throw new Error("VTT kosong atau tidak bisa di-parse");

  return chunks;
}

async function tryLocalWhisper(options: {
  audioPath: string;
  durationSeconds: number;
  language?: string;
}): Promise<TranscriptResult> {
  // Coba VTT dulu untuk timestamp nyata per segmen
  try {
    const chunks = await transcribeWithWhisperVTT(options);
    const text   = chunks.map((c) => c.text).join(" ");
    console.log(`[transcribe] Whisper VTT OK — ${chunks.length} segmen`);
    return { text, chunks, source: "local", language: options.language ?? "id", summary: summarize(chunks) };
  } catch (err) {
    console.warn("[transcribe] VTT gagal, coba plain text:", err instanceof Error ? err.message : err);
  }

  // Fallback ke -otxt jika VTT gagal, estimasi timestamp dari panjang video
  const text   = await transcribeAudioWithLocalWhisper(options.audioPath, options.language);
  const chunks = splitIntoChunks(text, options.durationSeconds);
  console.log(`[transcribe] Whisper plain text OK — ${chunks.length} segmen (timestamp estimasi)`);
  return { text, chunks, source: "local", language: options.language ?? "id", summary: summarize(chunks) };
}

// ─── Fallback Warning ─────────────────────────────────────────────────────────

function fallbackWarning(errors: string[]): PipelineWarning {
  if (!isLocalWhisperReady()) {
    return {
      step: "transcribing",
      message:
        "WHISPER_CPP_PATH dan WHISPER_MODEL_PATH belum dikonfigurasi. " +
        "Set kedua env var tersebut untuk transkripsi nyata.",
    };
  }
  return {
    step: "transcribing",
    message: errors.length
      ? `Transkripsi Whisper gagal (${errors.join(" | ")}). Menggunakan fallback sementara.`
      : "Whisper lokal tidak berhasil dijalankan. Menggunakan fallback sementara.",
  };
}

// ─── Public Entry ─────────────────────────────────────────────────────────────

export async function transcribeAudioWithFallback(options: {
  audioPath: string;
  durationSeconds: number;
  language?: string;
}): Promise<{ transcript: TranscriptResult; warning?: PipelineWarning }> {
  const errors: string[] = [];

  if (isLocalWhisperReady()) {
    try {
      return { transcript: await tryLocalWhisper(options) };
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }

  // Gemini tidak dipakai untuk transkripsi — langsung fallback
  const chunks = buildFallbackChunks(options.durationSeconds);
  return {
    transcript: {
      text:     chunks.map((c) => c.text).join(" "),
      chunks,
      source:   "fallback",
      language: "id",
      summary:  summarize(chunks),
    },
    warning: fallbackWarning(errors),
  };
}
