import { NextResponse } from "next/server";
import fs from "fs";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { appConfig } from "@/lib/autoclip/config";

type CheckStatus = "ok" | "warn" | "error";

interface Check {
  name: string;
  status: CheckStatus;
  message: string;
}

interface HealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  version: string;
  uptime: number;
  checks: Check[];
}

function checkBinary(label: string, envPath: string | null | undefined): Check {
  if (envPath) {
    const exists = fs.existsSync(envPath);
    return {
      name: label,
      status: exists ? "ok" : "error",
      message: exists
        ? `Found at ${envPath}`
        : `Configured but NOT found at: ${envPath}`,
    };
  }

  return {
    name: label,
    status: "warn",
    message: "Not set in .env; must be available on system PATH",
  };
}

async function checkGeminiConnection(apiKey: string): Promise<Check> {
  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel(
      { model: appConfig.ai.gemini.model },
      { apiVersion: "v1" }
    );
    const result = await model.generateContent("Reply with OK only.");
    const text = result.response.text().trim();

    return {
      name: "Gemini API connection",
      status: text ? "ok" : "warn",
      message: text ? "Verified with live Gemini request" : "Gemini responded with empty text",
    };
  } catch (error) {
    return {
      name: "Gemini API connection",
      status: "error",
      message: error instanceof Error ? error.message : "Gemini verification failed",
    };
  }
}

async function checkOllamaConnection(): Promise<Check> {
  try {
    const response = await fetch(`${appConfig.ai.ollama.baseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: appConfig.ai.ollama.model,
        prompt: "Reply with OK only.",
        stream: false,
      }),
    });

    if (!response.ok) {
      return {
        name: "Ollama connection",
        status: "error",
        message: `Ollama responded ${response.status}: ${await response.text()}`,
      };
    }

    return {
      name: "Ollama connection",
      status: "ok",
      message: `Verified local model ${appConfig.ai.ollama.model}`,
    };
  } catch (error) {
    return {
      name: "Ollama connection",
      status: "error",
      message: error instanceof Error ? error.message : "Ollama verification failed",
    };
  }
}

export async function GET(request: Request): Promise<NextResponse<HealthResponse>> {
  const checks: Check[] = [];
  const verify = new URL(request.url).searchParams.get("verify");

  checks.push({
    name: "AI_PROVIDER",
    status: "ok",
    message: appConfig.ai.provider,
  });

  const geminiKey = appConfig.ai.gemini.apiKey;
  checks.push({
    name: "GEMINI_API_KEY",
    status: geminiKey && geminiKey.length > 10 ? "ok" : "warn",
    message: geminiKey
      ? `Present; Gemini model ${appConfig.ai.gemini.model}`
      : "Missing; transcription and analysis will use fallback heuristics",
  });

  if (verify === "gemini" && geminiKey && geminiKey.length > 10) {
    checks.push(await checkGeminiConnection(geminiKey));
  }

  checks.push({
    name: "Ollama local AI",
    status: appConfig.ai.provider === "local" || appConfig.ai.provider === "auto" ? "warn" : "ok",
    message: `${appConfig.ai.ollama.baseUrl} using ${appConfig.ai.ollama.model}`,
  });

  if (verify === "local") {
    checks.push(await checkOllamaConnection());
  }

  checks.push({
    name: "Whisper local transcription",
    status:
      appConfig.ai.whisper.binaryPath && appConfig.ai.whisper.modelPath
        ? fs.existsSync(appConfig.ai.whisper.binaryPath) && fs.existsSync(appConfig.ai.whisper.modelPath)
          ? "ok"
          : "error"
        : "warn",
    message:
      appConfig.ai.whisper.binaryPath && appConfig.ai.whisper.modelPath
        ? "Configured via WHISPER_CPP_PATH and WHISPER_MODEL_PATH"
        : "Not configured; local transcription will use fallback unless Gemini works",
  });

  const pexelsKey = process.env.PEXELS_API_KEY;
  checks.push({
    name: "PEXELS_API_KEY",
    status: pexelsKey && pexelsKey !== "PASTE_YOUR_PEXELS_KEY_HERE" ? "ok" : "warn",
    message:
      pexelsKey && pexelsKey !== "PASTE_YOUR_PEXELS_KEY_HERE"
        ? "Present"
        : "Missing (optional; stock video for generation)",
  });

  checks.push(checkBinary("ffmpeg", appConfig.binaries.ffmpeg));
  checks.push(checkBinary("ffprobe", appConfig.binaries.ffprobe));
  checks.push(checkBinary("yt-dlp", appConfig.binaries.ytDlp));

  const jobsDir = ".autoclip/jobs";
  try {
    fs.mkdirSync(jobsDir, { recursive: true });
    checks.push({ name: "jobs_storage", status: "ok", message: `Writable: ${jobsDir}` });
  } catch {
    checks.push({
      name: "jobs_storage",
      status: "error",
      message: `Cannot write to ${jobsDir}; check permissions`,
    });
  }

  const hasError = checks.some((c) => c.status === "error");
  const hasWarn = checks.some((c) => c.status === "warn");

  const body: HealthResponse = {
    status: hasError ? "unhealthy" : hasWarn ? "degraded" : "healthy",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    uptime: process.uptime(),
    checks,
  };

  return NextResponse.json(body, { status: hasError ? 503 : 200 });
}
