import { resolveBinary } from "@/lib/autoclip/tools/binaries";
import { runCommand } from "@/lib/autoclip/tools/command";

/**
 * Ekstrak audio untuk keperluan transkripsi Gemini.
 * Mono 32kbps 16kHz — cukup untuk speech recognition, ukuran kecil.
 */
export async function extractAudio(inputPath: string, outputPath: string) {
  const ffmpegPath = await resolveBinary("ffmpeg");

  await runCommand(ffmpegPath, [
    "-y",
    "-i", inputPath,
    "-vn",
    "-ac", "1",          // mono
    "-ar", "16000",      // 16 kHz — cukup untuk speech
    "-b:a", "32k",       // 32 kbps → file kecil
    "-acodec", "libmp3lame",
    outputPath,
  ]);

  return outputPath;
}
