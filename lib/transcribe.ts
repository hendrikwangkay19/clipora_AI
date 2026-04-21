import fs from "fs";
import { stat } from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum terbaca dari .env.local");
  }

  return new GoogleGenerativeAI(apiKey);
}

/**
 * Batas ukuran file untuk inline base64 (4MB).
 * File lebih besar dari ini akan menggunakan chunked reading
 * untuk menghindari memory spike.
 */
const INLINE_SIZE_LIMIT = 4 * 1024 * 1024;

/**
 * Membaca file audio secara chunked dan convert ke base64
 * untuk mengurangi peak memory usage dibandingkan readFileSync.
 */
async function readFileAsBase64(filePath: string): Promise<string> {
  const fileSize = (await stat(filePath)).size;

  // File kecil: baca langsung (lebih cepat)
  if (fileSize <= INLINE_SIZE_LIMIT) {
    return fs.readFileSync(filePath).toString("base64");
  }

  // File besar: baca secara streaming ke buffer chunks
  console.log(`[transcribe.ts] File besar (${(fileSize / 1024 / 1024).toFixed(1)}MB), menggunakan chunked read.`);

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 }); // 256KB chunks

    stream.on("data", (chunk: string | Buffer) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });

    stream.on("end", () => {
      const fullBuffer = Buffer.concat(chunks);
      resolve(fullBuffer.toString("base64"));
      // Help GC by clearing references
      chunks.length = 0;
    });

    stream.on("error", reject);
  });
}

export async function transcribeAudio(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File audio tidak ditemukan: ${filePath}`);
  }

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel(
    { model: "gemini-2.0-flash" },
    { apiVersion: "v1" }
  );

  const base64Audio = await readFileAsBase64(filePath);
  const fileSize = (await stat(filePath)).size;

  const ext = filePath.split(".").pop()?.toLowerCase() ?? "mp3";
  const mimeTypeMap: Record<string, string> = {
    mp3: "audio/mp3",
    wav: "audio/wav",
    ogg: "audio/ogg",
    m4a: "audio/mp4",
    flac: "audio/flac",
    aac: "audio/aac",
    webm: "audio/webm",
  };
  const mimeType = mimeTypeMap[ext] ?? "audio/mp3";

  console.log(`[transcribe.ts] Mengirim audio ke Gemini — file: ${filePath}, size: ${fileSize} bytes, mimeType: ${mimeType}`);

  let result;
  try {
    result = await model.generateContent([
      {
        inlineData: {
          mimeType,
          data: base64Audio,
        },
      },
      "Transkripsi seluruh audio ini secara lengkap dan akurat. Kembalikan hanya teks transkripsi tanpa penjelasan tambahan.",
    ]);
  } catch (err) {
    console.error("[transcribe.ts] ERROR saat memanggil Gemini generateContent:");
    console.error("  message  :", err instanceof Error ? err.message : String(err));
    console.error("  status   :", (err as Record<string, unknown>)?.status ?? "n/a");
    console.error("  errorDetails:", JSON.stringify((err as Record<string, unknown>)?.errorDetails ?? null));
    throw err;
  }

  const text = result.response.text().trim();

  if (!text) {
    console.error("[transcribe.ts] Gemini mengembalikan respons kosong.");
    throw new Error("Transkripsi gagal: respons kosong dari Gemini");
  }

  console.log(`[transcribe.ts] Transkripsi berhasil — ${text.length} karakter`);
  return text;
}
