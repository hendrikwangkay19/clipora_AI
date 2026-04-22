import { GoogleGenerativeAI } from "@google/generative-ai";
import { appConfig } from "@/lib/autoclip/config";

export type AnalysisProviderSource = "gemini" | "local";

export type RawAiSegment = {
  start: number;
  end: number;
  text: string;
  reason?: string;
  keywords?: string[];
};

export type AnalysisProviderResult = {
  source: AnalysisProviderSource;
  segments: RawAiSegment[];
};

function buildPrompt(transcript: string) {
  return `
Kamu adalah AI editor video pendek untuk creator dan bisnis kecil.

Tugas:
- Pilih maksimal 5 momen paling menarik dari transkrip.
- Utamakan hook kuat, insight praktis, konflik, cerita, angka, atau CTA.
- Setiap segmen wajib punya start, end, text, reason, keywords.
- start dan end harus angka detik.
- Output HARUS JSON array valid saja, tanpa markdown dan tanpa penjelasan.

Contoh:
[
  {
    "start": 10,
    "end": 35,
    "text": "Kalimat penting dari transkrip",
    "reason": "Hook kuat karena membuka masalah yang jelas.",
    "keywords": ["hook", "masalah", "solusi"]
  }
]

Transkrip:
${transcript}
`;
}

function parseSegments(text: string): RawAiSegment[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) {
    throw new Error("AI response tidak berisi JSON array valid");
  }

  const parsed = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) {
    throw new Error("AI response JSON bukan array");
  }

  return parsed.filter((item) => (
    Number.isFinite(item?.start) &&
    Number.isFinite(item?.end) &&
    typeof item?.text === "string" &&
    item.text.trim().length > 0
  ));
}

async function analyzeWithGemini(prompt: string): Promise<AnalysisProviderResult> {
  const apiKey = appConfig.ai.gemini.apiKey;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    { model: appConfig.ai.gemini.model },
    { apiVersion: "v1" }
  );

  console.log(`[ai] Mengirim analisis ke Gemini (${appConfig.ai.gemini.model}).`);
  const result = await model.generateContent(prompt);
  const text = result.response.text();

  return {
    source: "gemini",
    segments: parseSegments(text),
  };
}

async function analyzeWithOllama(prompt: string): Promise<AnalysisProviderResult> {
  const response = await fetch(`${appConfig.ai.ollama.baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: appConfig.ai.ollama.model,
      prompt,
      stream: false,
      format: "json",
      options: {
        temperature: 0.2,
        num_ctx: 8192,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
  }

  const payload = await response.json() as { response?: string };
  const text = payload.response ?? "";
  console.log(`[ai] Response Ollama (${appConfig.ai.ollama.model}): ${text.slice(0, 180)}`);

  return {
    source: "local",
    segments: parseSegments(text),
  };
}

export async function analyzeTranscript(transcript: string): Promise<AnalysisProviderResult> {
  const prompt = buildPrompt(transcript);
  const provider = appConfig.ai.provider;

  if (provider === "fallback") {
    throw new Error("AI_PROVIDER=fallback; skip external AI analysis");
  }

  if (provider === "local") {
    return analyzeWithOllama(prompt);
  }

  if (provider === "gemini") {
    return analyzeWithGemini(prompt);
  }

  const errors: string[] = [];

  if (appConfig.ai.gemini.apiKey) {
    try {
      return await analyzeWithGemini(prompt);
    } catch (error) {
      errors.push(`Gemini: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    return await analyzeWithOllama(prompt);
  } catch (error) {
    errors.push(`Ollama: ${error instanceof Error ? error.message : String(error)}`);
  }

  throw new Error(errors.length ? errors.join(" | ") : "Tidak ada AI provider yang aktif");
}
