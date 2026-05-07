"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CliporaProjectContext, GeneratedClip, ProcessVideoResult } from "@/lib/autoclip/types";

type AppState = "idle" | "uploading" | "processing" | "done" | "error";
type AspectRatio = "16:9" | "9:16";
type SubtitleStyle = "classic" | "bold" | "minimal";
type HookType = "viral" | "pertanyaan" | "cerita" | "tips";
type Language = "auto" | "id" | "en";
type TargetChannel = "instagram_reels" | "tiktok" | "youtube_shorts" | "whatsapp";
type Objective = NonNullable<CliporaProjectContext["objective"]>;
type Tone = NonNullable<CliporaProjectContext["tone"]>;

type N8nStatus = {
  notified: boolean;
  postProcessing?: string;
  callbackUrl?: string;
};

type N8nDriveResult = {
  clipIndex: number;
  driveUrl?: string;
};

type ProcessResponse = ProcessVideoResult & {
  success: boolean;
  error?: { message: string };
  n8n?: N8nStatus;
};

const STEPS = [
  "Ingest source",
  "Extract audio",
  "Transcribe",
  "Find moments",
  "Plan clips",
  "Render outputs",
];

const OBJECTIVES: Array<{ value: Objective; label: string; detail: string }> = [
  { value: "sales", label: "Sales promo", detail: "Arahkan output ke WhatsApp, katalog, atau link order." },
  { value: "awareness", label: "Awareness", detail: "Bangun jangkauan dan pengenalan brand." },
  { value: "education", label: "Education", detail: "Ambil momen edukatif yang mudah dipahami." },
  { value: "testimonial", label: "Testimonial", detail: "Cari bukti sosial, review, dan trust signals." },
  { value: "live_recap", label: "Live recap", detail: "Ubah live panjang menjadi highlight jualan." },
  { value: "branding", label: "Brand story", detail: "Tekankan cerita founder, nilai, dan karakter brand." },
];

