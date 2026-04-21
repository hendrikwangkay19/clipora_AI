import { resolveBinary } from "@/lib/autoclip/tools/binaries";
import { runCommand } from "@/lib/autoclip/tools/command";

type ProbeFormat = {
  duration?: string;
};

type ProbeResponse = {
  format?: ProbeFormat;
};

export async function getVideoDurationSeconds(filePath: string) {
  const ffprobePath = await resolveBinary("ffprobe");
  const { stdout } = await runCommand(ffprobePath, [
    "-v",
    "error",
    "-show_entries",
    "format=duration",
    "-of",
    "json",
    filePath,
  ]);

  const parsed = JSON.parse(stdout) as ProbeResponse;
  const duration = Number(parsed.format?.duration ?? 0);

  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}
