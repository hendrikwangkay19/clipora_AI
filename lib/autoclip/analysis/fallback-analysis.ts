import { CandidateSegment, TranscriptChunk } from "@/lib/autoclip/types";

const STOP_WORDS = new Set([
  "yang",
  "dan",
  "dari",
  "untuk",
  "dengan",
  "kita",
  "anda",
  "atau",
  "this",
  "that",
  "with",
  "from",
  "into",
  "your",
]);

const HOOK_TERMS = [
  "rahasia",
  "masalah",
  "solusi",
  "cara",
  "tips",
  "hasil",
  "jualan",
  "bisnis",
  "konten",
  "creator",
  "penting",
  "jangan",
  "kenapa",
  "bagaimana",
  "cepat",
  "mudah",
  "viral",
  "order",
  "whatsapp",
  "promo",
];

function extractKeywords(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[\p{L}\p{N}][\p{L}\p{N}'-]{3,}/gu)
        ?.filter((word) => !STOP_WORDS.has(word)) ?? []
    )
  ).slice(0, 6);
}

function scoreChunk(chunk: TranscriptChunk, index: number) {
  const text = chunk.text.toLowerCase();
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  const hookHits = HOOK_TERMS.filter((term) => text.includes(term)).length;
  const hasQuestion = text.includes("?") || /\b(kenapa|apa|bagaimana|mengapa|why|how|what)\b/.test(text);
  const hasNumber = /\d+/.test(text);
  const hasCta = /\b(order|chat|klik|daftar|beli|subscribe|follow|share)\b/.test(text);
  const duration = Math.max(1, chunk.end - chunk.start);

  return (
    hookHits * 3 +
    (hasQuestion ? 2.5 : 0) +
    (hasNumber ? 1.5 : 0) +
    (hasCta ? 1.5 : 0) +
    Math.min(wordCount / 18, 2) +
    Math.min(duration / 45, 1) +
    Math.max(0, 1.5 - index * 0.18)
  );
}

function explain(chunk: TranscriptChunk, index: number) {
  const text = chunk.text.toLowerCase();
  if (text.includes("?") || /\b(kenapa|apa|bagaimana|mengapa)\b/.test(text)) {
    return "Dipilih fallback karena memuat pertanyaan atau rasa ingin tahu yang cocok sebagai hook.";
  }
  if (/\d+/.test(text)) {
    return "Dipilih fallback karena memuat angka atau klaim spesifik yang mudah dijadikan highlight.";
  }
  if (/\b(order|chat|klik|daftar|beli|subscribe|follow|share)\b/.test(text)) {
    return "Dipilih fallback karena dekat dengan CTA atau aksi audiens.";
  }
  if (index === 0) {
    return "Dipilih fallback sebagai pembuka yang memberi konteks awal untuk clip.";
  }
  return "Dipilih fallback karena punya panjang dan kata kunci yang cukup kuat untuk potongan pendek.";
}

export function buildFallbackSegments(chunks: TranscriptChunk[]) {
  const ranked = chunks
    .map((chunk, index) => ({ chunk, index, score: scoreChunk(chunk, index) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .sort((a, b) => a.chunk.start - b.chunk.start);

  return ranked.map<CandidateSegment>(({ chunk, index }) => ({
    start: chunk.start,
    end: chunk.end,
    text: chunk.text,
    reason: explain(chunk, index),
    keywords: extractKeywords(chunk.text),
  }));
}
