import fs from "fs/promises";
import { AppError } from "@/lib/autoclip/errors";
import { StockVideoInfo } from "./types";

const PEXELS_API_KEY = process.env.PEXELS_API_KEY?.trim() ?? "";
const PEXELS_SEARCH_URL = "https://api.pexels.com/videos/search";
const FALLBACK_QUERIES = ["nature", "city", "technology", "people", "sky"];

type PexelsVideo = {
  id: number;
  duration: number;
  video_files: Array<{
    link: string;
    width: number;
    height: number;
    quality: string;
  }>;
};

type PexelsResponse = {
  videos: PexelsVideo[];
  total_results: number;
};

async function searchPexels(query: string): Promise<StockVideoInfo | null> {
  const url = `${PEXELS_SEARCH_URL}?query=${encodeURIComponent(query)}&per_page=10&min_width=720&orientation=landscape`;

  const response = await fetch(url, {
    headers: { Authorization: PEXELS_API_KEY },
  });

  if (!response.ok) {
    throw new AppError(
      `Pexels API error: ${response.status} ${response.statusText}`,
      "PEXELS_ERROR",
      502
    );
  }

  const data = (await response.json()) as PexelsResponse;

  for (const video of data.videos ?? []) {
    // Prefer HD quality, fallback to first available
    const file =
      video.video_files.find((f) => f.quality === "hd" && f.width >= 1280) ??
      video.video_files.find((f) => f.width >= 720) ??
      video.video_files[0];

    if (file?.link) {
      return {
        id: video.id,
        url: file.link,
        width: file.width,
        height: file.height,
        duration: video.duration,
      };
    }
  }

  return null;
}

export async function findStockVideo(keywords: string[]): Promise<StockVideoInfo> {
  if (!PEXELS_API_KEY || PEXELS_API_KEY === "PASTE_YOUR_PEXELS_KEY_HERE") {
    throw new AppError(
      "PEXELS_API_KEY is not set in .env.local. Get a free key at pexels.com/api",
      "MISSING_ENV",
      500
    );
  }

  // Try each keyword, fall back to generic terms
  const queries = [
    keywords.slice(0, 2).join(" "),
    ...keywords.slice(0, 3),
    ...FALLBACK_QUERIES,
  ];

  for (const query of queries) {
    const result = await searchPexels(query);
    if (result) return result;
  }

  throw new AppError(
    "Could not find any stock video from Pexels.",
    "NO_STOCK_VIDEO",
    404
  );
}

export async function downloadVideo(videoUrl: string, outputPath: string): Promise<string> {
  const response = await fetch(videoUrl);

  if (!response.ok) {
    throw new AppError(
      `Failed to download stock video: ${response.status}`,
      "DOWNLOAD_FAILED",
      502
    );
  }

  const buffer = await response.arrayBuffer();
  await fs.writeFile(outputPath, Buffer.from(buffer));

  return outputPath;
}
