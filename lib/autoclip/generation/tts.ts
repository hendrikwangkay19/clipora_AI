import fs from "fs/promises";
import OpenAI from "openai";
import { appConfig } from "@/lib/autoclip/config";
import { AppError } from "@/lib/autoclip/errors";
import { resolveBinary } from "@/lib/autoclip/tools/binaries";
import { runCommand } from "@/lib/autoclip/tools/command";
import { TtsVoice } from "./types";

export async function generateVoiceover(options: {
  text: string;
  outputPath: string;
  voice?: TtsVoice;
}): Promise<string> {
  if (!appConfig.openAiApiKey) {
    throw new AppError("OPENAI_API_KEY is not set.", "MISSING_ENV", 500);
  }

  const openai = new OpenAI({ apiKey: appConfig.openAiApiKey });

  const response = await openai.audio.speech.create({
    model: "tts-1",
    voice: options.voice ?? "nova",
    input: options.text,
    response_format: "mp3",
    speed: 1.0,
  });

  const arrayBuffer = await response.arrayBuffer();
  await fs.writeFile(options.outputPath, Buffer.from(arrayBuffer));

  return options.outputPath;
}

export async function getAudioDurationSeconds(audioPath: string): Promise<number> {
  const ffprobePath = await resolveBinary("ffprobe");

  const { stdout } = await runCommand(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    audioPath,
  ]);

  try {
    const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
    const duration = Number(parsed.format?.duration ?? 0);
    return Number.isFinite(duration) && duration > 0 ? Math.ceil(duration) : 30;
  } catch {
    return 30;
  }
}
