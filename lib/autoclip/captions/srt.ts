import fs from "fs/promises";
import { TranscriptChunk } from "@/lib/autoclip/types";

function toSrtTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return (
    `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:` +
    `${String(s).padStart(2, "0")},${String(ms).padStart(3, "0")}`
  );
}

/**
 * Pecah chunk panjang menjadi subtitle pendek (maks 6 kata per baris).
 * Ini menghasilkan subtitle bergaya TikTok yang mudah dibaca.
 */
function splitIntoDisplayChunks(chunk: TranscriptChunk, maxWords = 6): TranscriptChunk[] {
  const words = chunk.text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [chunk];

  const duration = chunk.end - chunk.start;
  const numParts = Math.ceil(words.length / maxWords);
  const timePerPart = duration / numParts;

  return Array.from({ length: numParts }, (_, i) => ({
    start: chunk.start + i * timePerPart,
    end: chunk.start + (i + 1) * timePerPart,
    text: words.slice(i * maxWords, (i + 1) * maxWords).join(" "),
  }));
}

/**
 * Buat konten SRT dari chunks transcript untuk jendela klip [clipStart, clipEnd].
 * Timestamp disesuaikan relatif terhadap awal klip.
 */
export function buildSrtForClip(
  chunks: TranscriptChunk[],
  clipStart: number,
  clipEnd: number
): string {
  // Filter chunk yang tumpang tindih dengan jendela klip, lalu pecah menjadi pendek
  const displayChunks = chunks
    .filter((c) => c.end > clipStart && c.start < clipEnd)
    .flatMap((c) => splitIntoDisplayChunks(c));

  if (displayChunks.length === 0) return "";

  const lines: string[] = [];
  let index = 1;

  for (const chunk of displayChunks) {
    // Klem ke batas klip dan jadikan relatif terhadap awal klip
    const start = Math.max(0, chunk.start - clipStart);
    const end = Math.min(clipEnd - clipStart, chunk.end - clipStart);
    if (end <= start + 0.05) continue;

    lines.push(`${index}`);
    lines.push(`${toSrtTimestamp(start)} --> ${toSrtTimestamp(end)}`);
    lines.push(chunk.text.trim());
    lines.push("");
    index++;
  }

  return lines.join("\n");
}

export async function writeSrtFile(
  srtPath: string,
  chunks: TranscriptChunk[],
  clipStart: number,
  clipEnd: number
): Promise<string | null> {
  const srt = buildSrtForClip(chunks, clipStart, clipEnd);
  if (!srt.trim()) return null;
  await fs.writeFile(srtPath, srt, "utf8");
  return srtPath;
}
