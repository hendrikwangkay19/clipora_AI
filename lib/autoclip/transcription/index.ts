/**
 * Transkripsi menggunakan Gemini → fallback heuristik lokal.
 */
import { transcribeAudio } from "@/lib/transcribe";
import { TranscriptChunk, TranscriptResult } from "@/lib/autoclip/types";

// ─── Key helper ───────────────────────────────────────────────────────────────

function isGeminiReady() {
  const k = process.env.GEMINI_API_KEY?.trim() ?? "";
  return k.length > 10;
}

// ─── Fallback heuristik ───────────────────────────────────────────────────────

function buildFallbackChunks(durationSeconds: number): TranscriptChunk[] {
  const safe = Math.max(45, Math.round(durationSeconds) || 90);
  const size = Math.max(15, Math.floor(safe / 4));
  const texts = [
    "Bagian pembuka menetapkan janji yang jelas dan menarik perhatian audiens.",
    "Bagian ini menyoroti wawasan praktis dan taktik yang bisa langsung diterapkan.",
    "Momen ini menambah rasa ingin tahu dengan sudut pandang yang mengejutkan.",
    "Bagian penutup menyampaikan kesimpulan dengan ringkasan yang kuat dan berkesan.",
  ];
  return texts.map<TranscriptChunk>((text, i) => ({
    start: i * size,
    end: Math.min((i + 1) * size, safe),
    text,
  }));
}

function summarize(chunks: TranscriptChunk[]) {
  return chunks.slice(0, 3).map((c) => c.text).join(" ").slice(0, 280);
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function transcribeWithGemini(
  audioPath: string,
  durationSeconds: number,
  language?: string
): Promise<TranscriptResult> {
  const text = await transcribeAudio(audioPath);

  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const chunkDuration = durationSeconds / Math.max(sentences.length, 1);
  const chunks: TranscriptChunk[] =
    sentences.length > 0
      ? sentences.map((s, i) => ({
          start: Math.round(i * chunkDuration * 10) / 10,
          end: Math.round((i + 1) * chunkDuration * 10) / 10,
          text: s,
        }))
      : [{ start: 0, end: durationSeconds, text }];

  return {
    text,
    chunks,
    source: "gemini",
    language: language ?? "id",
    summary: summarize(chunks),
  };
}

// ─── Public entry ─────────────────────────────────────────────────────────────

export async function transcribeAudioWithFallback(options: {
  audioPath: string;
  durationSeconds: number;
  language?: string;
}) {
  if (isGeminiReady()) {
    try {
      const transcript = await transcribeWithGemini(
        options.audioPath,
        options.durationSeconds,
        options.language
      );
      return { transcript };
    } catch (error) {
      console.error("[transcription] Gemini transcription error:", error);
    }
  } else {
    console.warn("[transcription] GEMINI_API_KEY tidak tersedia, skip Gemini.");
  }

  // Fallback heuristik
  const chunks = buildFallbackChunks(options.durationSeconds);
  return {
    transcript: {
      text: chunks.map((c) => c.text).join(" "),
      chunks,
      source: "fallback" as const,
      language: "id",
      summary: summarize(chunks),
    },
    warning: {
      step: "transcribing",
      message: isGeminiReady()
        ? "Transkripsi Gemini gagal, menggunakan heuristik lokal."
        : "GEMINI_API_KEY belum dikonfigurasi. Tambahkan ke .env.local",
    },
  };
}
