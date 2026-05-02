import { GoogleGenerativeAI } from "@google/generative-ai";
import { appConfig } from "@/lib/autoclip/config";
import type { MomentType } from "@/lib/autoclip/types";

// ─── Public Types ──────────────────────────────────────────────────────────────

export type VideoContext = {
  title?: string;
  description?: string;
  channelName?: string;
};

export type AnalysisProviderSource = "gemini" | "local";

export type RawAiSegment = {
  start_ms: number;
  end_ms: number;
  moment_type: MomentType;
  score: number;           // 0.0–1.0
  reason: string;
  hook_suggestion: string;
  text: string;
};

export type AnalysisProviderResult = {
  source: AnalysisProviderSource;
  segments: RawAiSegment[];
};

// ─── Internal Types ────────────────────────────────────────────────────────────

type Pass1Segment = {
  start_ms: number;
  end_ms: number;
  moment_type: MomentType;
  text: string;
  reason: string;
};

// ─── Constants ─────────────────────────────────────────────────────────────────

const VALID_MOMENT_TYPES: MomentType[] = [
  "hook", "humor", "punchline", "insight", "emosi", "kontroversial",
];
const VALID_MOMENT_TYPE_SET = new Set<string>(VALID_MOMENT_TYPES);

// ─── Prompt Builders ───────────────────────────────────────────────────────────

function buildPass1Prompt(
  transcript: string,
  videoTitle: string,
  videoDescription: string,
  channelName: string
): string {
  return `Kamu adalah AI content analyst yang ahli mengidentifikasi momen viral dari transkrip video.

KONTEKS VIDEO:
- Judul: ${videoTitle}
- Channel: ${channelName}
- Deskripsi: ${videoDescription}

TRANSKRIP:
${transcript}

TUGAS: Identifikasi SEMUA segmen yang berpotensi menjadi clip viral untuk YouTube Shorts / TikTok / Reels.

Deteksi berdasarkan 6 kategori ini:
1. HOOK — kalimat pembuka yang langsung menarik perhatian, membuat penonton berhenti scroll
2. HUMOR — momen lucu, ironi, sarkasme, atau kalimat yang mengundang tawa
3. PUNCHLINE — kesimpulan mengejutkan, twist, atau payoff dari sebuah cerita
4. INSIGHT — pernyataan unexpected, counterintuitive, atau membuka perspektif baru
5. EMOSI — momen dengan intensitas tinggi: frustrasi, haru, semangat, kemarahan, kegembiraan
6. KONTROVERSIAL — pendapat berani, melawan arus, atau menantang asumsi umum

ATURAN:
- Durasi setiap segmen: 15–45 detik (ideal untuk Shorts/TikTok)
- Maksimal 45 detik, minimal 15 detik
- Setiap segmen harus bisa berdiri sendiri tanpa konteks tambahan
- Jika ada momen yang masuk lebih dari satu kategori, pilih yang paling dominan
- Cari minimal 5, maksimal 15 kandidat

OUTPUT FORMAT (JSON array):
[
  {
    "start_ms": number,
    "end_ms": number,
    "moment_type": "hook" | "humor" | "punchline" | "insight" | "emosi" | "kontroversial",
    "text": "kutipan singkat dari transkrip",
    "reason": "satu kalimat kenapa momen ini layak jadi clip"
  }
]

Kembalikan HANYA JSON array, tanpa penjelasan lain.`;
}

function buildPass2Prompt(
  pass1Results: Pass1Segment[],
  videoTitle: string,
  channelName: string
): string {
  return `Kamu adalah AI content strategist untuk YouTube Shorts dan TikTok.

KONTEKS VIDEO:
- Judul: ${videoTitle}
- Channel: ${channelName}

KANDIDAT MOMEN:
${JSON.stringify(pass1Results, null, 2)}

TUGAS: Beri skor 0.0–1.0 untuk setiap kandidat berdasarkan kriteria ini:
- Daya tarik dalam 3 detik pertama (apakah penonton akan berhenti scroll?)
- Kelengkapan cerita (apakah bisa dipahami tanpa konteks?)
- Potensi engagement (apakah orang akan comment, share, atau save?)
- Relevansi emosional (apakah memicu respons emosi?)

Lalu:
1. Ranking dari skor tertinggi ke terendah
2. Kembalikan MAKSIMAL 5 clip terbaik
3. Untuk setiap clip, tambahkan hook_suggestion — satu kalimat pendek yang bisa dipakai sebagai teks overlay di 3 detik pertama

OUTPUT FORMAT (JSON array):
[
  {
    "start_ms": number,
    "end_ms": number,
    "moment_type": string,
    "score": number,
    "text": string,
    "reason": string,
    "hook_suggestion": string
  }
]

Kembalikan HANYA JSON array, tanpa penjelasan lain. Urutkan dari score tertinggi.`;
}

