import { appConfig } from "@/lib/autoclip/config";
import { CandidateSegment, ScoredSegment, ScoreBreakdown } from "@/lib/autoclip/types";

const emotionWords = [
  // English
  "amazing", "powerful", "shocking", "important", "secret",
  "mistake", "warning", "best", "worst", "incredible",
  "unbelievable", "insane", "crazy", "epic",
  // Indonesian
  "luar biasa", "mengejutkan", "penting", "rahasia",
  "kesalahan", "peringatan", "terbaik", "terburuk",
  "gila", "dahsyat", "menakjubkan", "hebat", "keren",
  "fatal", "berbahaya", "wajib", "harus",
];

const curiosityWords = [
  // English
  "why", "how", "what", "surprise", "instead",
  "but", "however", "myth", "truth", "actually",
  "really", "secret", "hidden", "unknown",
  // Indonesian
  "kenapa", "bagaimana", "apa", "mengapa", "ternyata",
  "padahal", "tapi", "namun", "mitos", "fakta",
  "sebenarnya", "rupanya", "rahasia", "tersembunyi",
  "jarang diketahui", "tidak disangka", "siapa sangka",
];

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function countMatches(text: string, words: string[]) {
  const normalized = text.toLowerCase();
  return words.filter((word) => normalized.includes(word)).length;
}

function scoreSegment(segment: CandidateSegment): ScoreBreakdown {
  const text = segment.text.toLowerCase();
  const duration = Math.max(1, segment.end - segment.start);
  const emotion = clamp(
    0.25 + countMatches(text, emotionWords) * 0.18 + (text.includes("!") ? 0.1 : 0)
  );
  const keyword = clamp(0.2 + Math.min(segment.keywords.length, 5) * 0.15);
  const curiosity = clamp(
    0.2 + countMatches(text, curiosityWords) * 0.16 + (duration <= 35 ? 0.08 : 0)
  );
  const total = Number((emotion * 0.4 + keyword * 0.3 + curiosity * 0.3).toFixed(3));

  return {
    emotion: Number(emotion.toFixed(3)),
    keyword: Number(keyword.toFixed(3)),
    curiosity: Number(curiosity.toFixed(3)),
    total,
  };
}

export function rankSegments(segments: CandidateSegment[]) {
  return segments
    .map<ScoredSegment>((segment) => ({
      ...segment,
      score: scoreSegment(segment),
      rank: 0,
    }))
    .sort((left, right) => right.score.total - left.score.total)
    .slice(0, appConfig.clips.maxCandidates)
    .map((segment, index) => ({
      ...segment,
      rank: index + 1,
    }));
}
