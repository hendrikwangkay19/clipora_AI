import path from "path";

const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), ".autoclip");
const jobsDir = path.join(dataDir, "jobs");

export type AiProvider = "auto" | "gemini" | "local" | "fallback";

function getAiProvider(): AiProvider {
  const value = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (value === "gemini" || value === "local" || value === "fallback") return value;
  return "auto";
}

export const appConfig = {
  dataDir,
  jobsDir,
  binaries: {
    ffmpeg: process.env.FFMPEG_PATH?.trim() || null,
    ffprobe: process.env.FFPROBE_PATH?.trim() || null,
    ytDlp: process.env.YT_DLP_PATH?.trim() || null,
  },
  ai: {
    provider: getAiProvider(),
    gemini: {
      apiKey: process.env.GEMINI_API_KEY?.trim() || null,
      model: process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash-lite",
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL?.trim() || "http://127.0.0.1:11434",
      model: process.env.OLLAMA_MODEL?.trim() || "llama3.2:3b",
    },
    whisper: {
      binaryPath: process.env.WHISPER_CPP_PATH?.trim() || null,
      modelPath: process.env.WHISPER_MODEL_PATH?.trim() || null,
    },
  },
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
  openAiApiKey: process.env.OPENAI_API_KEY?.trim() || null, // masih dipakai oleh TTS & script-generator
  clips: {
    maxCandidates: 5,
    minDurationSeconds: 45,   // minimal 45 detik per clip
    maxDurationSeconds: 90,   // maksimal 1.5 menit per clip
  },
} as const;