function buildSinglePassPrompt(
  transcript: string,
  videoTitle: string,
  videoDescription: string,
  channelName: string
): string {
  return `Kamu adalah AI content strategist untuk YouTube Shorts dan TikTok.

KONTEKS VIDEO:
- Judul: ${videoTitle}
- Channel: ${channelName}
- Deskripsi: ${videoDescription}

TRANSKRIP:
${transcript}

TUGAS: Pilih MAKSIMAL 5 momen terbaik yang layak dijadikan clip viral (15–45 detik).

Kategori: hook, humor, punchline, insight, emosi, kontroversial.
Beri skor 0.0–1.0 dan tambahkan hook_suggestion untuk setiap clip.

OUTPUT FORMAT (JSON array, urutkan dari score tertinggi):
[
  {
    "start_ms": number,
    "end_ms": number,
    "moment_type": "hook" | "humor" | "punchline" | "insight" | "emosi" | "kontroversial",
    "score": number,
    "text": "kutipan dari transkrip",
    "reason": "mengapa ini layak viral",
    "hook_suggestion": "kalimat overlay untuk 3 detik pertama"
  }
]

Kembalikan HANYA JSON array, tanpa penjelasan lain.`;
}

// ─── Parsers ───────────────────────────────────────────────────────────────────

function extractJsonArray(text: string): unknown[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) throw new Error("Response tidak berisi JSON array");
  const parsed: unknown = JSON.parse(match[0]);
  if (!Array.isArray(parsed)) throw new Error("JSON bukan array");
  return parsed;
}

function parsePass1Response(text: string): Pass1Segment[] {
  const items = extractJsonArray(text);
  return items.filter((item): item is Pass1Segment => {
    if (!item || typeof item !== "object") return false;
    const s = item as Record<string, unknown>;
    if (!Number.isFinite(s.start_ms) || !Number.isFinite(s.end_ms)) return false;
    if ((s.end_ms as number) - (s.start_ms as number) < 5000) return false;
    if (!VALID_MOMENT_TYPE_SET.has(s.moment_type as string)) return false;
    if (typeof s.text !== "string" || (s.text as string).trim().length === 0) return false;
    if (typeof s.reason !== "string") return false;
    return true;
  });
}

function parsePass2Response(text: string): RawAiSegment[] {
  const items = extractJsonArray(text);
  return items.filter((item): item is RawAiSegment => {
    if (!item || typeof item !== "object") return false;
    const s = item as Record<string, unknown>;
    if (!Number.isFinite(s.start_ms) || !Number.isFinite(s.end_ms)) return false;
    if ((s.end_ms as number) - (s.start_ms as number) < 5000) return false;
    if (!VALID_MOMENT_TYPE_SET.has(s.moment_type as string)) return false;
    if (typeof s.score !== "number" || (s.score as number) < 0 || (s.score as number) > 1) return false;
    if (typeof s.reason !== "string" || (s.reason as string).trim().length === 0) return false;
    if (typeof s.hook_suggestion !== "string") return false;
    if (typeof s.text !== "string" || (s.text as string).trim().length === 0) return false;
    return true;
  });
}

// ─── Low-level AI Call ─────────────────────────────────────────────────────────

async function callGemini(prompt: string): Promise<string> {
  const apiKey = appConfig.ai.gemini.apiKey;
  if (!apiKey) throw new Error("GEMINI_API_KEY belum dikonfigurasi");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel(
    { model: appConfig.ai.gemini.model },
    { apiVersion: "v1" }
  );

  console.log(`[ai] Gemini (${appConfig.ai.gemini.model}) — mengirim prompt.`);
  const result = await model.generateContent(prompt);
  return result.response.text();
}

async function callOllama(prompt: string): Promise<string> {
  const response = await fetch(`${appConfig.ai.ollama.baseUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: appConfig.ai.ollama.model,
      prompt,
      stream: false,
      format: "json",
      options: { temperature: 0.2, num_ctx: 8192 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama error ${response.status}: ${await response.text()}`);
  }

  const payload = (await response.json()) as { response?: string };
  const text = payload.response ?? "";
  console.log(`[ai] Ollama (${appConfig.ai.ollama.model}): ${text.slice(0, 120)}`);
  return text;
}