const CHANNELS: Array<{ value: TargetChannel; label: string }> = [
  { value: "instagram_reels", label: "Reels" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube_shorts", label: "Shorts" },
  { value: "whatsapp", label: "WhatsApp" },
];

const TONES: Array<{ value: Tone; label: string }> = [
  { value: "warm", label: "Hangat" },
  { value: "premium", label: "Premium" },
  { value: "friendly", label: "Santai" },
  { value: "persuasive", label: "Persuasif" },
  { value: "educational", label: "Edukatif" },
];

function formatChannel(channel: string) {
  const found = CHANNELS.find((item) => item.value === channel);
  return found?.label ?? channel;
}

function scorePct(total: number) {
  return Math.min(100, Math.round((total / 3) * 100));
}

function buildCaptionWithCta(clip: GeneratedClip, cta: string) {
  return `${clip.caption.caption}\n\n${cta ? `CTA: ${cta}\n` : ""}${clip.caption.hashtags.join(" ")}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 6,
        fontSize: 11,
        fontWeight: 700,
        color: "var(--accent)",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
      }}
    >
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        height: 40,
        width: "100%",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "0 12px",
        fontSize: 13,
        color: "var(--text)",
        outline: "none",
        transition: "border-color 130ms",
        ...props.style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = "var(--accent)";
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        props.onBlur?.(e);
      }}
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        height: 40,
        width: "100%",
        borderRadius: 8,
        border: "1px solid var(--border)",
        background: "var(--surface)",
        padding: "0 12px",
        fontSize: 13,
        color: "var(--text)",
        outline: "none",
        ...props.style,
      }}
    />
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: "10px 12px",
        borderRadius: 8,
        background: "var(--surface-alt)",
        border: "1px solid var(--border)",
      }}
    >
      <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "var(--text-muted)" }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: "var(--text)" }}>
        {value}
      </p>
    </div>
  );
}

function ClipCard({
  clip,
  index,
  cta,
  driveUrl,
}: {
  clip: GeneratedClip;
  index: number;
  cta: string;
  driveUrl?: string;
}) {
  const src = `/api/files?path=${encodeURIComponent(clip.relativePath)}`;
  const caption = buildCaptionWithCta(clip, cta);

  return (
    <article className="clipora-card" style={{ overflow: "hidden" }}>
      <video
        src={src}
        controls
        preload="metadata"
        style={{
          display: "block",
          width: "100%",
          aspectRatio: "16/9",
          background: "#000",
          objectFit: "contain",
        }}
      />
      <div style={{ padding: "16px 18px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            marginBottom: 12,
          }}
        >
          <div>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
              }}
            >
              Clip {index + 1}
            </p>
            <h3
              style={{
                margin: "4px 0 0",
                fontSize: 15,
                fontWeight: 700,
                lineHeight: 1.4,
                color: "var(--text)",
              }}
            >
              {clip.caption.hook}
            </h3>
          </div>
          <div
            style={{
              padding: "6px 10px",
              borderRadius: 8,
              background: "var(--accent-light)",
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            <p style={{ margin: 0, fontSize: 10, fontWeight: 600, color: "var(--text-muted)" }}>
              Score
            </p>
            <p style={{ margin: 0, fontWeight: 700, color: "var(--accent)" }}>
              {scorePct(clip.score.total)}%
            </p>
          </div>
        </div>

        <p style={{ fontSize: 13, lineHeight: 1.7, color: "var(--text-sec)" }}>
          {clip.caption.caption}
        </p>

        {cta ? (
          <p
            style={{
              marginTop: 10,
              padding: 10,
              borderRadius: 8,
              background: "var(--gold-light)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--gold)",
            }}
          >
            CTA: {cta}
          </p>
        ) : null}

        <div style={{ marginTop: 12, display: "flex", flexWrap: "wrap", gap: 6 }}>
          {clip.caption.hashtags.map((tag) => (
            <span
              key={tag}
              style={{
                padding: "3px 10px",
                borderRadius: 999,
                background: "var(--accent-light)",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--accent)",
              }}
            >
              {tag}
            </span>
          ))}
        </div>

        <div style={{ marginTop: 14, display: "flex", flexWrap: "wrap", gap: 8 }}>
          <a href={src} download={`clipora-${index + 1}.mp4`} className="primary-button">
            Download
          </a>
          <button
            type="button"
            className="ghost-button"
            onClick={() => navigator.clipboard.writeText(caption).catch(() => null)}
          >
            Copy caption
          </button>
          {driveUrl ? (
            <a href={driveUrl} target="_blank" rel="noopener noreferrer" className="ghost-button">
              Drive
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function Home() {
  const [state, setState] = useState<AppState>("idle");
  const [projectName, setProjectName] = useState("Promo Mingguan");
  const [workspaceName, setWorkspaceName] = useState("Hendrik Studio");
  const [url, setUrl] = useState("");
  const [objective, setObjective] = useState<Objective>("sales");
  const [tone, setTone] = useState<Tone>("warm");
  const [cta, setCta] = useState("Chat WhatsApp untuk order hari ini");
  const [channels, setChannels] = useState<TargetChannel[]>(["instagram_reels", "tiktok", "whatsapp"]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [maxClips, setMaxClips] = useState<3 | 5 | 10>(3);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("bold");
  const [hookType, setHookType] = useState<HookType>("viral");
  const [language, setLanguage] = useState<Language>("auto");
  const [uploadPct, setUploadPct] = useState(0);
  const [drag, setDrag] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<ProcessVideoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [n8nInfo, setN8nInfo] = useState<N8nStatus | null>(null);
  const [driveResults, setDriveResults] = useState<N8nDriveResult[]>([]);
  const [n8nConnected, setN8nConnected] = useState<boolean | null>(null);
  const [processingUrl, setProcessingUrl] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const contentStudioRef = useRef<HTMLElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isProcessingRef = useRef(false);

  const context = useMemo<CliporaProjectContext>(() => ({
    projectName,
    workspaceName,
    objective,
    targetChannels: channels,
    tone,
    cta,
    brandPreset: "Clipora Warm Sage",
  }), [channels, cta, objective, projectName, tone, workspaceName]);

  const selectedObjective = OBJECTIVES.find((item) => item.value === objective) ?? OBJECTIVES[0];

  const scrollToStudio = useCallback(() => {
    window.setTimeout(() => {
      contentStudioRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 120);
  }, []);

  const loadLatestResult = useCallback(async () => {
    const response = await fetch("/api/jobs/latest");
    if (!response.ok) return false;

    const data = await response.json();
    if (!data?.success || !data.result) return false;

    const latest = data.result as ProcessVideoResult;
    setResult(latest);
    setState("done");
    setProjectName(data.job?.cliporaContext?.projectName ?? "Latest Clipora Project");
    setWorkspaceName(data.job?.cliporaContext?.workspaceName ?? "Hendrik Studio");
    setCta(data.job?.cliporaContext?.cta ?? "Chat WhatsApp untuk order hari ini");
    scrollToStudio();
    return true;
  }, [scrollToStudio]);

  useEffect(() => {
    fetch("/api/n8n")
      .then((response) => {
        if (!response.ok) { setN8nConnected(false); return null; }
        return response.json() as Promise<{ n8n?: { status?: string } }>;
      })
      .then((data) => { if (data !== null) setN8nConnected(data?.n8n?.status === "connected"); })
      .catch(() => setN8nConnected(false));
  }, []);

  useEffect(() => {
    const id = window.setTimeout(() => {
      void loadLatestResult().catch(() => null);
    }, 0);

    return () => window.clearTimeout(id);
  }, [loadLatestResult]);

  useEffect(() => {
    if (!result || !n8nInfo?.notified) return;
    const jobId = result.job.id;

    const poll = async () => {
      try {
        const response = await fetch(`/api/jobs/${jobId}/n8n-result`);
        if (!response.ok) return;
        const data = await response.json();
        if (data?.success && data.results?.length) {
          setDriveResults(data.results);
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // Polling is opportunistic; local clips remain available.
      }
    };

    pollRef.current = setInterval(poll, 10000);
    void poll();

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [n8nInfo, result]);

  const startTimer = () => {
    setStep(0);
    timer.current = setInterval(() => setStep((previous) => Math.min(previous + 1, STEPS.length - 1)), 12000);
  };

  const stopTimer = () => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  };

  const callProcess = useCallback(async (body: Record<string, unknown>, signal?: AbortSignal) => {
    const response = await fetch("/api/process-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        ...body,
        aspectRatio,
        maxClips,
        burnSubtitles: true,
        subtitleStyle,
        language: language === "auto" ? undefined : language,
        hookType,
        cliporaContext: context,
      }),
    });

    const data = (await response.json()) as ProcessResponse;
    if (!response.ok || !data.success) {
      throw new Error(data.error?.message ?? "Pipeline gagal diproses.");
    }

    return data;
  }, [aspectRatio, context, hookType, language, maxClips, subtitleStyle]);

  const handleResult = useCallback(async (data: ProcessResponse) => {
    stopTimer();
    setStep(STEPS.length);
    setN8nInfo(data.n8n ?? null);

    // Fetch fresh result from disk using the new job ID — this is the authoritative source
    try {
      const res = await fetch(`/api/jobs/${data.job.id}`);
      if (res.ok) {
        const json = await res.json() as { success: boolean; job?: { result?: ProcessVideoResult } };
        if (json.success && json.job?.result) {
          setResult(json.job.result);
          setState("done");
          scrollToStudio();
          return;
        }
      }
    } catch { /* ignore, fall through to direct response */ }

    // Fallback: render directly from the callProcess response
    setResult(data as unknown as ProcessVideoResult);
    setState("done");
    scrollToStudio();
  }, [scrollToStudio]);

  const handleFile = useCallback(async (file: File) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("uploading");
    setUploadPct(0);
    setError(null);
    setResult(null);
    setN8nInfo(null);
    setDriveResults([]);
    setProcessingUrl(file.name);

    try {
      const formData = new FormData();
      formData.append("video", file);
      const localPath = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
        controller.signal.addEventListener("abort", () => { xhr.abort(); reject(new DOMException("Dibatalkan.", "AbortError")); });
        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            setUploadPct(Math.round((event.loaded / event.total) * 100));
          }
        };
        xhr.onload = () => {
          try {
            const payload = JSON.parse(xhr.responseText) as { success: boolean; localPath?: string; error?: string };
            if (payload.success && payload.localPath) {
              resolve(payload.localPath);
            } else {
              reject(new Error(payload.error ?? "Upload gagal."));
            }
          } catch {
            reject(new Error("Response upload tidak valid."));
          }
        };
        xhr.onerror = () => reject(new Error("Upload gagal."));
        xhr.send(formData);
      });

      setState("processing");
      startTimer();
      const data = await callProcess({ localPath }, controller.signal);
      await handleResult(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      stopTimer();
      setError(err instanceof Error ? err.message : "Error tidak diketahui.");
      setState("error");
    } finally {
      setProcessingUrl(null);
      isProcessingRef.current = false;
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [callProcess, handleResult]);

  const handleUrl = useCallback(async () => {
    if (!url.trim() || isProcessingRef.current) return;
    isProcessingRef.current = true;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState("processing");
    setError(null);
    setResult(null);
    setN8nInfo(null);
    setDriveResults([]);
    setProcessingUrl(url.trim());
    startTimer();

    try {
      const data = await callProcess({ url: url.trim() }, controller.signal);
      await handleResult(data);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      stopTimer();
      setError(err instanceof Error ? err.message : "Error tidak diketahui.");
      setState("error");
    } finally {
      setProcessingUrl(null);
      isProcessingRef.current = false;
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [callProcess, handleResult, url]);

  const toggleChannel = (channel: TargetChannel) => {
    setChannels((current) => (
      current.includes(channel)
        ? current.filter((item) => item !== channel)
        : [...current, channel]
    ));
  };

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    isProcessingRef.current = false;
    stopTimer();
    setState("idle");
    setResult(null);
    setError(null);
    setStep(0);
    setN8nInfo(null);
    setDriveResults([]);
    setProcessingUrl(null);
  };

  const isBusy = state === "uploading" || state === "processing";

  return (
    <div style={{ padding: "24px", maxWidth: 1400, margin: "0 auto" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

        {/* ── Hero / Stats ──────────────────────────────────── */}
        <section id="home" className="clipora-card" style={{ overflow: "hidden" }}>
          <div style={{ padding: "20px 24px 24px" }}>
            <p
              style={{
                margin: 0,
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "var(--accent)",
              }}
            >
              Clipora · Clip Studio
            </p>
            <h1
              style={{
                margin: "6px 0 8px",
                fontSize: "clamp(1.5rem, 2.5vw, 2.2rem)",
                fontWeight: 800,
                lineHeight: 1.25,
                color: "var(--text)",
              }}
            >
              Creator content workflow
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-sec)", lineHeight: 1.6 }}>
              Masukkan video, pilih objective, lalu review clip siap distribusi.
            </p>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, 1fr)",
                gap: 10,
                marginTop: 20,
              }}
            >
              <MiniMetric label="Clips" value={result ? `${result.clips.length}` : "0"} />
              <MiniMetric label="Target" value={`${maxClips}`} />
              <MiniMetric label="Channel" value={`${channels.length}`} />
              <MiniMetric label="AI" value={result ? (result.summary.analysisSource ?? "fallback") : "Ready"} />
              <MiniMetric label="Mode" value={n8nConnected ? "n8n" : "Local"} />
            </div>
          </div>
        </section>

        {/* ── Input + Settings + Summary ───────────────────── */}
        <section
          id="create-content"
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(240px, 0.9fr) minmax(320px, 1.1fr) minmax(200px, 0.75fr)",
            gap: 16,
            alignItems: "start",
          }}
        >
          {/* Source input */}
          <div className="clipora-card" style={{ padding: 18 }}>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--accent)",
              }}
            >
              Source input
            </p>

            {/* Drop zone */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                const file = e.dataTransfer.files[0];
                if (file) void handleFile(file);
              }}
              onClick={() => fileRef.current?.click()}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 160,
                borderRadius: 10,
                border: `1.5px dashed ${drag ? "var(--accent)" : "var(--border-med)"}`,
                background: drag ? "var(--accent-light)" : "var(--surface-alt)",
                cursor: "pointer",
                padding: 16,
                textAlign: "center",
                transition: "border-color 130ms, background 130ms",
              }}
            >
              <div className="clipora-mark" style={{ marginBottom: 10 }} />
              <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "var(--text)" }}>
                {drag ? "Lepaskan video di sini" : "Upload video mentah"}
              </p>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.5 }}>
                MP4, MOV, MKV, AVI, WEBM · maks 500MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.mov,.avi,.mkv,.webm"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </div>

            {/* Divider */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                margin: "14px 0",
                fontSize: 11,
                fontWeight: 700,
                color: "var(--text-muted)",
              }}
            >
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
              ATAU
              <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
            </div>

            <FieldLabel>YouTube URL</FieldLabel>
            <TextInput
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !isBusy) void handleUrl(); }}
              placeholder="https://youtube.com/watch?v=..."
              disabled={isBusy}
            />
            <button
              type="button"
              className="primary-button"
              style={{ width: "100%", marginTop: 12 }}
              disabled={!url.trim() || isBusy}
              onClick={() => void handleUrl()}
            >
              Analyze with AI
            </button>
          </div>

          {/* Project settings */}
          <div className="clipora-card" style={{ padding: 18 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--accent)",
                  }}
                >
                  Project information
                </p>
                <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
                  Create Content
                </h2>
              </div>
              {state === "done" ? (
                <button className="ghost-button" onClick={reset}>
                  New project
                </button>
              ) : null}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <FieldLabel>Project name</FieldLabel>
                <TextInput value={projectName} onChange={(e) => setProjectName(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Workspace</FieldLabel>
                <TextInput value={workspaceName} onChange={(e) => setWorkspaceName(e.target.value)} />
              </div>
              <div>
                <FieldLabel>Objective</FieldLabel>
                <SelectInput value={objective} onChange={(e) => setObjective(e.target.value as Objective)}>
                  {OBJECTIVES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Tone</FieldLabel>
                <SelectInput value={tone} onChange={(e) => setTone(e.target.value as Tone)}>
                  {TONES.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Format</FieldLabel>
                <SelectInput value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}>
                  <option value="9:16">Shorts vertical 9:16</option>
                  <option value="16:9">Landscape 16:9</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Clip count</FieldLabel>
                <SelectInput value={maxClips} onChange={(e) => setMaxClips(Number(e.target.value) as 3 | 5 | 10)}>
                  <option value={3}>3 clips</option>
                  <option value={5}>5 clips</option>
                  <option value={10}>10 clips</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Subtitle style</FieldLabel>
                <SelectInput value={subtitleStyle} onChange={(e) => setSubtitleStyle(e.target.value as SubtitleStyle)}>
                  <option value="classic">Classic</option>
                  <option value="bold">Bold</option>
                  <option value="minimal">Minimal</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>AI hook strategy</FieldLabel>
                <SelectInput value={hookType} onChange={(e) => setHookType(e.target.value as HookType)}>
                  <option value="viral">Viral</option>
                  <option value="pertanyaan">Pertanyaan</option>
                  <option value="cerita">Cerita</option>
                  <option value="tips">Tips</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Subtitle language</FieldLabel>
                <SelectInput value={language} onChange={(e) => setLanguage(e.target.value as Language)}>
                  <option value="auto">Auto detect</option>
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                </SelectInput>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <FieldLabel>Target channels</FieldLabel>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {CHANNELS.map((channel) => (
                  <button
                    key={channel.value}
                    type="button"
                    onClick={() => toggleChannel(channel.value)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: 999,
                      border: "1px solid",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      transition: "all 130ms",
                      borderColor: channels.includes(channel.value)
                        ? "var(--accent)"
                        : "var(--border)",
                      background: channels.includes(channel.value)
                        ? "var(--accent)"
                        : "var(--surface)",
                      color: channels.includes(channel.value)
                        ? "#fff"
                        : "var(--text-sec)",
                    }}
                  >
                    {channel.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <FieldLabel>Main CTA</FieldLabel>
              <TextInput
                value={cta}
                onChange={(e) => setCta(e.target.value)}
                placeholder="Chat WhatsApp untuk order"
              />
            </div>

            {error ? (
              <div
                style={{
                  marginTop: 14,
                  padding: 12,
                  borderRadius: 8,
                  border: "1px solid rgba(208,90,74,0.24)",
                  background: "var(--error-bg)",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--error)",
                }}
              >
                {error}
              </div>
            ) : null}
          </div>

          {/* Output summary + progress */}
          <div className="clipora-card" style={{ padding: 18 }}>
            <p
              style={{
                margin: "0 0 14px",
                fontSize: 11,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                color: "var(--accent)",
              }}
            >
              Output summary
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div className="soft-card" style={{ padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  {selectedObjective.label}
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.6, color: "var(--text-sec)" }}>
                  {selectedObjective.detail}
                </p>
              </div>
              <div className="soft-card" style={{ padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  Channels
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.6, color: "var(--text-sec)" }}>
                  {channels.map(formatChannel).join(", ") || "Belum dipilih"}
                </p>
              </div>
              <div className="soft-card" style={{ padding: 12 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  Brand preset
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 11, lineHeight: 1.6, color: "var(--text-sec)" }}>
                  Warm Sage · {subtitleStyle} · {tone}
                </p>
              </div>
            </div>

            {state === "uploading" ? (
              <div style={{ marginTop: 16 }}>
                <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                  Uploading {uploadPct}%
                </p>
                <div
                  style={{
                    height: 6,
                    borderRadius: 999,
                    background: "var(--accent-light)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      borderRadius: 999,
                      background: "var(--accent)",
                      width: `${uploadPct}%`,
                      transition: "width 200ms",
                    }}
                  />
                </div>
              </div>
            ) : null}

            {state === "processing" ? (
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
                {processingUrl ? (
                  <div
                    style={{
                      padding: 10,
                      borderRadius: 8,
                      border: "1px solid var(--accent-light)",
                      background: "var(--accent-light)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        color: "var(--accent)",
                      }}
                    >
                      Sedang memproses
                    </p>
                    <p
                      style={{
                        margin: "3px 0 0",
                        fontSize: 11,
                        fontWeight: 600,
                        color: "var(--text)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={processingUrl}
                    >
                      {processingUrl}
                    </p>
                  </div>
                ) : null}
                {STEPS.map((item, index) => (
                  <div
                    key={item}
                    style={{
                      padding: "8px 10px",
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 600,
                      background: index <= step ? "var(--accent-light)" : "var(--surface-alt)",
                      color: index <= step ? "var(--accent)" : "var(--text-muted)",
                      border: `1px solid ${index <= step ? "rgba(74,122,101,0.2)" : "var(--border)"}`,
                    }}
                  >
                    {index + 1}. {item}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        {/* ── Content Studio / Results ─────────────────────── */}
        <section
          id="content-studio"
          ref={contentStudioRef}
          className="clipora-card"
          style={{ padding: "18px 24px 24px" }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div>
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "var(--accent)",
                }}
              >
                Content Studio MVP
              </p>
              <h2 style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: "var(--text)" }}>
                Review outputs
              </h2>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
              {n8nInfo ? (
                <span
                  style={{
                    padding: "5px 12px",
                    borderRadius: 999,
                    background: "var(--accent-light)",
                    fontSize: 11,
                    fontWeight: 700,
                    color: "var(--accent)",
                  }}
                >
                  {n8nInfo.notified ? "n8n post-processing active" : "Local output only"}
                </span>
              ) : null}
              <button
                type="button"
                className="ghost-button"
                onClick={() => void loadLatestResult()}
              >
                Refresh latest
              </button>
            </div>
          </div>

          {result?.warnings.length ? (
            <div
              style={{
                marginBottom: 18,
                padding: 14,
                borderRadius: 8,
                border: "1px solid rgba(196,154,60,0.26)",
                background: "var(--warn-bg)",
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  color: "var(--gold)",
                }}
              >
                AI fallback notice
              </p>
              <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4 }}>
                {result.warnings.map((warning) => (
                  <p
                    key={`${warning.step}-${warning.message}`}
                    style={{ margin: 0, fontSize: 12, fontWeight: 600, color: "var(--text)" }}
                  >
                    {warning.step}: {warning.message}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {!result ? (
            <div
              className="soft-card"
              style={{ padding: 32, textAlign: "center" }}
            >
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
                Belum ada project diproses.
              </p>
              <p style={{ margin: "8px 0 0", fontSize: 13, color: "var(--text-sec)" }}>
                Upload video atau paste URL untuk melihat hasil clip di sini.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "0.8fr 1.2fr 0.8fr",
                gap: 16,
                alignItems: "start",
              }}
            >
              {/* Transcript */}
              <div
                className="soft-card"
                style={{ padding: 14, maxHeight: 720, overflowY: "auto" }}
              >
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--text-muted)",
                    }}
                  >
                    Transcript
                  </p>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: "var(--accent-light)",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--accent)",
                    }}
                  >
                    {result.summary.transcriptSource}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    lineHeight: 1.75,
                    color: "var(--text)",
                  }}
                >
                  {result.transcript.text}
                </p>
              </div>

              {/* Clips */}
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {result.clips.map((clip, index) => (
                  <ClipCard
                    key={clip.id}
                    clip={clip}
                    index={index}
                    cta={cta}
                    driveUrl={driveResults.find((item) => item.clipIndex === index)?.driveUrl}
                  />
                ))}
              </div>

              {/* Clip planning */}
              <div className="soft-card" style={{ padding: 14 }}>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    marginBottom: 12,
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.08em",
                      color: "var(--text-muted)",
                    }}
                  >
                    Clip planning
                  </p>
                  <span
                    style={{
                      padding: "3px 8px",
                      borderRadius: 999,
                      background: "var(--gold-light)",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--gold)",
                    }}
                  >
                    {result.summary.analysisSource ?? "fallback"}
                  </span>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {result.segments.map((segment) => (
                    <div
                      key={`${segment.rank}-${segment.start}`}
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        border: "1px solid var(--border)",
                        background: "var(--surface)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: 8,
                          marginBottom: 6,
                        }}
                      >
                        <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: "var(--text)" }}>
                          Rank {segment.rank}
                        </p>
                        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
                          {scorePct(segment.score.total)}%
                        </span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--text-sec)" }}>
                        {segment.reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* ── Roadmap ──────────────────────────────────────── */}
        <section id="roadmap" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
          {[
            ["Phase 1", "Core operasional", "Rebrand, Create Content, metadata Clipora, Content Studio MVP."],
            ["Phase 2", "Business layer", "Campaigns, CTA presets, brand kit dasar, content library."],
            ["Phase 3", "Distribution", "Scheduler, export packaging, Drive/WhatsApp workflow."],
            ["Phase 4", "Feedback", "Analytics snapshots, recommendations, team approval."],
          ].map(([phase, title, detail]) => (
            <div key={phase} className="soft-card" style={{ padding: 14 }}>
              <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "var(--accent)" }}>
                {phase}
              </p>
              <p style={{ margin: "6px 0 4px", fontSize: 13, fontWeight: 800, color: "var(--text)" }}>
                {title}
              </p>
              <p style={{ margin: 0, fontSize: 12, lineHeight: 1.6, color: "var(--text-sec)" }}>
                {detail}
              </p>
            </div>
          ))}
        </section>

      </div>
    </div>
  );
}
