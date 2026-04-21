import { CandidateSegment, TranscriptChunk } from "@/lib/autoclip/types";

function extractKeywords(text: string) {
  return Array.from(
    new Set(
      text
        .toLowerCase()
        .match(/[a-z][a-z'-]{3,}/g)
        ?.filter((word) => !["this", "that", "with", "from", "into", "your"].includes(word)) ?? []
    )
  ).slice(0, 5);
}

export function buildFallbackSegments(chunks: TranscriptChunk[]) {
  return chunks.slice(0, 5).map<CandidateSegment>((chunk, index) => ({
    start: chunk.start,
    end: chunk.end,
    text: chunk.text,
    reason:
      index === 0
        ? "Strong opener with a clear promise."
        : index % 2 === 0
          ? "Practical insight with reusable advice."
          : "Curiosity-driven moment that can work as a short clip.",
    keywords: extractKeywords(chunk.text),
  }));
}
