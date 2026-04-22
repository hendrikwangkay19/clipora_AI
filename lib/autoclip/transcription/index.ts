import {
  transcribeAudioWithGemini,
  transcribeAudioWithLocalWhisper,
} from "@/lib/transcribe";
import { appConfig } from "@/lib/autoclip/config";
import { PipelineWarning, TranscriptChunk, TranscriptResult } from "@/lib/autoclip/types";

function isGeminiReady() {
  return Boolean(appConfig.ai.gemini.apiKey && appConfig.ai.gemini.apiKey.length > 10);
}

function isLocalWhisperReady() {
  return Boolean(appConfig.ai.whisper.binaryPath && appConfig.ai.whisper.modelPath);
}

function splitIntoChunks(text: string, durationSeconds: number): TranscriptChunk[] {
  const sentences = text
    .split(/(?<=[.!?])\s+|\r?\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  const safeDuration = Math.max(1, durationSeconds);
  const chunkDuration = safeDuration / Math.max(sentences.length, 1);

  return sentences.length > 0
    ? sentences.map((sentence, index) => ({
        start: Math.round(index * chunkDuration * 10) / 10,
        end: Math.round((index + 1) * chunkDuration * 10) / 10,
        text: sentence,
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

  return texts.map<TranscriptChunk>((text, index) => ({
    start: index * size,
    end: Math.min((index + 1) * size, safe),
    text,
  }));
}

function summarize(chunks: TranscriptChunk[]) {
  return chunks.slice(0, 3).map((chunk) => chunk.text).join(" ").slice(0, 280);
}

async function buildTranscript(
  source: "gemini" | "local",
  text: string,
  durationSeconds: number,
  language?: string
): Promise<TranscriptResult> {
  const chunks = splitIntoChunks(text, durationSeconds);
  return {
    text,
    chunks,
    source,
    language: language ?? "id",
    summary: summarize(chunks),
  };
}

async function tryGemini(options: {
  audioPath: string;
  durationSeconds: number;
  language?: string;
}) {
  const text = await transcribeAudioWithGemini(options.audioPath);
  return buildTranscript("gemini", text, options.durationSeconds, options.language);
}

async function tryLocalWhisper(options: {
  audioPath: string;
  durationSeconds: number;
  language?: string;
}) {
  const text = await transcribeAudioWithLocalWhisper(options.audioPath, options.language);
  return buildTranscript("local", text, options.durationSeconds, options.language);
}

function fallbackWarning(errors: string[]): PipelineWarning {
  const provider = appConfig.ai.provider;

  if (provider === "local" && !isLocalWhisperReady()) {
    return {
      step: "transcribing",
      message: "Mode local aktif, tetapi WHISPER_CPP_PATH/WHISPER_MODEL_PATH belum diatur. Menggunakan fallback sementara.",
    };
  }

  if (provider === "gemini" && !isGeminiReady()) {
    return {
      step: "transcribing",
      message: "Mode Gemini aktif, tetapi GEMINI_API_KEY belum tersedia. Menggunakan fallback sementara.",
    };
  }

  return {
    step: "transcribing",
    message: errors.length
      ? `Transkripsi AI gagal (${errors.join(" | ")}). Menggunakan fallback sementara.`
      : "Tidak ada provider transkripsi AI yang siap. Menggunakan fallback sementara.",
  };
}

export async function transcribeAudioWithFallback(options: {
  audioPath: string;
  durationSeconds: number;
  language?: string;
}) {
  const provider = appConfig.ai.provider;
  const errors: string[] = [];

  if (provider === "local") {
    if (isLocalWhisperReady()) {
      try {
        return { transcript: await tryLocalWhisper(options) };
      } catch (error) {
        errors.push(`Whisper local: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else if (provider === "gemini") {
    if (isGeminiReady()) {
      try {
        return { transcript: await tryGemini(options) };
      } catch (error) {
        errors.push(`Gemini: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  } else if (provider === "auto") {
    if (isLocalWhisperReady()) {
      try {
        return { transcript: await tryLocalWhisper(options) };
      } catch (error) {
        errors.push(`Whisper local: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (isGeminiReady()) {
      try {
        return { transcript: await tryGemini(options) };
      } catch (error) {
        errors.push(`Gemini: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  const chunks = buildFallbackChunks(options.durationSeconds);
  return {
    transcript: {
      text: chunks.map((chunk) => chunk.text).join(" "),
      chunks,
      source: "fallback" as const,
      language: "id",
      summary: summarize(chunks),
    },
    warning: fallbackWarning(errors),
  };
}
