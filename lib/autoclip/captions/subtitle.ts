/**
 * Generator subtitle format ASS (Advanced SubStation Alpha).
 *
 * Mengapa ASS bukan SRT?
 * - Style embed di dalam file → filter `ass=file` tanpa argumen tambahan
 * - Menghindari masalah quoting `force_style='...,…'` pada Windows/FFmpeg
 * - Mendukung styling lengkap: warna, outline, posisi, ukuran font
 */

import fs from "fs/promises";
import { SubtitleStyle, AspectRatio } from "@/lib/autoclip/media/video";
import { TranscriptChunk } from "@/lib/autoclip/types";

// ─── Timestamp ────────────────────────────────────────────────────────────────

function toAssTime(seconds: number): string {
  const t = Math.max(0, seconds);
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = Math.floor(t % 60);
  const cs = Math.round((t % 1) * 100); // centiseconds
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

// ─── ASS header with embedded styles ─────────────────────────────────────────

function buildAssHeader(style: SubtitleStyle, aspectRatio: AspectRatio): string {
  const isV = aspectRatio === "9:16";
  const w   = isV ? 1080 : 1920;
  const h   = isV ? 1920 : 1080;

  type StyleDef = {
    fontsize: number;
    bold: number;
    primaryColour: string;
    borderStyle: number;
    outline: number;
    backColour: string;
    shadow: number;
    marginV: number;
  };

  const defs: Record<SubtitleStyle, StyleDef> = {
    classic: {
      fontsize: isV ? 42 : 30,
      bold: -1,
      primaryColour: "&H00FFFFFF",  // putih
      borderStyle: 1,
      outline: 4,
      backColour: "&H00000000",
      shadow: 1,
      marginV: isV ? 150 : 62,
    },
    bold: {
      fontsize: isV ? 64 : 42,
      bold: -1,
      primaryColour: "&H0000FFFF",  // kuning (BGR)
      borderStyle: 1,
      outline: 6,
      backColour: "&H00000000",
      shadow: 2,
      marginV: isV ? 170 : 76,
    },
    minimal: {
      fontsize: isV ? 36 : 24,
      bold: 0,
      primaryColour: "&H00FFFFFF",
      borderStyle: 4,               // opaque box
      outline: 2,
      backColour: "&H60000000",     // semi-transparan hitam
      shadow: 0,
      marginV: isV ? 130 : 56,
    },
  };

  const d = defs[style];

  return [
    "[Script Info]",
    "ScriptType: v4.00+",
    `PlayResX: ${w}`,
    `PlayResY: ${h}`,
    "WrapStyle: 1",
    "",
    "[V4+ Styles]",
    "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding",
    `Style: Default,Arial,${d.fontsize},${d.primaryColour},&H000000FF,&H00000000,${d.backColour},${d.bold},0,0,0,100,100,0,0,${d.borderStyle},${d.outline},${d.shadow},2,10,10,${d.marginV},1`,
    "",
    "[Events]",
    "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text",
  ].join("\n");
}

// ─── Pemecah chunk → satu kata per baris (word-by-word) ─────────────────────
// Whisper sudah memberi timestamp per kata (--max-len 1 --split-on-word).
// Fungsi ini menjadi fallback untuk chunk lama/fallback yang masih multi-kata.

function splitIntoWords(chunk: TranscriptChunk): TranscriptChunk[] {
  const words = chunk.text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return [chunk];

  const dur  = chunk.end - chunk.start;
  const step = dur / words.length;

  return words.map((word, i) => ({
    start: chunk.start + i * step,
    end:   chunk.start + (i + 1) * step,
    text:  word,
  }));
}

// Escape { } agar tidak diinterpretasi sebagai tag override ASS
function escapeAss(text: string): string {
  return text.replace(/\{/g, "\\{").replace(/\}/g, "\\}");
}

// ─── Build ASS content ────────────────────────────────────────────────────────

export function buildAssForClip(
  chunks: TranscriptChunk[],
  clipStart: number,
  clipEnd: number,
  style: SubtitleStyle,
  aspectRatio: AspectRatio
): string {
  const displayChunks = chunks
    .filter((c) => c.end > clipStart && c.start < clipEnd)
    .flatMap((c) => splitIntoWords(c));

  if (displayChunks.length === 0) return "";

  const header = buildAssHeader(style, aspectRatio);
  const dialogues: string[] = [];

  // {\\fad(80,0)} — fade-in 80 ms per kata, efek "word pop" ala TikTok/Reels
  const popTag = "{\\fad(80,0)}";

  for (const chunk of displayChunks) {
    const start = Math.max(0, chunk.start - clipStart);
    const end   = Math.min(clipEnd - clipStart, chunk.end - clipStart);
    if (end <= start + 0.05) continue;

    dialogues.push(
      `Dialogue: 0,${toAssTime(start)},${toAssTime(end)},Default,,0,0,0,,${popTag}${escapeAss(chunk.text.trim())}`
    );
  }

  if (dialogues.length === 0) return "";
  return header + "\n" + dialogues.join("\n") + "\n";
}

// ─── Tulis file .ass ──────────────────────────────────────────────────────────

export async function writeSubtitleFile(
  assPath: string,
  chunks: TranscriptChunk[],
  clipStart: number,
  clipEnd: number,
  style: SubtitleStyle,
  aspectRatio: AspectRatio
): Promise<string | null> {
  const content = buildAssForClip(chunks, clipStart, clipEnd, style, aspectRatio);
  if (!content.trim()) return null;
  await fs.writeFile(assPath, content, "utf8");
  return assPath;
}
