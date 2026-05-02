import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import { AppError } from "@/lib/autoclip/errors";
import { resolveBinary } from "@/lib/autoclip/tools/binaries";
import { runCommand } from "@/lib/autoclip/tools/command";
import type { VideoContext } from "@/lib/ai";

const execFileAsync = promisify(execFile);

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

export async function fetchYoutubeMetadata(url: string): Promise<VideoContext> {
  try {
    const ytDlpPath = await resolveBinary("yt-dlp");
    const { stdout } = await execFileAsync(ytDlpPath, [
      "--no-playlist",
      "--print", "%(title)s",
      "--print", "%(channel)s",
      "--print", "%(description)s",
      url,
    ]);
    const [title, channelName, ...descLines] = stdout.trim().split("\n");
    return {
      title:       title?.trim() || undefined,
      channelName: channelName?.trim() || undefined,
      description: descLines.join("\n").slice(0, 500) || undefined,
    };
  } catch {
    return {};
  }
}
