import { resolveBinary } from "@/lib/autoclip/tools/binaries";
import { runCommand } from "@/lib/autoclip/tools/command";

/**
 * Combines a stock video (looped) with a voiceover audio track.
 * Output: 1280x720 MP4, duration matches the audio length.
 */
export async function assembleVideo(options: {
  stockVideoPath: string;
  voiceoverPath: string;
  outputPath: string;
  audioDurationSeconds: number;
}): Promise<string> {
  const ffmpegPath = await resolveBinary("ffmpeg");

  await runCommand(ffmpegPath, [
    "-y",
    // Loop the stock video so it's always long enough
    "-stream_loop",
    "-1",
    "-i",
    options.stockVideoPath,
    // Voiceover track
    "-i",
    options.voiceoverPath,
    // Use video from first input, audio from second
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    // Encode
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    // Cut at audio duration
    "-t",
    `${options.audioDurationSeconds}`,
    // Scale to 1280x720, pad black bars if needed
    "-vf",
    "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:color=black",
    "-movflags",
    "+faststart",
    options.outputPath,
  ]);

  return options.outputPath;
}
