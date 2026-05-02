import fs from "fs";
import path from "path";
import { resolveBinary } from "@/lib/autoclip/tools/binaries";
import { runCommand } from "@/lib/autoclip/tools/command";

export type AspectRatio    = "16:9" | "9:16";
export type SubtitleStyle  = "classic" | "bold" | "minimal";
export type MusicTrack     = "none" | "upbeat" | "chill" | "dramatic";

export type VideoEffects = {
  zoom?:       boolean;  // Ken Burns zoom masuk perlahan
  fade?:       boolean;  // Fade in / fade out
  colorGrade?: boolean;  // Peningkatan warna ringan
};

// ─── Music ────────────────────────────────────────────────────────────────────

const MUSIC_DIR = path.join(process.cwd(), "public", "music");

export function getMusicPath(track: MusicTrack): string | null {
  if (track === "none") return null;
  const p = path.join(MUSIC_DIR, `${track}.mp3`);
  return fs.existsSync(p) ? p : null;
}

// ─── Video filter chain ───────────────────────────────────────────────────────

function buildVideoFilter(
  aspectRatio: AspectRatio,
  effects: VideoEffects,
  clipDuration: number,
  // Posisi wajah relatif horizontal: 0.0 = kiri, 0.5 = tengah, 1.0 = kanan.
  // Untuk deteksi wajah otomatis, hitung nilai ini sebelum memanggil clipVideo
  // (misal dengan FFmpeg facedetect atau analisis frame eksternal), lalu teruskan
  // sebagai opsi cropX. Default 0.5 aman untuk podcast single-speaker.
  faceCropX = 0.5
): string {
  const parts: string[] = [];
  const w = aspectRatio === "9:16" ? 1080 : 1920;
  const h = aspectRatio === "9:16" ? 1920 : 1080;

  // 1. Aspect ratio + scale ke resolusi target
  if (aspectRatio === "9:16") {
    // Smart crop: scale-to-fill (tidak ada black bar) lalu crop di sekitar wajah.
    // scale=-2:h → perbesar hingga tinggi = h, lebar proporsional (selalu > w).
    // crop=w:h:x:0 → potong lebar w dari posisi x yang mengacu faceCropX.
    // Ekspresi 'max(0,min(iw-w,(iw-w)*faceCropX))' mencegah crop keluar batas.
    const x = `'max(0,min(iw-${w},(iw-${w})*${faceCropX.toFixed(4)}))'`;
    parts.push(`scale=-2:${h}`);
    parts.push(`crop=${w}:${h}:${x}:0`);
  } else {
    parts.push(`scale=${w}:${h}:force_original_aspect_ratio=decrease`);
    parts.push(`pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=black`);
  }

  // 2. Color grade — saturasi + kontras agar terlihat lebih sinematik
  if (effects.colorGrade) {
    parts.push("eq=saturation=1.35:contrast=1.08:gamma=0.95:brightness=0.02");
  }

  // 3. Dynamic zoom — zoompan dijalankan TERAKHIR (sebelum subtitle)
  //    agar tidak mengganggu resolusi output filter selanjutnya
  if (effects.zoom) {
    parts.push(
      `zoompan=z='min(zoom+0.0008,1.07)':x='(iw-iw/zoom)/2':y='(ih-ih/zoom)/2':d=1:s=${w}x${h}:fps=30`
    );
  }

  // 4. Fade in / fade out (1 detik — cukup terlihat jelas)
  if (effects.fade && clipDuration > 3) {
    const fadeOut = Math.max(0, clipDuration - 1.0).toFixed(2);
    parts.push("fade=t=in:st=0:d=1.0");
    parts.push(`fade=t=out:st=${fadeOut}:d=1.0`);
  }

  return parts.join(",");
}

// ─── Main clip function ───────────────────────────────────────────────────────

export async function clipVideo(options: {
  inputPath:     string;
  outputPath:    string;
  start:         number;
  duration:      number;
  aspectRatio?:  AspectRatio;
  subtitlePath?: string;   // file .ass dengan style sudah embed di dalamnya
  effects?:      VideoEffects;
  musicPath?:    string;
  cropX?:        number;   // 0.0–1.0, posisi wajah horizontal untuk 9:16 (default 0.5)
}) {
  const ffmpegPath   = await resolveBinary("ffmpeg");
  const aspectRatio  = options.aspectRatio ?? "16:9";
  const effects      = options.effects     ?? {};
  const musicPath    = options.musicPath   ?? null;
  const cropX        = Math.max(0, Math.min(1, options.cropX ?? 0.5));

  let vfChain = buildVideoFilter(aspectRatio, effects, options.duration, cropX);

  // Subtitle: gunakan filter `ass=` (tanpa force_style) — menghindari masalah
  // quoting koma pada Windows. cwd diset ke folder subtitle agar path aman.
  let cwd: string | undefined;
  if (options.subtitlePath) {
    cwd = path.dirname(options.subtitlePath);
    const assFilename = path.basename(options.subtitlePath);
    // ass= filter tidak butuh argumen tambahan — style sudah di dalam file
    vfChain = `${vfChain},ass=${assFilename}`;
  }

  const args: string[] = [
    "-y",
    "-ss",  String(options.start),   // fast seek ke keyframe terdekat
    "-i",   options.inputPath,
  ];

  if (musicPath) {
    args.push("-i", musicPath);
  }

  args.push(
    "-t",                  String(options.duration),
    "-avoid_negative_ts",  "make_zero",  // FIX A/V sync: geser timestamp ke 0
    "-map",                "0:v:0",
  );

  if (musicPath) {
    args.push(
      "-filter_complex",
      [
        "[0:a:0]volume=1[voice]",
        `[1:a]volume=0.12,atrim=duration=${options.duration}[music]`,
        "[voice][music]amix=inputs=2:duration=first:dropout_transition=1[a]",
      ].join(";"),
      "-map", "[a]",
    );
  } else {
    args.push("-map", "0:a:0?");
  }

  // Preset & CRF dari env (default: veryfast/23 untuk kecepatan, override di production)
  const preset = process.env.FFMPEG_PRESET?.trim() || "veryfast";
  const crf    = process.env.FFMPEG_CRF?.trim()    || "23";

  args.push(
    "-map_metadata", "-1",          // strip semua metadata dari source (timecode, dll)
    "-c:v",          "libx264",
    "-preset",       preset,
    "-crf",          crf,
    "-c:a",          "aac",
    "-b:a",          "128k",
    "-vf",           vfChain,
    "-movflags",     "+faststart",
    options.outputPath,
  );

  try {
    await runCommand(ffmpegPath, args, { cwd });
  } catch (err) {
    // Jika efek menyebabkan error (misal zoompan tidak tersedia),
    // coba ulang tanpa efek sebagai fallback
    const msg = err instanceof Error ? err.message : String(err);
    const isEffectError =
      effects.zoom && msg.toLowerCase().includes("zoompan");

    if (isEffectError) {
      console.warn("[clipVideo] zoompan gagal, coba ulang tanpa zoom:", msg);
      const fallbackArgs = args.map((a) =>
        a.includes("zoompan") ? a.replace(/,?zoompan=[^,]*/g, "") : a
      );
      await runCommand(ffmpegPath, fallbackArgs, { cwd });
    } else {
      throw err;
    }
  }

  return options.outputPath;
}
