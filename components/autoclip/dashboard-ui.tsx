"use client";

import { FormEvent } from "react";
import { JOB_STATUS_LABELS } from "@/lib/autoclip/jobs/status";
import { GeneratedClip, ProcessVideoResult, ScoredSegment } from "@/lib/autoclip/types";

type DashboardUiProps = {
  url: string;
  loading: boolean;
  error: string | null;
  result: ProcessVideoResult | null;
  activeStepIndex: number;
  copyMessage: string | null;
  onUrlChange: (value: string) => void;
  onProcess: () => void;
  onCopy: (value: string, label: string) => void;
};

type PanelProps = {
  id?: string;
  title: string;
  eyebrow?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
};

type StepState = "idle" | "done" | "active";

const navigationItems = [
  { label: "Overview", href: "#overview", icon: GridIcon },
  { label: "Pipeline", href: "#pipeline", icon: PipelineIcon },
  { label: "Segments", href: "#segments", icon: SparkIcon },
  { label: "Clips", href: "#clips", icon: FilmIcon },
];

const pipelineSteps = [
  {
    title: "Input URL YouTube",
    description: "Sistem menerima link YouTube sebagai sumber video utama.",
  },
  {
    title: "Download video",
    description: "Video diunduh ke workspace lokal untuk diproses lebih lanjut.",
  },
  {
    title: "Transcribe audio",
    description: "Audio diekstrak lalu ditranskrip menjadi teks yang siap dianalisis AI.",
  },
  {
    title: "AI analyzer",
    description: "Transcript dikirim ke AI untuk memilih momen penting dan memberi score.",
  },
  {
    title: "Generate clips",
    description: "Sistem mengambil top segments, memotong video dengan ffmpeg, lalu AI membuat hook dan caption untuk dashboard.",
  },
];

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function formatSeconds(value: number) {
  const totalSeconds = Math.max(0, Math.floor(value));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function formatRange(start: number, end: number) {
  return `${formatSeconds(start)} - ${formatSeconds(end)}`;
}

function getStepState(
  index: number,
  loading: boolean,
  result: ProcessVideoResult | null,
  activeStepIndex: number
): StepState {
  if (result) {
    return "done";
  }

  if (!loading) {
    return "idle";
  }

  if (index < activeStepIndex) {
    return "done";
  }

  if (index === activeStepIndex) {
    return "active";
  }

  return "idle";
}

function buildStats(result: ProcessVideoResult | null, loading: boolean) {
  if (!result) {
    return [
      {
        label: "Clip target",
        value: "3-5",
        detail: "Automatic short-form cuts per long-form source.",
      },
      {
        label: "System mode",
        value: loading ? "Running" : "Ready",
        detail: "Local-first pipeline with resilient fallbacks.",
      },
      {
        label: "Processing goal",
        value: "Minutes",
        detail: "Phase 1 keeps the flow simple and locally runnable.",
      },
      {
        label: "Tech base",
        value: "App Router",
        detail: "Next.js UI with API routes and modular services.",
      },
    ];
  }

  return [
    {
      label: "Generated clips",
      value: `${result.clips.length}`,
      detail: "Clips rendered and packaged with metadata.",
    },
    {
      label: "Top score",
      value: `${result.summary.topScore ?? "n/a"}`,
      detail: "Highest ranked segment from the scoring engine.",
    },
    {
      label: "Transcript mode",
      value: result.summary.transcriptSource,
      detail: "Shows whether OpenAI or fallback transcript was used.",
    },
    {
      label: "Job status",
      value: JOB_STATUS_LABELS[result.job.status],
      detail: "Persisted locally for future worker-based processing.",
    },
  ];
}

function handleHeroSubmit(event: FormEvent<HTMLFormElement>, onProcess: () => void) {
  event.preventDefault();
  onProcess();
}

function Panel({ id, title, eyebrow, description, children, className }: PanelProps) {
  return (
    <section id={id} className={cn("glass-panel premium-panel rounded-[32px] p-6 md:p-7", className)}>
      <div className="mb-6 flex flex-col gap-2">
        {eyebrow ? (
          <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-[var(--accent-2)]">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-[1.35rem] font-semibold tracking-[-0.03em] text-white md:text-[1.7rem]">
          {title}
        </h2>
        {description ? (
          <p className="max-w-3xl text-sm leading-7 text-[var(--muted)]">{description}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function Sidebar() {
  return (
    <aside className="relative border-b border-white/8 px-4 py-5 lg:min-h-screen lg:border-b-0 lg:border-r lg:px-5 lg:py-8">
      <div className="sticky top-6 space-y-6">
        <div className="glass-panel premium-panel rounded-[30px] p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/8 text-white shadow-[0_0_50px_rgba(138,180,255,0.14)]">
              <FilmIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.32em] text-[var(--muted)]">
                AutoClip AI
              </p>
              <p className="mt-1 text-lg font-semibold tracking-[-0.02em] text-white">Agent OS</p>
            </div>
          </div>
          <div className="mt-5 rounded-[24px] border border-white/8 bg-black/20 p-4">
            <p className="text-sm leading-7 text-[var(--text-secondary)]">
              A cinematic control room for turning long-form video into polished short-form assets.
            </p>
          </div>
        </div>

        <nav className="glass-panel premium-panel rounded-[30px] p-3">
          <div className="mb-2 px-3 pt-2 text-[11px] font-medium uppercase tracking-[0.34em] text-[var(--muted)]">
            Workspace
          </div>
          <div className="space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <a
                  key={item.label}
                  href={item.href}
                  className="group flex items-center gap-3 rounded-[20px] px-3 py-3 text-sm text-[var(--text-secondary)] transition duration-200 hover:bg-white/7 hover:text-white"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-white/6 text-[var(--accent-2)] transition duration-200 group-hover:border-white/18 group-hover:bg-white/10 group-hover:shadow-[0_0_26px_rgba(138,180,255,0.15)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="font-medium">{item.label}</span>
                </a>
              );
            })}
          </div>
        </nav>

        <div className="glass-panel premium-panel rounded-[30px] p-5">
          <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-[var(--muted)]">
            Platform character
          </p>
          <div className="mt-4 space-y-3">
            <SystemPill label="Luxury dark gradients" />
            <SystemPill label="Refined glass surfaces" />
            <SystemPill label="AI-first processing flow" />
            <SystemPill label="Desktop editorial focus" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function SystemPill({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] border border-white/8 bg-white/4 px-3 py-3 text-sm text-[var(--text-secondary)]">
      <span className="h-2.5 w-2.5 rounded-full bg-[var(--accent-2)] shadow-[0_0_18px_rgba(138,180,255,0.8)]" />
      <span>{label}</span>
    </div>
  );
}

function Header({ result, loading, copyMessage }: Pick<DashboardUiProps, "result" | "loading" | "copyMessage">) {
  const statusLabel = result
    ? JOB_STATUS_LABELS[result.job.status]
    : loading
      ? "Pipeline running"
      : "Standing by";

  return (
    <header className="border-b border-white/8 px-4 py-5 sm:px-6 lg:px-8 lg:py-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-[var(--accent-2)]">
            Cinematic workspace
          </p>
          <div className="space-y-3">
            <h1 className="text-[clamp(2.2rem,4vw,3.7rem)] font-semibold leading-none tracking-[-0.05em] text-white">
              AutoClip AI Operating System
            </h1>
            <p className="max-w-3xl text-sm leading-7 text-[var(--muted)] md:text-base">
              A premium interface for ingesting long-form content, surfacing viral moments, and packaging high-quality short-form assets with calm, production-minded clarity.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <HeaderBadge label={statusLabel} tone={loading ? "active" : result ? "done" : "idle"} />
          <HeaderBadge
            label={result ? `Warnings ${result.warnings.length}` : "Dark premium UI"}
            tone={result && result.warnings.length > 0 ? "warn" : "idle"}
          />
          {copyMessage ? <HeaderBadge label={copyMessage} tone="active" /> : null}
        </div>
      </div>
    </header>
  );
}

function HeaderBadge({
  label,
  tone,
}: {
  label: string;
  tone: "idle" | "active" | "done" | "warn";
}) {
  const toneClasses = {
    idle: "border-white/10 bg-white/5 text-[var(--text-secondary)]",
    active: "border-[var(--accent-2)]/25 bg-[var(--accent-2)]/10 text-white",
    done: "border-emerald-400/20 bg-emerald-400/10 text-emerald-100",
    warn: "border-amber-300/18 bg-amber-300/10 text-amber-100",
  };

  const dotClasses = {
    idle: "bg-white/35",
    active: "bg-[var(--accent-2)] shadow-[0_0_16px_rgba(138,180,255,0.9)]",
    done: "bg-emerald-300 shadow-[0_0_16px_rgba(16,185,129,0.8)]",
    warn: "bg-amber-300 shadow-[0_0_16px_rgba(252,211,77,0.75)]",
  };

  return (
    <div className={cn("inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium", toneClasses[tone])}>
      <span className={cn("h-2 w-2 rounded-full", dotClasses[tone])} />
      <span>{label}</span>
    </div>
  );
}

function HeroSection({
  url,
  loading,
  error,
  result,
  onUrlChange,
  onProcess,
}: Pick<
  DashboardUiProps,
  "url" | "loading" | "error" | "result" | "onUrlChange" | "onProcess"
>) {
  return (
    <Panel
      id="overview"
      eyebrow="Source intake"
      title="Transform long-form footage into premium short-form moments"
      description="Paste a YouTube URL and let the current MVP run the full local pipeline: download, transcribe, analyze, score, and clip."
      className="overflow-hidden"
    >
      <div className="hero-grid relative rounded-[30px] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.07),rgba(255,255,255,0.02))] p-5 md:p-6 xl:p-7">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(138,180,255,0.45),transparent)]" />

        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/6 px-3 py-2 text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--text-secondary)]">
            <SparkIcon className="h-3.5 w-3.5 text-[var(--accent-2)]" />
            Premium AI video workflow
          </div>
          <div className="space-y-5">
            <h3 className="max-w-4xl text-[clamp(2.8rem,6vw,5.2rem)] font-semibold leading-[0.92] tracking-[-0.065em] text-white">
              Turn one YouTube URL into ranked short-form clips inside a cinematic AI workflow.
            </h3>
            <p className="max-w-2xl text-base leading-8 text-[var(--text-secondary)] md:text-lg">
              AutoClip AI follows a simple production flow: download video, transcribe audio, send transcript to the AI analyzer, score the best moments, cut top segments with ffmpeg, generate hooks and captions, then present the results in the dashboard.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <HeroSignal
              title="Signal quality"
              value={result ? "Captured" : "Ready"}
              detail="Transcript and moment scoring are prepared for AI analysis."
            />
            <HeroSignal
              title="Pipeline mode"
              value={loading ? "Running" : "Synchronous"}
              detail="URL to clips flow runs locally with resilient fallbacks."
            />
            <HeroSignal
              title="Clip target"
              value={result ? `${result.clips.length}` : "3-5"}
              detail="Top scored segments become dashboard-ready clip outputs."
            />
          </div>
        </div>

        <div className="grid gap-4 xl:grid-rows-[auto_1fr]">
          <form
            onSubmit={(event) => handleHeroSubmit(event, onProcess)}
            className="glass-panel premium-panel rounded-[30px] p-5 md:p-6"
          >
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[var(--muted)]">
                  Source intake
                </p>
                <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                  Submit a YouTube URL
                </p>
              </div>
              <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--text-secondary)]">
                Phase 1 MVP
              </div>
            </div>
            <div className="space-y-4">
              <textarea
                value={url}
                onChange={(event) => onUrlChange(event.target.value)}
                placeholder="https://www.youtube.com/watch?v=..."
                className="min-h-[138px] w-full rounded-[24px] border border-white/10 bg-black/28 px-4 py-4 text-sm text-white outline-none transition duration-200 placeholder:text-white/35 focus:border-[var(--accent-2)]/55 focus:bg-black/36"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-3 rounded-[20px] bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] px-5 py-4 text-sm font-semibold text-white shadow-[0_18px_55px_rgba(79,70,229,0.26)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_70px_rgba(79,70,229,0.33)] disabled:cursor-not-allowed disabled:opacity-65"
              >
                <span className="relative inline-flex h-4 w-4 items-center justify-center">
                  <span
                    aria-hidden={!loading}
                    className={cn(
                      "absolute inset-0 inline-flex items-center justify-center transition-opacity duration-150",
                      loading ? "opacity-100" : "opacity-0"
                    )}
                  >
                    <SpinnerIcon className="h-4 w-4 animate-spin" />
                  </span>
                  <span
                    aria-hidden={loading}
                    className={cn(
                      "absolute inset-0 inline-flex items-center justify-center transition-opacity duration-150",
                      loading ? "opacity-0" : "opacity-100"
                    )}
                  >
                    <PlayIcon className="h-4 w-4" />
                  </span>
                </span>
                <span>{loading ? "Processing source video" : "Launch clip generation"}</span>
              </button>
            <p className="text-xs leading-6 text-[var(--text-secondary)]">
              {result
                ? `${result.clips.length} clips generated in the current workspace.`
                : "Submit a YouTube URL to start download, transcript analysis, scoring, clipping, and caption generation."}
            </p>
              {error ? (
                <div className="rounded-[22px] border border-red-400/18 bg-red-400/10 px-4 py-3 text-sm text-red-100">
                  {error}
                </div>
              ) : null}
            </div>
          </form>

          <div className="grid gap-4 md:grid-cols-[1.05fr_0.95fr] xl:grid-cols-1 2xl:grid-cols-[1.05fr_0.95fr]">
            <EnginePreview result={result} loading={loading} />
            <CommandNote />
          </div>
        </div>
      </div>
    </Panel>
  );
}

