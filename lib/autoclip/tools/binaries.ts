import fs from "fs";
import { platform } from "os";
import { appConfig } from "@/lib/autoclip/config";
import { AppError } from "@/lib/autoclip/errors";
import { runCommand } from "@/lib/autoclip/tools/command";

type BinaryKind = "ffmpeg" | "ffprobe" | "yt-dlp";

const envValueByKind: Record<BinaryKind, string | null> = {
  ffmpeg: appConfig.binaries.ffmpeg,
  ffprobe: appConfig.binaries.ffprobe,
  "yt-dlp": appConfig.binaries.ytDlp,
};

const installHelp: Record<BinaryKind, string[]> = {
  ffmpeg: [
    "Install ffmpeg and ensure `ffmpeg` is available on PATH.",
    "Or set `FFMPEG_PATH` in `.env.local` to the absolute ffmpeg executable path.",
  ],
  ffprobe: [
    "Install ffprobe alongside ffmpeg and ensure `ffprobe` is available on PATH.",
    "Or set `FFPROBE_PATH` in `.env.local` to the absolute ffprobe executable path.",
  ],
  "yt-dlp": [
    "Install yt-dlp and ensure `yt-dlp` is available on PATH.",
    "Or set `YT_DLP_PATH` in `.env.local` to the absolute yt-dlp executable path.",
  ],
};

async function resolveFromPath(commandName: string) {
  const lookupCommand = platform() === "win32" ? "where.exe" : "which";

  try {
    const { stdout } = await runCommand(lookupCommand, [commandName]);
    const first = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find(Boolean);

    return first || null;
  } catch {
    return null;
  }
}

export async function resolveBinary(kind: BinaryKind) {
  const envValue = envValueByKind[kind];
  if (envValue) {
    if (!fs.existsSync(envValue)) {
      throw new AppError(
        `${kind} binary was configured but not found at ${envValue}`,
        "BINARY_NOT_FOUND",
        500,
        installHelp[kind]
      );
    }

    return envValue;
  }

  const pathResult = await resolveFromPath(kind);
  if (pathResult) {
    return pathResult;
  }

  throw new AppError(
    `${kind} is required for this step but is not installed or not available on PATH.`,
    "MISSING_BINARY",
    500,
    installHelp[kind]
  );
}
