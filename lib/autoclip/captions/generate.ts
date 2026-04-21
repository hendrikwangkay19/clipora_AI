import { ScoredSegment } from "@/lib/autoclip/types";

function titleCase(text: string) {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 8)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function generateCaptionPayload(segment: ScoredSegment) {
  const primaryKeyword = segment.keywords[0] || "growth";
  const hook = titleCase(segment.text) || "Watch This Clip";

  return {
    hook,
    caption: `${segment.reason} ${segment.text}`.slice(0, 220),
    hashtags: [
      "#autoclip",
      "#shorts",
      "#viral",
      `#${primaryKeyword.replace(/[^a-z0-9]/gi, "")}`,
    ],
    subtitleText: segment.text,
  };
}