async function callAI(
  prompt: string
): Promise<{ text: string; source: AnalysisProviderSource }> {
  const provider = appConfig.ai.provider;

  if (provider === "local") {
    return { text: await callOllama(prompt), source: "local" };
  }

  if (provider === "gemini") {
    return { text: await callGemini(prompt), source: "gemini" };
  }

  // auto: Gemini first, Ollama fallback
  if (appConfig.ai.gemini.apiKey) {
    try {
      return { text: await callGemini(prompt), source: "gemini" };
    } catch (err) {
      console.warn("[ai] Gemini gagal, coba Ollama:", err instanceof Error ? err.message : err);
    }
  }

  return { text: await callOllama(prompt), source: "local" };
}

// ─── Pass 1 ───────────────────────────────────────────────────────────────────

export async function analyzeTranscriptPass1(
  transcript: string,
  videoTitle: string,
  videoDescription: string,
  channelName: string
): Promise<{ segments: Pass1Segment[]; source: AnalysisProviderSource }> {
  const prompt = buildPass1Prompt(transcript, videoTitle, videoDescription, channelName);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text, source } = await callAI(prompt);
      const segments = parsePass1Response(text);
      if (segments.length === 0) throw new Error("Pass 1 mengembalikan 0 segmen valid");
      console.log(`[ai] Pass 1 selesai: ${segments.length} kandidat (attempt ${attempt})`);
      return { segments, source };
    } catch (err) {
      console.warn(`[ai] Pass 1 attempt ${attempt} gagal:`, err instanceof Error ? err.message : err);
      if (attempt === 2) throw err;
    }
  }

  throw new Error("Pass 1 gagal setelah 2 percobaan");
}

// ─── Pass 2 ───────────────────────────────────────────────────────────────────

export async function rankAndScorePass2(
  pass1Results: Pass1Segment[],
  videoTitle: string,
  channelName: string
): Promise<{ segments: RawAiSegment[]; source: AnalysisProviderSource }> {
  const prompt = buildPass2Prompt(pass1Results, videoTitle, channelName);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text, source } = await callAI(prompt);
      const segments = parsePass2Response(text);
      if (segments.length === 0) throw new Error("Pass 2 mengembalikan 0 segmen valid");
      console.log(`[ai] Pass 2 selesai: ${segments.length} clip dipilih (attempt ${attempt})`);
      return { segments, source };
    } catch (err) {
      console.warn(`[ai] Pass 2 attempt ${attempt} gagal:`, err instanceof Error ? err.message : err);
      if (attempt === 2) throw err;
    }
  }

  throw new Error("Pass 2 gagal setelah 2 percobaan");
}

// ─── Single-pass Fallback ─────────────────────────────────────────────────────

async function analyzeTranscriptSinglePass(
  transcript: string,
  videoTitle: string,
  videoDescription: string,
  channelName: string
): Promise<AnalysisProviderResult> {
  const prompt = buildSinglePassPrompt(transcript, videoTitle, videoDescription, channelName);

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { text, source } = await callAI(prompt);
      const segments = parsePass2Response(text);
      if (segments.length === 0) throw new Error("Single-pass mengembalikan 0 segmen valid");
      return { source, segments };
    } catch (err) {
      console.warn(`[ai] Single-pass attempt ${attempt} gagal:`, err instanceof Error ? err.message : err);
      if (attempt === 2) throw err;
    }
  }

  throw new Error("Single-pass gagal setelah 2 percobaan");
}

// ─── Public Entry ──────────────────────────────────────────────────────────────

export async function analyzeTranscript(
  transcript: string,
  ctx?: VideoContext
): Promise<AnalysisProviderResult> {
  if (appConfig.ai.provider === "fallback") {
    throw new Error("AI_PROVIDER=fallback; skip external AI analysis");
  }

  const videoTitle       = ctx?.title       ?? "";
  const videoDescription = ctx?.description ?? "";
  const channelName      = ctx?.channelName  ?? "";

  // ── Two-pass approach ──────────────────────────────────────────────────────
  try {
    const pass1 = await analyzeTranscriptPass1(
      transcript, videoTitle, videoDescription, channelName
    );
    const pass2 = await rankAndScorePass2(
      pass1.segments, videoTitle, channelName
    );
    return { source: pass2.source, segments: pass2.segments };
  } catch (err) {
    console.warn(
      "[ai] Two-pass gagal, mencoba single-pass fallback:",
      err instanceof Error ? err.message : err
    );
  }

  // ── Single-pass fallback ───────────────────────────────────────────────────
  return analyzeTranscriptSinglePass(
    transcript, videoTitle, videoDescription, channelName
  );
}
