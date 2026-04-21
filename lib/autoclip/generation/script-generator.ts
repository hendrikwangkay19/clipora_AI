import OpenAI from "openai";
import { appConfig } from "@/lib/autoclip/config";
import { AppError } from "@/lib/autoclip/errors";
import { GeneratedScript, VideoLanguage, VideoStyle } from "./types";

const SYSTEM_PROMPTS: Record<VideoLanguage, Record<VideoStyle, string>> = {
  id: {
    informative:
      "Kamu adalah penulis konten video pendek viral. Buat script video yang informatif, menarik, dan cocok untuk YouTube Shorts/TikTok. Gunakan bahasa Indonesia yang natural dan engaging.",
    motivational:
      "Kamu adalah penulis konten motivasi yang powerful. Buat script video motivasi yang menginspirasi dan membuat orang bangkit. Gunakan bahasa Indonesia yang emosional dan kuat.",
    educational:
      "Kamu adalah guru yang pandai menjelaskan hal-hal kompleks dengan cara mudah dipahami. Buat script video edukasi yang clear dan engaging dalam bahasa Indonesia.",
    story:
      "Kamu adalah pencerita yang hebat. Buat script video berupa cerita pendek yang menarik dan mudah diikuti dalam bahasa Indonesia.",
  },
  en: {
    informative:
      "You are a viral short video content writer. Create an informative, engaging script perfect for YouTube Shorts/TikTok.",
    motivational:
      "You are a powerful motivational content writer. Create an inspiring video script that makes people take action.",
    educational:
      "You are a teacher who explains complex things simply. Create a clear and engaging educational video script.",
    story:
      "You are a great storyteller. Create a compelling short story video script.",
  },
};

export async function generateScript(options: {
  topic: string;
  style: VideoStyle;
  language: VideoLanguage;
  durationSeconds: number;
}): Promise<GeneratedScript> {
  if (!appConfig.openAiApiKey) {
    throw new AppError("OPENAI_API_KEY is not set.", "MISSING_ENV", 500);
  }

  const openai = new OpenAI({ apiKey: appConfig.openAiApiKey });
  const systemPrompt = SYSTEM_PROMPTS[options.language][options.style];
  // ~130 wpm average TTS speed
  const wordCount = options.durationSeconds === 30 ? "50-70" : "100-130";

  const userPrompt =
    options.language === "id"
      ? `Topik: "${options.topic}"
Buat script video pendek ${options.durationSeconds} detik. Balas HANYA dengan JSON ini:
{
  "title": "judul konten yang catchy (max 10 kata)",
  "hook": "kalimat pembuka yang langsung menarik perhatian (1-2 kalimat)",
  "body": "isi utama video (${wordCount} kata, faktual dan engaging)",
  "cta": "penutup dengan call-to-action (1 kalimat)",
  "keywords": ["3-5 kata dalam bahasa Inggris untuk cari stock video yang relevan"]
}`
      : `Topic: "${options.topic}"
Create a ${options.durationSeconds}-second short video script. Reply ONLY with this JSON:
{
  "title": "catchy content title (max 10 words)",
  "hook": "attention-grabbing opening (1-2 sentences)",
  "body": "main content (${wordCount} words, factual and engaging)",
  "cta": "closing call-to-action (1 sentence)",
  "keywords": ["3-5 English keywords to search relevant stock video"]
}`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    temperature: 0.8,
    max_tokens: 800,
  });

  const raw = response.choices[0]?.message?.content;
  if (!raw) throw new AppError("AI failed to generate script.", "SCRIPT_FAILED", 500);

  try {
    const parsed = JSON.parse(raw) as {
      title?: string;
      hook?: string;
      body?: string;
      cta?: string;
      keywords?: string[];
    };

    const hook = parsed.hook ?? "";
    const body = parsed.body ?? "";
    const cta = parsed.cta ?? "";
    const fullScript = [hook, body, cta].filter(Boolean).join("\n\n");

    return {
      title: parsed.title ?? options.topic,
      hook,
      body,
      cta,
      fullScript,
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [options.topic],
    };
  } catch {
    throw new AppError("Failed to parse AI script response.", "SCRIPT_PARSE_ERROR", 500);
  }
}
