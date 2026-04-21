import fs from "fs";
import path from "path";
import { AppError } from "@/lib/autoclip/errors";
import { resolveBinary } from "@/lib/autoclip/tools/binaries";
import { runCommand } from "@/lib/autoclip/tools/command";

export function isYoutubeUrl(url: string) {
  try {
    const parsed = new URL(url);
    return [
      "youtube.com",
      "www.youtube.com",
      "m.youtube.com",
      "youtu.be",
    ].includes(parsed.hostname);
  } catch {
    return false;
  }
}

export async function downloadYoutubeVideo(url: string, outputDir: string) {
  const ytDlpPath = await resolveBinary("yt-dlp");
  const outputTemplate = path.join(outputDir, "source.%(ext)s");

  await runCommand(
    ytDlpPath,
    [
      "--no-playlist",
      "--format",
      "mp4/bestvideo+bestaudio/best",
      "--merge-output-format",
      "mp4",
      "--output",
      outputTemplate,
      url,
    ],
    { maxBuffer: 1024 * 1024 * 64 }
  );

  const candidates = ["source.mp4", "source.webm", "source.mkv"].map((fileName) =>
    path.join(outputDir, fileName)
  );
  const found = candidates.find((candidate) => fs.existsSync(candidate));

  if (!found) {
    throw new AppError(
      "yt-dlp completed but the downloaded video file could not be found.",
      "DOWNLOAD_OUTPUT_MISSING",
      500
    );
  }

  return found;
}
