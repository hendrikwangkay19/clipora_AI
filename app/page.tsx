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
  return <label className="mb-2 block text-[12px] font-bold text-[var(--sage-dark)]">{children}</label>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="h-11 w-full rounded-[12px] border border-[var(--line)] bg-[rgba(255,250,241,0.76)] px-3 text-[14px] text-[var(--ink)] outline-none transition focus:border-[rgba(85,120,98,0.45)]"
    />
  );
}

function SelectInput(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className="h-11 w-full rounded-[12px] border border-[var(--line)] bg-[rgba(255,250,241,0.76)] px-3 text-[14px] text-[var(--ink)] outline-none transition focus:border-[rgba(85,120,98,0.45)]"
    />
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="soft-card p-3">
      <p className="text-[12px] font-bold text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--ink)]">{value}</p>
    </div>
  );
}

function CreatorWorkflowVisual({
  channels,
  result,
}: {
  channels: TargetChannel[];
  result: ProcessVideoResult | null;
}) {
  const clipCount = result ? result.clips.length : channels.length;

  return (
    <div
      style={{
        minHeight: 286,
        border: "1px solid var(--line)",
        borderRadius: 18,
        padding: 22,
        position: "relative",
        overflow: "hidden",
        background:
          "linear-gradient(135deg, rgba(85,120,98,0.15), rgba(255,250,241,0.72) 42%, rgba(198,132,71,0.16))",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 18,
          border: "1px dashed rgba(85,120,98,0.18)",
          borderRadius: 18,
        }}
      />

      <div
        style={{
          position: "relative",
          zIndex: 2,
          display: "grid",
          gridTemplateColumns: "1fr 96px 1fr",
          alignItems: "center",
          gap: 18,
          minHeight: 224,
        }}
      >
        <div style={{ display: "grid", gap: 14 }}>
          <div className="soft-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: "50%",
                background: "linear-gradient(160deg, #f1c69d, #c68447)",
                position: "relative",
                boxShadow: "0 12px 24px rgba(55,67,55,0.12)",
              }}
            >
              <span style={{ position: "absolute", left: 12, top: 10, width: 25, height: 10, borderRadius: 999, background: "var(--sage-dark)" }} />
              <span style={{ position: "absolute", left: 15, top: 22, width: 4, height: 4, borderRadius: 999, background: "#2b241d" }} />
              <span style={{ position: "absolute", right: 15, top: 22, width: 4, height: 4, borderRadius: 999, background: "#2b241d" }} />
              <span style={{ position: "absolute", left: 18, top: 32, width: 13, height: 6, borderBottom: "2px solid #2b241d", borderRadius: "0 0 999px 999px" }} />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Creator</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>raw video</p>
            </div>
          </div>

          <div className="soft-card" style={{ padding: 14, display: "flex", alignItems: "center", gap: 12 }}>
            <div
              style={{
                width: 58,
                height: 40,
                borderRadius: 10,
                background: "linear-gradient(135deg, var(--sage-dark), var(--clay))",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 24,
                  top: 12,
                  width: 0,
                  height: 0,
                  borderTop: "8px solid transparent",
                  borderBottom: "8px solid transparent",
                  borderLeft: "12px solid var(--cream)",
                }}
              />
            </div>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 900 }}>Source</p>
              <p style={{ margin: "3px 0 0", fontSize: 12, fontWeight: 700, color: "var(--muted)" }}>YouTube / upload</p>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", justifyItems: "center", gap: 10 }}>
          <div style={{ width: 88, height: 88, borderRadius: "50%", border: "1px dashed rgba(85,120,98,0.42)", position: "relative" }}>
            <div
              style={{
                position: "absolute",
                inset: 18,
                borderRadius: "50%",
                display: "grid",
                placeItems: "center",
                color: "var(--cream)",
                background: "linear-gradient(135deg, var(--sage), var(--sage-dark))",
                fontSize: 20,
                fontWeight: 900,
                boxShadow: "0 14px 28px rgba(53,92,70,0.25)",
              }}
            >
              AI
            </div>
            <span style={{ position: "absolute", left: 5, top: 14, width: 12, height: 12, borderRadius: 999, background: "var(--clay)" }} />
            <span style={{ position: "absolute", right: 0, top: 42, width: 12, height: 12, borderRadius: 999, background: "var(--sage)" }} />
            <span style={{ position: "absolute", left: 39, bottom: -3, width: 12, height: 12, borderRadius: 999, background: "var(--clay)" }} />
          </div>
          <div style={{ display: "grid", gap: 5, width: "100%" }}>
            {["transcribe", "moments", "captions"].map((item) => (
              <span key={item} style={{ borderRadius: 999, padding: "5px 8px", background: "rgba(85,120,98,0.1)", color: "var(--sage-dark)", fontSize: 11, fontWeight: 900, textAlign: "center" }}>
                {item}
              </span>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gap: 10 }}>
          {["Reels", "TikTok", "Shorts", "WhatsApp"].map((item, index) => (
            <div
              key={item}
              className="soft-card"
              style={{
                minHeight: 42,
                padding: "0 13px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                transform: `translateX(${-index * 6}px)`,
                background: "rgba(255,250,241,0.86)",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 900 }}>{item}</span>
              <strong style={{ color: "var(--sage-dark)" }}>{clipCount}</strong>
            </div>
          ))}
        </div>
      </div>

      <div style={{ position: "absolute", left: 188, right: 188, top: "50%", height: 2, background: "linear-gradient(90deg, rgba(85,120,98,0.1), rgba(85,120,98,0.5), rgba(198,132,71,0.38))" }} />
    </div>
  );
}

