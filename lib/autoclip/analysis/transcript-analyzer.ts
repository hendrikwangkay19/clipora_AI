/**
 * Analisis transcript menggunakan Gemini → fallback heuristik lokal.
 */
import { analyzeTranscript } from "@/lib/ai";
import { buildFallbackSegments } from "@/lib/autoclip/analysis/fallback-analysis";
import { CandidateSegment, TranscriptResult } from "@/lib/autoclip/types";

export type HookType = "viral" | "pertanyaan" | "cerita" | "tips";

function isGeminiReady() {
  const k = process.env.GEMINI_API_KEY?.trim() ?? "";
  return k.length > 10;
}

/**
 * Potong transcript agar tidak melebihi batas token Gemini.
 */
function truncateForAnalysis(transcript: TranscriptResult): Pick<TranscriptResult, "text" | "chunks"> {
  const MAX_CHUNKS = 40;
  const MAX_TEXT   = 5000;

  if (transcript.chunks.length <= MAX_CHUNKS) {
    return {
      text:   transcript.text.slice(0, MAX_TEXT),
      chunks: transcript.chunks,
    };
  }

  const step    = Math.ceil(transcript.chunks.length / MAX_CHUNKS);
  const sampled = transcript.chunks.filter((_, i) => i % step === 0).slice(0, MAX_CHUNKS);

  return {
    text:   sampled.map((c) => c.text).join(" ").slice(0, MAX_TEXT),
    chunks: sampled,
  };
}

const HOOK_GOALS: Record<HookType, string> = {
  viral:
    "Cari momen berenergi tinggi, mengejutkan, atau kontroversial yang paling mungkin viral di TikTok/Reels.",
  pertanyaan:
    "Cari momen yang mengajukan pertanyaan menarik, memicu rasa ingin tahu, atau memberikan tantangan kepada audiens.",
  cerita:
    "Cari momen dengan arc narasi yang kuat: ada konflik, turning point, atau resolusi emosional.",
  tips:
    "Cari momen dengan saran praktis, tips actionable, atau insight langsung yang berguna bagi audiens.",
};

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function analyzeWithGemini(
  transcript: TranscriptResult,
  hookType: HookType
): Promise<CandidateSegment[]> {
  const { text } = truncateForAnalysis(transcript);
  const enrichedText = `[Goal: ${HOOK_GOALS[hookType]}]\n\n${text}`;

  const raw = await analyzeTranscript(enrichedText);

  const segments = raw as Array<{
    start: number;
    end: number;
    text: string;
    reason?: string;
    keywords?: string[];
  }>;

  return segments
    .filter((s) => Number.isFinite(s.start) && Number.isFinite(s.end))
    .map((s) => ({
      start:    s.start,
      end:      s.end,
      text:     s.text,
      reason:   s.reason ?? "Dipilih oleh AI (Gemini).",
      keywords: Array.isArray(s.keywords) ? s.keywords : [],
    }));
}

// ─── Public entry ─────────────────────────────────────────────────────────────

export async function analyzeTranscriptWithFallback(
  transcript: TranscriptResult,
  hookType: HookType = "viral"
) {
  if (isGeminiReady()) {
    try {
      const segments = await analyzeWithGemini(transcript, hookType);
      if (segments.length > 0) return { segments, source: "gemini" as const };
      console.warn("[analysis] Gemini mengembalikan 0 segmen valid, fallback ke heuristik.");
    } catch (error) {
      console.error("[analysis] Gemini analysis error:", error);
    }
  } else {
    console.warn("[analysis] GEMINI_API_KEY tidak tersedia, skip Gemini.");
  }

  // Fallback heuristik lokal
  return {
    segments: buildFallbackSegments(transcript.chunks),
    source: "fallback" as const,
    warning: {
      step: "analyzing",
      message: isGeminiReady()
        ? "Analisis Gemini gagal, menggunakan heuristik lokal."
        : "GEMINI_API_KEY belum dikonfigurasi. Tambahkan ke .env.local",
    },
  };
}
