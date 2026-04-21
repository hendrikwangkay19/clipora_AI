import fs from "fs/promises";
import path from "path";
import { AppError } from "@/lib/autoclip/errors";
import { ensureDir } from "@/lib/autoclip/storage/filesystem";
import { assembleVideo } from "./assembler";
import { generateScript } from "./script-generator";
import { findStockVideo, downloadVideo } from "./stock-video";
import { generateVoiceover, getAudioDurationSeconds } from "./tts";
import {
  GenerateVideoInput,
  GenerateVideoResult,
  GenerateVideoStatus,
  VideoLanguage,
  VideoStyle,
} from "./types";

const GENERATED_DIR = path.join(
  /* turbopackIgnore: true */ process.cwd(),
  "public",
  "generated"
);

type StatusCallback = (status: GenerateVideoStatus) => Promise<void>;

export async function generateVideo(
  input: GenerateVideoInput,
  onStatus?: StatusCallback
): Promise<GenerateVideoResult> {
  const topic = input.topic?.trim();
  if (!topic) {
    throw new AppError("Topic is required.", "INVALID_INPUT", 400);
  }
  if (topic.length > 200) {
    throw new AppError("Topic must be under 200 characters.", "INVALID_INPUT", 400);
  }

  const style: VideoStyle = input.style ?? "informative";
  const language: VideoLanguage = input.language ?? "id";
  const durationSeconds = input.durationSeconds ?? 60;
  const voice = input.voice ?? "nova";

  const jobId = crypto.randomUUID();
  const jobDir = path.join(GENERATED_DIR, jobId);

  await ensureDir(jobDir);

  try {
    // Step 1: Generate script
    await onStatus?.("generating_script");
    const script = await generateScript({ topic, style, language, durationSeconds });

    // Step 2: Generate voiceover
    await onStatus?.("generating_voice");
    const voiceoverPath = path.join(jobDir, "voiceover.mp3");
    await generateVoiceover({ text: script.fullScript, outputPath: voiceoverPath, voice });
    const audioDuration = await getAudioDurationSeconds(voiceoverPath);

    // Step 3: Fetch stock video
    await onStatus?.("fetching_stock_video");
    const stockInfo = await findStockVideo(script.keywords);
    const stockVideoPath = path.join(jobDir, "stock.mp4");
    await downloadVideo(stockInfo.url, stockVideoPath);

    // Step 4: Assemble
    await onStatus?.("assembling_video");
    const outputPath = path.join(jobDir, "output.mp4");
    await assembleVideo({
      stockVideoPath,
      voiceoverPath,
      outputPath,
      audioDurationSeconds: audioDuration,
    });

    // Cleanup intermediates
    await fs.unlink(stockVideoPath).catch(() => null);
    await fs.unlink(voiceoverPath).catch(() => null);

    await onStatus?.("completed");

    return {
      success: true,
      jobId,
      topic,
      style,
      language,
      script,
      videoUrl: `/generated/${jobId}/output.mp4`,
      durationSeconds: audioDuration,
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    await fs.rm(jobDir, { recursive: true, force: true }).catch(() => null);
    throw error;
  }
}
