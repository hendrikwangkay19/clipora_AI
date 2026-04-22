import fs from "fs";
import path from "path";
import { stat } from "fs/promises";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { appConfig } from "@/lib/autoclip/config";
import { runCommand } from "@/lib/autoclip/tools/command";

function getGeminiClient() {
  const apiKey = appConfig.ai.gemini.apiKey;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum terbaca dari .env.local");
  }

  return new GoogleGenerativeAI(apiKey);
}

const INLINE_SIZE_LIMIT = 4 * 1024 * 1024;

async function readFileAsBase64(filePath: string): Promise<string> {
  const fileSize = (await stat(filePath)).size;

  if (fileSize <= INLINE_SIZE_LIMIT) {
    return fs.readFileSync(filePath).toString("base64");
  }

  console.log(`[transcribe] File besar (${(fileSize / 1024 / 1024).toFixed(1)}MB), menggunakan chunked read.`);

  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    const stream = fs.createReadStream(filePath, { highWaterMark: 256 * 1024 });

    stream.on("data", (chunk: string | Buffer) => {
      chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
    });

    stream.on("end", () => {
      const fullBuffer = Buffer.concat(chunks);
      resolve(fullBuffer.toString("base64"));
      chunks.length = 0;
    });

    stream.on("error", reject);
  });
}

export async function transcribeAudioWithGemini(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File audio tidak ditemukan: ${filePath}`);
  }

  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel(
    { model: appConfig.ai.gemini.model },
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

  console.log(`[transcribe] Mengirim audio ke Gemini (${appConfig.ai.gemini.model}) size=${fileSize}, mime=${mimeType}`);

  const result = await model.generateContent([
    {
      inlineData: {
        mimeType,
        data: base64Audio,
      },
    },
    "Transkripsi seluruh audio ini secara lengkap dan akurat. Kembalikan hanya teks transkripsi tanpa penjelasan tambahan.",
  ]);

  const text = result.response.text().trim();

  if (!text) {
    throw new Error("Transkripsi gagal: respons kosong dari Gemini");
  }

  return text;
}

export async function transcribeAudioWithLocalWhisper(
  filePath: string,
  language?: string
): Promise<string> {
  const binaryPath = appConfig.ai.whisper.binaryPath;
  const modelPath = appConfig.ai.whisper.modelPath;

  if (!binaryPath || !modelPath) {
    throw new Error("WHISPER_CPP_PATH dan WHISPER_MODEL_PATH belum dikonfigurasi");
  }

  if (!fs.existsSync(binaryPath)) {
    throw new Error(`Whisper binary tidak ditemukan: ${binaryPath}`);
  }

  if (!fs.existsSync(modelPath)) {
    throw new Error(`Whisper model tidak ditemukan: ${modelPath}`);
  }

  const outputBase = path.join(
    path.dirname(filePath),
    `whisper-${path.basename(filePath, path.extname(filePath))}-${Date.now()}`
  );

  const args = [
    "-m",
    modelPath,
    "-f",
    filePath,
    "-otxt",
    "-of",
    outputBase,
  ];

  if (language && language !== "auto") {
    args.push("-l", language);
  }

  console.log(`[transcribe] Menjalankan Whisper lokal: ${binaryPath}`);
  const { stdout } = await runCommand(binaryPath, args, { maxBuffer: 1024 * 1024 * 64 });
  const outputPath = `${outputBase}.txt`;
  const text = fs.existsSync(outputPath)
    ? fs.readFileSync(outputPath, "utf8").trim()
    : stdout.trim();

  if (!text) {
    throw new Error("Whisper lokal tidak menghasilkan transkripsi");
  }

  return text;
}