function HeroSignal({
  title,
  value,
  detail,
}: {
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="glass-panel rounded-[24px] px-4 py-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[var(--muted)]">{title}</p>
      <p className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

function EnginePreview({
  result,
  loading,
}: Pick<DashboardUiProps, "result" | "loading">) {
  return (
    <div className="glass-panel premium-panel rounded-[30px] p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[var(--muted)]">
            Engine state
          </p>
          <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
            Decision chamber
          </p>
        </div>
        <HeaderBadge
          label={loading ? "Active" : result ? "Completed" : "Idle"}
          tone={loading ? "active" : result ? "done" : "idle"}
        />
      </div>

      <div className="mt-5 rounded-[26px] border border-white/8 bg-[radial-gradient(circle_at_top,rgba(138,180,255,0.16),transparent_52%),rgba(3,7,10,0.82)] p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">
              {result ? "Top segments loaded" : "Waiting for source ingestion"}
            </p>
            <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">
              {result
                ? `Current leading score: ${result.summary.topScore ?? "n/a"}`
                : "After the transcript is analyzed, this area will surface scored moments and clip-ready metadata."}
            </p>
          </div>
          <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/10 bg-white/5 text-lg font-semibold text-white shadow-[inset_0_0_40px_rgba(138,180,255,0.1)]">
            {result ? result.clips.length : loading ? "..." : "OS"}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <PreviewMetric label="Transcript" value={result ? result.summary.transcriptSource : "pending"} />
          <PreviewMetric label="Warnings" value={result ? `${result.warnings.length}` : "0"} />
          <PreviewMetric label="Segments" value={result ? `${result.segments.length}` : "0"} />
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/22 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function CommandNote() {
  return (
    <div className="glass-panel premium-panel rounded-[30px] p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[var(--muted)]">
        Editorial intent
      </p>
      <div className="mt-4 space-y-4">
        <FeatureLine
          title="Luxury dark treatment"
          detail="Subtle glow, layered gradients, and elegant contrast tuned for a high-end workspace."
        />
        <FeatureLine
          title="Clear decision hierarchy"
          detail="Stronger typography and spacing help the operator understand what matters first."
        />
        <FeatureLine
          title="Production-safe interactions"
          detail="All UI changes preserve the existing process-video flow and current response handling."
        />
      </div>
    </div>
  );
}

function FeatureLine({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-white/4 px-4 py-4">
      <p className="text-sm font-semibold text-white">{title}</p>
      <p className="mt-2 text-sm leading-7 text-[var(--text-secondary)]">{detail}</p>
    </div>
  );
}

function StatsGrid({ result, loading }: Pick<DashboardUiProps, "result" | "loading">) {
  const stats = buildStats(result, loading);

  return (
    <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
      {stats.map((stat) => (
        <article key={stat.label} className="glass-panel premium-panel hover-luxury rounded-[28px] p-5 md:p-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.34em] text-[var(--muted)]">
            {stat.label}
          </p>
          <p className="mt-4 text-[2rem] font-semibold tracking-[-0.05em] text-white">{stat.value}</p>
          <p className="mt-3 text-sm leading-7 text-[var(--text-secondary)]">{stat.detail}</p>
        </article>
      ))}
    </section>
  );
}

function PipelineSection({
  loading,
  result,
  activeStepIndex,
}: Pick<DashboardUiProps, "loading" | "result" | "activeStepIndex">) {
  return (
    <Panel
      id="pipeline"
      eyebrow="Pipeline"
      title="A refined view of the clip-generation sequence"
      description="This panel reflects the full system flow: URL YouTube, download, transcript, AI analysis, scoring, top segment selection, ffmpeg cutting, caption generation, and dashboard output."
    >
      <div className="space-y-4">
        {pipelineSteps.map((step, index) => {
          const state = getStepState(index, loading, result, activeStepIndex);

          return (
            <div
              key={step.title}
              className={cn(
                "relative overflow-hidden rounded-[26px] border px-4 py-4 transition duration-200 md:px-5 md:py-5",
                state === "done" && "border-emerald-400/16 bg-emerald-400/7",
                state === "active" && "border-[var(--accent-2)]/28 bg-[linear-gradient(135deg,rgba(138,180,255,0.16),rgba(255,255,255,0.03))] shadow-[0_0_36px_rgba(138,180,255,0.08)]",
                state === "idle" && "border-white/8 bg-white/4"
              )}
            >
              <div className="flex items-start gap-4">
                <div
                  className={cn(
                    "mt-0.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border text-sm font-semibold",
                    state === "done" && "border-emerald-400/24 bg-emerald-400/10 text-emerald-100",
                    state === "active" && "border-[var(--accent-2)]/32 bg-[var(--accent-2)]/14 text-white",
                    state === "idle" && "border-white/10 bg-white/5 text-[var(--muted)]"
                  )}
                >
                  {state === "done" ? "OK" : `${index + 1}`}
                </div>
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-base font-semibold tracking-[-0.02em] text-white">{step.title}</p>
                    <HeaderBadge
                      label={state === "done" ? "Done" : state === "active" ? "Live" : "Queued"}
                      tone={state === "done" ? "done" : state === "active" ? "active" : "idle"}
                    />
                  </div>
                  <p className="text-sm leading-7 text-[var(--text-secondary)]">{step.description}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function SummarySection({ result }: Pick<DashboardUiProps, "result">) {
  return (
    <Panel
      eyebrow="Summary"
      title="Transcript intelligence"
      description="A concise synthesis of the active transcript and how it feeds the AI analyzer, scoring layer, and clip selection process."
      className="h-full"
    >
      {result ? (
        <div className="space-y-5">
          <div className="rounded-[24px] border border-white/8 bg-white/4 p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
              Transcript summary
            </p>
            <p className="mt-4 text-sm leading-8 text-[var(--text-primary)]">
              {result.transcript.summary}
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <MetricBlock label="Transcript source" value={result.summary.transcriptSource} />
            <MetricBlock label="Selected clips" value={`${result.clips.length}`} />
          </div>
          <div className="rounded-[24px] border border-white/8 bg-black/18 p-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.32em] text-[var(--muted)]">
              Next step metadata
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {result.nextSteps.recommendedPlatforms.map((platform) => (
                <span
                  key={platform}
                  className="rounded-full border border-white/8 bg-white/4 px-3 py-1 text-xs text-[var(--text-secondary)]"
                >
                  {platform}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <EmptyState
          title="Transcript intelligence will appear here"
          description="Run a source through the system to see transcript summary, operational context, and publishing metadata."
        />
      )}
    </Panel>
  );
}

function MetricBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[22px] border border-white/8 bg-black/20 p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--muted)]">{label}</p>
      <p className="mt-3 text-lg font-semibold text-white">{value}</p>
    </div>
  );
}

function SegmentsSection({
  result,
  onCopy,
}: Pick<DashboardUiProps, "result" | "onCopy">) {
  return (
    <Panel
      id="segments"
      eyebrow="Top viral segments"
              title="Ranked moments with stronger editorial priority"
      description="AI-selected moments are ranked here after transcript analysis so the best segments can be turned into clips."
    >
      {result ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {result.segments.map((segment) => (
            <SegmentCard key={`${segment.rank}-${segment.start}`} segment={segment} onCopy={onCopy} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Your top segments will appear here"
          description="As soon as the source is processed, the highest-potential moments will be elevated with ranking, timestamps, and score signals."
        />
      )}
    </Panel>
  );
}

function SegmentCard({
  segment,
  onCopy,
}: {
  segment: ScoredSegment;
  onCopy: DashboardUiProps["onCopy"];
}) {
  return (
    <article className="glass-panel hover-luxury rounded-[28px] p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-full border border-[var(--accent-2)]/25 bg-[var(--accent-2)]/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.2em] text-[var(--accent-2)]">
            Rank {segment.rank}
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[var(--text-secondary)]">
            {formatRange(segment.start, segment.end)}
          </div>
        </div>
        <div className="rounded-[18px] border border-white/10 bg-black/18 px-4 py-3 text-right">
          <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted)]">
            Total score
          </p>
          <p className="mt-2 text-2xl font-semibold tracking-[-0.05em] text-white">
            {segment.score.total}
          </p>
        </div>
      </div>

      <p className="mt-5 text-[1.1rem] font-semibold leading-8 tracking-[-0.02em] text-white">
        {segment.text}
      </p>
      <p className="mt-4 text-sm leading-7 text-[var(--text-secondary)]">{segment.reason}</p>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <ScorePill label="Emotion" value={segment.score.emotion} />
        <ScorePill label="Keyword" value={segment.score.keyword} />
        <ScorePill label="Curiosity" value={segment.score.curiosity} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {segment.keywords.map((keyword) => (
          <span
            key={keyword}
            className="rounded-full border border-white/8 bg-black/20 px-3 py-1 text-xs text-[var(--text-secondary)]"
          >
            {keyword}
          </span>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ActionButton onClick={() => onCopy(segment.text, "Segment text")}>Copy segment</ActionButton>
        <ActionButton onClick={() => onCopy(segment.reason, "Segment reason")} subtle>
          Copy reason
        </ActionButton>
      </div>
    </article>
  );
}

function ScorePill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-[20px] border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-base font-semibold text-white">{value}</p>
    </div>
  );
}

function ClipsSection({
  result,
  onCopy,
}: Pick<DashboardUiProps, "result" | "onCopy">) {
  return (
    <Panel
      id="clips"
      eyebrow="Generated clips"
      title="A premium presentation layer for finished outputs"
      description="These are the final outputs after top segments are cut with ffmpeg and enriched with AI-generated hooks and captions."
    >
      {result ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {result.clips.map((clip) => (
            <ClipCard key={clip.id} clip={clip} onCopy={onCopy} />
          ))}
        </div>
      ) : (
        <EmptyState
          title="Generated clip previews will appear here"
          description="When processing completes, each output card will show timing, score, hook, caption, and quick copy actions."
        />
      )}
    </Panel>
  );
}

function ClipCard({
  clip,
  onCopy,
}: {
  clip: GeneratedClip;
  onCopy: DashboardUiProps["onCopy"];
}) {
  return (
    <article className="glass-panel hover-luxury overflow-hidden rounded-[30px] p-5">
      <div className="clip-stage rounded-[26px] border border-white/10 p-4 md:p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
              Clip preview
            </p>
            <h3 className="mt-2 text-[1.25rem] font-semibold tracking-[-0.03em] text-white">
              {clip.caption.hook}
            </h3>
          </div>
          <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-[var(--text-secondary)]">
            {formatRange(clip.start, clip.end)}
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <ClipMeta label="Score" value={`${clip.score.total}`} />
          <ClipMeta label="Duration" value={`${clip.duration}s`} />
          <ClipMeta label="Output" value={clip.relativePath.split("/").pop() || "clip.mp4"} />
        </div>
      </div>

      <div className="mt-5 space-y-4">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
            Caption
          </p>
          <p className="mt-3 text-sm leading-7 text-[var(--text-primary)]">{clip.caption.caption}</p>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.28em] text-[var(--muted)]">
            Hashtags
          </p>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">{clip.caption.hashtags.join(" ")}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <ActionButton onClick={() => onCopy(clip.caption.hook, "Hook")}>Copy hook</ActionButton>
        <ActionButton onClick={() => onCopy(clip.caption.caption, "Caption")} subtle>
          Copy caption
        </ActionButton>
        <ActionButton onClick={() => onCopy(clip.relativePath, "Output path")} subtle>
          Copy path
        </ActionButton>
      </div>
    </article>
  );
}

function ClipMeta({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-white/8 bg-black/20 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-[0.24em] text-[var(--muted)]">{label}</p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  subtle = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  subtle?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-4 py-2 text-sm font-medium transition duration-200",
        subtle
          ? "border border-white/10 bg-white/5 text-[var(--text-secondary)] hover:border-white/20 hover:bg-white/8 hover:text-white"
          : "bg-[linear-gradient(135deg,var(--accent),var(--accent-2))] text-white shadow-[0_14px_32px_rgba(79,70,229,0.24)] hover:-translate-y-0.5 hover:shadow-[0_20px_44px_rgba(79,70,229,0.32)]"
      )}
    >
      {children}
    </button>
  );
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-[26px] border border-dashed border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] px-6 py-12 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[var(--accent-2)] shadow-[0_0_35px_rgba(138,180,255,0.12)]">
        <SparkIcon className="h-5 w-5" />
      </div>
      <p className="mt-5 text-xl font-semibold tracking-[-0.03em] text-white">{title}</p>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}

export function DashboardUi(props: DashboardUiProps) {
  return (
    <div className="cinematic-shell relative min-h-screen overflow-hidden bg-[var(--background)] text-[var(--text-primary)]">
      <div className="cinematic-aura pointer-events-none absolute inset-0" />
      <div className="relative z-10 lg:grid lg:min-h-screen lg:grid-cols-[292px_minmax(0,1fr)]">
        <Sidebar />
        <div className="min-w-0">
          <Header result={props.result} loading={props.loading} copyMessage={props.copyMessage} />
          <main className="space-y-6 px-4 py-6 sm:px-6 lg:px-8 lg:py-8 xl:px-10">
            <HeroSection
              url={props.url}
              loading={props.loading}
              error={props.error}
              result={props.result}
              onUrlChange={props.onUrlChange}
              onProcess={props.onProcess}
            />

            <StatsGrid result={props.result} loading={props.loading} />

            <div className="grid gap-6 2xl:grid-cols-[1.08fr_0.92fr]">
              <PipelineSection
                loading={props.loading}
                result={props.result}
                activeStepIndex={props.activeStepIndex}
              />
              <SummarySection result={props.result} />
            </div>

            <div className="grid gap-6 2xl:grid-cols-[1.02fr_0.98fr]">
              <SegmentsSection result={props.result} onCopy={props.onCopy} />
              <ClipsSection result={props.result} onCopy={props.onCopy} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function GridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" />
    </svg>
  );
}

function PipelineIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M4 6h7M13 6l2.5 2.5L13 11M20 18h-7M11 18l-2.5-2.5L11 13M6 6v12m12-6V6" />
    </svg>
  );
}

function SparkIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3z" />
    </svg>
  );
}

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4" />
    </svg>
  );
}

function PlayIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M8 6.5v11l9-5.5-9-5.5z" />
    </svg>
  );
}

function SpinnerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className}>
      <path
        d="M12 4a8 8 0 1 1-8 8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}
