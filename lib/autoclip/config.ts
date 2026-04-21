import path from "path";

const dataDir = path.join(/* turbopackIgnore: true */ process.cwd(), ".autoclip");
const jobsDir = path.join(dataDir, "jobs");

export const appConfig = {
  dataDir,
  jobsDir,
  binaries: {
    ffmpeg: process.env.FFMPEG_PATH?.trim() || null,
    ffprobe: process.env.FFPROBE_PATH?.trim() || null,
    ytDlp: process.env.YT_DLP_PATH?.trim() || null,
  },
  geminiApiKey: process.env.GEMINI_API_KEY?.trim() || null,
  openAiApiKey: process.env.OPENAI_API_KEY?.trim() || null, // masih dipakai oleh TTS & script-generator
  clips: {
    maxCandidates: 5,
    minDurationSeconds: 45,   // minimal 45 detik per clip
    maxDurationSeconds: 90,   // maksimal 1.5 menit per clip
  },
} as const;