function Sidebar() {
  const items = [
    "Home",
    "Create Content",
    "Content Studio",
    "Campaigns",
    "Content Library",
    "Scheduler",
    "Analytics",
    "Leads & CTA",
    "Brand Kit",
    "Integrations",
  ];

  return (
    <aside className="clipora-card sticky top-[86px] hidden h-[calc(100vh-106px)] w-[260px] shrink-0 p-4 lg:block">
      <div className="mb-5 rounded-[16px] bg-[rgba(85,120,98,0.1)] p-4">
        <p className="text-[12px] font-bold uppercase text-[var(--sage-dark)]">Workspace</p>
        <p className="mt-2 text-lg font-bold">Hendrik Studio</p>
        <p className="mt-1 text-[13px] text-[var(--muted)]">Clipora trial workspace</p>
      </div>
      <nav className="space-y-1">
        {items.map((item, index) => (
          <a
            key={item}
            href={index < 3 ? `#${item.toLowerCase().replaceAll(" ", "-")}` : "#roadmap"}
            className={`flex items-center justify-between rounded-[12px] px-3 py-3 text-[14px] font-bold transition ${
              index === 0
                ? "bg-[var(--sage)] text-[var(--cream)]"
                : "text-[var(--muted)] hover:bg-[rgba(85,120,98,0.08)] hover:text-[var(--sage-dark)]"
            }`}
          >
            <span>{item}</span>
            {index > 2 ? <span className="text-[11px] opacity-60">Soon</span> : null}
          </a>
        ))}
      </nav>
    </aside>
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
    <article className="clipora-card overflow-hidden">
      <video src={src} controls preload="metadata" className="aspect-video w-full bg-black object-contain" />
      <div className="p-5">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-[12px] font-bold uppercase text-[var(--muted)]">Clip {index + 1}</p>
            <h3 className="mt-1 text-lg font-bold leading-snug">{clip.caption.hook}</h3>
          </div>
          <div className="rounded-[12px] bg-[rgba(85,120,98,0.1)] px-3 py-2 text-right">
            <p className="text-[11px] font-bold text-[var(--muted)]">Score</p>
            <p className="font-bold text-[var(--sage-dark)]">{scorePct(clip.score.total)}%</p>
          </div>
        </div>

        <p className="text-[14px] leading-6 text-[var(--muted)]">{clip.caption.caption}</p>
        {cta ? (
          <p className="mt-3 rounded-[12px] bg-[rgba(198,132,71,0.11)] p-3 text-[13px] font-bold text-[#7b4b2d]">
            CTA: {cta}
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {clip.caption.hashtags.map((tag) => (
            <span key={tag} className="rounded-full bg-[rgba(85,120,98,0.1)] px-3 py-1 text-[12px] font-bold text-[var(--sage-dark)]">
              {tag}
            </span>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <a href={src} download={`clipora-${index + 1}.mp4`} className="primary-button min-h-10">
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
  const [maxClips, setMaxClips] = useState<3 | 5 | 10>(5);
  const [subtitleStyle, setSubtitleStyle] = useState<SubtitleStyle>("classic");
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
  const fileRef = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  useEffect(() => {
    fetch("/api/n8n")
      .then((response) => response.json())
      .then((data) => setN8nConnected(data?.n8n?.status === "connected"))
      .catch(() => setN8nConnected(false));
  }, []);

  useEffect(() => {
    fetch("/api/jobs/latest")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (!data?.success || !data.result) return;
        const latest = data.result as ProcessVideoResult;
        setResult(latest);
        setState("done");
        setProjectName(data.job?.cliporaContext?.projectName ?? "Latest Clipora Project");
        setWorkspaceName(data.job?.cliporaContext?.workspaceName ?? "Hendrik Studio");
        setCta(data.job?.cliporaContext?.cta ?? "Chat WhatsApp untuk order hari ini");
      })
      .catch(() => null);
  }, []);

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

  const callProcess = useCallback(async (body: Record<string, unknown>) => {
    const response = await fetch("/api/process-video", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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

  const handleResult = useCallback((data: ProcessResponse) => {
    stopTimer();
    setStep(STEPS.length);
    setResult(data);
    setN8nInfo(data.n8n ?? null);
    setState("done");
  }, []);

  const handleFile = useCallback(async (file: File) => {
    setState("uploading");
    setUploadPct(0);
    setError(null);
    setResult(null);
    setN8nInfo(null);
    setDriveResults([]);

    try {
      const formData = new FormData();
      formData.append("video", file);
      const localPath = await new Promise<string>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/api/upload");
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
      const data = await callProcess({ localPath });
      handleResult(data);
    } catch (err) {
      stopTimer();
      setError(err instanceof Error ? err.message : "Error tidak diketahui.");
      setState("error");
    }
  }, [callProcess, handleResult]);

  const handleUrl = useCallback(async () => {
    if (!url.trim()) return;
    setState("processing");
    setError(null);
    setResult(null);
    setN8nInfo(null);
    setDriveResults([]);
    startTimer();

    try {
      const data = await callProcess({ url: url.trim() });
      handleResult(data);
    } catch (err) {
      stopTimer();
      setError(err instanceof Error ? err.message : "Error tidak diketahui.");
      setState("error");
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
    stopTimer();
    setState("idle");
    setResult(null);
    setError(null);
    setStep(0);
    setN8nInfo(null);
    setDriveResults([]);
  };

  const isBusy = state === "uploading" || state === "processing";

  return (
    <div className="mx-auto flex max-w-[1480px] gap-6 px-5 py-6 lg:px-8">
      <Sidebar />

      <div className="min-w-0 flex-1 space-y-6">
        <section id="home" className="clipora-card overflow-hidden">
          <div className="grid gap-5 p-5 lg:grid-cols-[0.95fr_1.05fr] lg:p-6">
            <div className="flex flex-col justify-between gap-5">
              <div>
                <p className="text-[12px] font-bold uppercase text-[var(--sage-dark)]">Clipora trial workspace</p>
                <h1 className="mt-2 text-[clamp(1.7rem,3vw,2.6rem)] font-extrabold leading-tight text-[var(--ink)]">
                  Creator content workflow
                </h1>
                <p className="mt-3 max-w-xl text-[14px] leading-6 text-[var(--muted)]">
                  Masukkan video, pilih objective, lalu review clip siap distribusi.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-5">
                <MiniMetric label="Clips" value={result ? `${result.clips.length}` : "0"} />
                <MiniMetric label="Target" value={`${maxClips}`} />
                <MiniMetric label="Channel" value={`${channels.length}`} />
                <MiniMetric label="AI" value={result ? (result.summary.analysisSource ?? "fallback") : "Ready"} />
                <MiniMetric label="Mode" value={n8nConnected ? "n8n" : "Local"} />
              </div>
            </div>

            <CreatorWorkflowVisual channels={channels} result={result} />
          </div>
        </section>

        <section id="create-content" className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr_0.75fr]">
          <div className="clipora-card p-5">
            <p className="text-[12px] font-bold uppercase text-[var(--sage-dark)]">Source input</p>
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDrag(true);
              }}
              onDragLeave={() => setDrag(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDrag(false);
                const file = event.dataTransfer.files[0];
                if (file) void handleFile(file);
              }}
              onClick={() => fileRef.current?.click()}
              className={`mt-4 flex min-h-[190px] cursor-pointer flex-col items-center justify-center rounded-[16px] border border-dashed p-5 text-center transition ${
                drag ? "border-[var(--sage)] bg-[rgba(85,120,98,0.12)]" : "border-[var(--line)] bg-[rgba(255,250,241,0.52)]"
              }`}
            >
              <div className="clipora-mark mb-4 scale-110" />
              <p className="font-bold">{drag ? "Lepaskan video di sini" : "Upload video mentah"}</p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">MP4, MOV, MKV, AVI, WEBM. Maks 500MB.</p>
              <input
                ref={fileRef}
                type="file"
                accept="video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,.mp4,.mov,.avi,.mkv,.webm"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) void handleFile(file);
                }}
              />
            </div>

            <div className="my-4 flex items-center gap-3 text-[12px] font-bold text-[var(--muted)]">
              <span className="h-px flex-1 bg-[var(--line)]" />
              ATAU
              <span className="h-px flex-1 bg-[var(--line)]" />
            </div>

            <FieldLabel>YouTube URL</FieldLabel>
            <TextInput
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleUrl();
              }}
              placeholder="https://youtube.com/watch?v=..."
            />
            <button type="button" className="primary-button mt-4 w-full" disabled={!url.trim() || isBusy} onClick={() => void handleUrl()}>
              Analyze with AI
            </button>
          </div>

          <div className="clipora-card p-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <p className="text-[12px] font-bold uppercase text-[var(--sage-dark)]">Project information</p>
                <h2 className="mt-1 text-2xl font-extrabold">Create Content</h2>
              </div>
              {state === "done" ? <button className="ghost-button" onClick={reset}>New project</button> : null}
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Project name</FieldLabel>
                <TextInput value={projectName} onChange={(event) => setProjectName(event.target.value)} />
              </div>
              <div>
                <FieldLabel>Workspace</FieldLabel>
                <TextInput value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} />
              </div>
              <div>
                <FieldLabel>Objective</FieldLabel>
                <SelectInput value={objective} onChange={(event) => setObjective(event.target.value as Objective)}>
                  {OBJECTIVES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Tone</FieldLabel>
                <SelectInput value={tone} onChange={(event) => setTone(event.target.value as Tone)}>
                  {TONES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Format</FieldLabel>
                <SelectInput value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}>
                  <option value="9:16">Shorts vertical 9:16</option>
                  <option value="16:9">Landscape 16:9</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Clip count</FieldLabel>
                <SelectInput value={maxClips} onChange={(event) => setMaxClips(Number(event.target.value) as 3 | 5 | 10)}>
                  <option value={3}>3 clips</option>
                  <option value={5}>5 clips</option>
                  <option value={10}>10 clips</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Subtitle style</FieldLabel>
                <SelectInput value={subtitleStyle} onChange={(event) => setSubtitleStyle(event.target.value as SubtitleStyle)}>
                  <option value="classic">Classic</option>
                  <option value="bold">Bold</option>
                  <option value="minimal">Minimal</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>AI hook strategy</FieldLabel>
                <SelectInput value={hookType} onChange={(event) => setHookType(event.target.value as HookType)}>
                  <option value="viral">Viral</option>
                  <option value="pertanyaan">Pertanyaan</option>
                  <option value="cerita">Cerita</option>
                  <option value="tips">Tips</option>
                </SelectInput>
              </div>
              <div>
                <FieldLabel>Subtitle language</FieldLabel>
                <SelectInput value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
                  <option value="auto">Auto detect</option>
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                </SelectInput>
              </div>
            </div>

            <div className="mt-4">
              <FieldLabel>Target channels</FieldLabel>
              <div className="flex flex-wrap gap-2">
                {CHANNELS.map((channel) => (
                  <button
                    key={channel.value}
                    type="button"
                    onClick={() => toggleChannel(channel.value)}
                    className={`rounded-full px-4 py-2 text-[13px] font-bold transition ${
                      channels.includes(channel.value)
                        ? "bg-[var(--sage)] text-[var(--cream)]"
                        : "border border-[var(--line)] bg-[rgba(255,250,241,0.7)] text-[var(--muted)]"
                    }`}
                  >
                    {channel.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4">
              <FieldLabel>Main CTA</FieldLabel>
              <TextInput value={cta} onChange={(event) => setCta(event.target.value)} placeholder="Chat WhatsApp untuk order" />
            </div>

            {error ? (
              <div className="mt-4 rounded-[12px] border border-[rgba(159,63,53,0.24)] bg-[rgba(159,63,53,0.08)] p-3 text-[14px] font-bold text-[var(--danger)]">
                {error}
              </div>
            ) : null}
          </div>

          <div className="clipora-card p-5">
            <p className="text-[12px] font-bold uppercase text-[var(--sage-dark)]">Output summary</p>
            <div className="mt-4 space-y-2">
              <div className="soft-card p-4">
                <p className="text-[13px] font-bold">{selectedObjective.label}</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">{selectedObjective.detail}</p>
              </div>
              <div className="soft-card p-4">
                <p className="text-[13px] font-bold">Channels</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">
                  {channels.map(formatChannel).join(", ") || "Belum dipilih"}
                </p>
              </div>
              <div className="soft-card p-4">
                <p className="text-[13px] font-bold">Brand preset</p>
                <p className="mt-1 text-[12px] leading-5 text-[var(--muted)]">Warm Sage, {subtitleStyle}, {tone}.</p>
              </div>
            </div>

            {state === "uploading" ? (
              <div className="mt-5">
                <p className="mb-2 text-[13px] font-bold">Uploading {uploadPct}%</p>
                <div className="h-2 overflow-hidden rounded-full bg-[rgba(85,120,98,0.12)]">
                  <div className="h-full rounded-full bg-[var(--sage)]" style={{ width: `${uploadPct}%` }} />
                </div>
              </div>
            ) : null}

            {state === "processing" ? (
              <div className="mt-5 space-y-2">
                {STEPS.map((item, index) => (
                  <div key={item} className={`rounded-[12px] p-3 text-[13px] font-bold ${
                    index <= step ? "bg-[rgba(85,120,98,0.12)] text-[var(--sage-dark)]" : "bg-[rgba(255,250,241,0.55)] text-[var(--muted)]"
                  }`}>
                    {index + 1}. {item}
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </section>

        <section id="content-studio" className="clipora-card p-5 lg:p-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold uppercase text-[var(--sage-dark)]">Content Studio MVP</p>
              <h2 className="mt-1 text-2xl font-extrabold">Review outputs</h2>
            </div>
            {n8nInfo ? (
              <span className="rounded-full bg-[rgba(85,120,98,0.1)] px-4 py-2 text-[12px] font-bold text-[var(--sage-dark)]">
                {n8nInfo.notified ? "n8n post-processing active" : "Local output only"}
              </span>
            ) : null}
          </div>

          {result?.warnings.length ? (
            <div className="mb-5 rounded-[14px] border border-[rgba(198,132,71,0.26)] bg-[rgba(198,132,71,0.08)] p-4">
              <p className="text-[12px] font-bold uppercase text-[var(--clay)]">AI fallback notice</p>
              <div className="mt-2 space-y-1">
                {result.warnings.map((warning) => (
                  <p key={`${warning.step}-${warning.message}`} className="text-[13px] font-bold text-[var(--ink)]">
                    {warning.step}: {warning.message}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          {!result ? (
            <div className="soft-card p-8 text-center">
              <p className="text-lg font-bold">Belum ada project diproses.</p>
                <p className="mt-2 text-[14px] text-[var(--muted)]">Upload video atau paste URL untuk melihat hasil clip di sini.</p>
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr_0.8fr]">
              <div className="soft-card max-h-[760px] overflow-auto p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-bold uppercase text-[var(--muted)]">Transcript</p>
                  <span className="rounded-full bg-[rgba(85,120,98,0.1)] px-3 py-1 text-[11px] font-bold uppercase text-[var(--sage-dark)]">
                    {result.summary.transcriptSource}
                  </span>
                </div>
                <p className="mt-3 text-[14px] leading-7 text-[var(--ink)]">{result.transcript.text}</p>
              </div>

              <div className="space-y-4">
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

              <div className="soft-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-bold uppercase text-[var(--muted)]">Clip planning</p>
                  <span className="rounded-full bg-[rgba(198,132,71,0.12)] px-3 py-1 text-[11px] font-bold uppercase text-[var(--clay)]">
                    {result.summary.analysisSource ?? "fallback"}
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  {result.segments.map((segment) => (
                    <div key={`${segment.rank}-${segment.start}`} className="rounded-[12px] border border-[var(--line)] bg-[rgba(255,255,255,0.38)] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-[13px] font-bold">Rank {segment.rank}</p>
                        <span className="text-[12px] font-bold text-[var(--sage-dark)]">{scorePct(segment.score.total)}%</span>
                      </div>
                      <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{segment.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>

        <section id="roadmap" className="grid gap-4 md:grid-cols-4">
          {[
            ["Phase 1", "Core operasional", "Rebrand, Create Content, metadata Clipora, Content Studio MVP."],
            ["Phase 2", "Business layer", "Campaigns, CTA presets, brand kit dasar, content library."],
            ["Phase 3", "Distribution", "Scheduler, export packaging, Drive/WhatsApp workflow."],
            ["Phase 4", "Feedback", "Analytics snapshots, recommendations, team approval."],
          ].map(([phase, title, detail]) => (
            <div key={phase} className="soft-card p-4">
              <p className="text-[12px] font-bold text-[var(--sage-dark)]">{phase}</p>
              <p className="mt-2 font-extrabold">{title}</p>
              <p className="mt-2 text-[13px] leading-6 text-[var(--muted)]">{detail}</p>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
