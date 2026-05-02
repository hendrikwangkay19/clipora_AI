/**
 * Analisis transcript menggunakan Gemini → fallback heuristik lokal.
 */
import { analyzeTranscript } from "@/lib/ai";
import type { VideoContext } from "@/lib/ai";
import { buildFallbackSegments } from "@/lib/autoclip/analysis/fallback-analysis";
import { appConfig } from "@/lib/autoclip/config";
import { CandidateSegment, PipelineWarning, TranscriptResult } from "@/lib/autoclip/types";

export type HookType = "viral" | "pertanyaan" | "cerita" | "tips";
export type { VideoContext };

/**
 * Potong transcript agar tidak melebihi batas token Gemini.
 * Format output menyertakan timestamp milidetik per chunk agar AI bisa menghasilkan start_ms/end_ms akurat.
 */
function formatTranscriptForAnalysis(transcript: TranscriptResult): string {
  const MAX_CHUNKS = 40;

  const chunks =
    transcript.chunks.length <= MAX_CHUNKS
      ? transcript.chunks
      : (() => {
          const step = Math.ceil(transcript.chunks.length / MAX_CHUNKS);
          return transcript.chunks.filter((_, i) => i % step === 0).slice(0, MAX_CHUNKS);
        })();

  return chunks
    .map((c) => `[${Math.round(c.start * 1000)}ms–${Math.round(c.end * 1000)}ms] ${c.text}`)
    .join("\n");
}

const HOOK_GOAL_SUFFIX: Record<HookType, string> = {
  viral:
    "PRIORITAS TAMBAHAN: Fokus pada momen berenergi tinggi yang memicu share, save, atau komentar. " +
    "Tanyakan: apakah penonton akan menekan pause, screenshot, atau mengirim ke temannya?",

  pertanyaan:
    "PRIORITAS TAMBAHAN: Fokus pada momen yang membuka loop yang harus dijawab. " +
    "Hindari momen yang sudah memberikan jawaban tuntas — yang terbaik adalah yang menggantung.",

  cerita:
    "PRIORITAS TAMBAHAN: Fokus pada momen dengan arc cerita lengkap atau puncak emosional. " +
    "Klip harus bisa berdiri sendiri sebagai mini-cerita dengan awal dan akhir yang jelas.",

  tips:
    "PRIORITAS TAMBAHAN: Fokus pada momen yang memberikan insight yang bisa langsung diterapkan. " +
    "Momen terbaik membuat penonton berpikir 'saya harus coba ini sekarang'.",
};

// ─── AI Provider ──────────────────────────────────────────────────────────────

async function analyzeWithConfiguredProvider(
  transcript: TranscriptResult,
  hookType: HookType,
  ctx?: VideoContext
): Promise<{ source: "gemini" | "local"; segments: CandidateSegment[] }> {
  const formattedTranscript =
    formatTranscriptForAnalysis(transcript) +
    `\n\n${HOOK_GOAL_SUFFIX[hookType]}`;

  const result = await analyzeTranscript(formattedTranscript, ctx);

  const segments: CandidateSegment[] = result.segments
    .filter((s) => Number.isFinite(s.start_ms) && Number.isFinite(s.end_ms))
    .map((s) => ({
      start:          s.start_ms / 1000,
      end:            s.end_ms / 1000,
      text:           s.text,
      reason:         s.reason,
      keywords:       [],
      momentType:     s.moment_type,
      aiScore:        s.score,
      hookSuggestion: s.hook_suggestion || undefined,
    }));

  return { source: result.source, segments };
}

// ─── Public entry ─────────────────────────────────────────────────────────────

export async function analyzeTranscriptWithFallback(
  transcript: TranscriptResult,
  hookType: HookType = "viral",
  ctx?: VideoContext
): Promise<{
  source: "gemini" | "local" | "fallback";
  segments: CandidateSegment[];
  warning?: PipelineWarning;
}> {
  if (appConfig.ai.provider !== "fallback") {
    try {
      const result = await analyzeWithConfiguredProvider(transcript, hookType, ctx);
      if (result.segments.length > 0) return result;
      console.warn("[analysis] AI provider mengembalikan 0 segmen valid, fallback ke heuristik.");
    } catch (error) {
      console.error("[analysis] AI analysis error:", error);
    }
  } else {
    console.warn("[analysis] AI_PROVIDER=fallback, skip external/local AI.");
  }

  return {
    segments: buildFallbackSegments(transcript.chunks),
    source: "fallback" as const,
    warning: {
      step: "analyzing",
      message:
        appConfig.ai.provider === "fallback"
          ? "AI_PROVIDER=fallback, menggunakan heuristik lokal."
          : "Analisis AI belum tersedia atau gagal, menggunakan heuristik lokal.",
    },
  };
}
