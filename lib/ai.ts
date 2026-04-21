import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum terbaca dari .env.local");
  }

  return new GoogleGenerativeAI(apiKey);
}

export async function analyzeTranscript(transcript: string) {
  const genAI = getGeminiClient();
  const model = genAI.getGenerativeModel(
    { model: "gemini-2.0-flash" },
    { apiVersion: "v1" }
  );

  const prompt = `
Kamu adalah AI yang memilih bagian paling menarik dari video.

Tugas:
- Ambil bagian penting, menarik, atau viral
- Buat maksimal 3 segmen
- Output HARUS hanya JSON array
- Jangan tambahkan penjelasan apa pun

Contoh output:
[
  { "start": 10, "end": 25, "text": "..." },
  { "start": 40, "end": 60, "text": "..." }
]

Transkrip:
${transcript}
  `;

  console.log(`[ai.ts] Mengirim transkrip ke Gemini untuk analisis — ${transcript.length} karakter`);

  let result;
  try {
    result = await model.generateContent(prompt);
  } catch (err) {
    console.error("[ai.ts] ERROR saat memanggil Gemini generateContent:");
    console.error("  message  :", err instanceof Error ? err.message : String(err));
    console.error("  status   :", (err as Record<string, unknown>)?.status ?? "n/a");
    console.error("  errorDetails:", JSON.stringify((err as Record<string, unknown>)?.errorDetails ?? null));
    console.error("  stack    :", err instanceof Error ? err.stack : "—");
    console.error("  raw error:", err);
    throw err;
  }

  const text = result.response.text();
  console.log("[ai.ts] Response Gemini raw:", text.slice(0, 300));

  const match = text.match(/\[[\s\S]*\]/);

  if (!match) {
    console.error("[ai.ts] Tidak ditemukan JSON array dalam response. Full response:", text);
    throw new Error("AI response bukan JSON valid");
  }

  return JSON.parse(match[0]);
}
