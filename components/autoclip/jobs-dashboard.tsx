"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GenerationJob, GenerationJobStatus } from "@/lib/autoclip/generation/types";

type JobsResponse = {
  success: boolean;
  jobs: GenerationJob[];
  queue: { isProcessing: boolean; queueLength: number };
  total: number;
};

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  GenerationJobStatus,
  { label: string; bg: string; color: string; dot: string }
> = {
  pending: {
    label: "Pending",
    bg: "rgba(255,255,255,0.06)",
    color: "rgba(255,255,255,0.4)",
    dot: "rgba(255,255,255,0.2)",
  },
  processing: {
    label: "Processing",
    bg: "rgba(251,191,36,0.1)",
    color: "#FBBf24",
    dot: "#FBBf24",
  },
  completed: {
    label: "Selesai",
    bg: "rgba(0,255,148,0.08)",
    color: "#00FF94",
    dot: "#00FF94",
  },
  failed: {
    label: "Gagal",
    bg: "rgba(239,68,68,0.08)",
    color: "#EF4444",
    dot: "#EF4444",
  },
};

const PIPELINE_STEP_LABELS: Record<string, string> = {
  generating_script: "Menulis script...",
  generating_voice: "Generate suara...",
  fetching_stock_video: "Cari stock video...",
  assembling_video: "Merender video...",
  completed: "Selesai",
  failed: "Gagal",
};

function StatusBadge({ status }: { status: GenerationJobStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        padding: "3px 10px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        background: s.bg,
        color: s.color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: s.dot,
          animation: status === "processing" ? "pulse 1.2s infinite" : undefined,
        }}
      />
      {s.label}
    </span>
  );
}

// ─── Single Job Card ──────────────────────────────────────────────────────────

function JobCard({ job }: { job: GenerationJob }) {
  const elapsed = job.completedAt
    ? Math.round(
        (new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()) / 1000
      )
    : null;

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: `1px solid ${job.status === "completed" ? "rgba(0,255,148,0.15)" : job.status === "failed" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.07)"}`,
        borderRadius: "14px",
        padding: "18px 20px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "#fff",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {job.script?.title ?? job.topic}
          </p>
          <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", margin: "3px 0 0", fontFamily: "monospace" }}>
            {job.id.slice(0, 8)}… · {job.style} · {job.language.toUpperCase()} · {job.durationSeconds}s
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {/* Processing step */}
      {job.status === "processing" && job.pipelineStatus && (
        <div
          style={{
            fontSize: "12px",
            color: "#FBBf24",
            background: "rgba(251,191,36,0.06)",
            borderRadius: "6px",
            padding: "6px 10px",
          }}
        >
          ⚙ {PIPELINE_STEP_LABELS[job.pipelineStatus] ?? job.pipelineStatus}
        </div>
      )}

      {/* Error */}
      {job.status === "failed" && job.error && (
        <div
          style={{
            fontSize: "12px",
            color: "#EF4444",
            background: "rgba(239,68,68,0.06)",
            borderRadius: "6px",
            padding: "6px 10px",
          }}
        >
          ✕ {job.error}
        </div>
      )}

      {/* Footer row */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
        <span style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)" }}>
          {new Date(job.createdAt).toLocaleString("id-ID", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
          {elapsed !== null && ` · ${elapsed}s`}
        </span>

        {job.status === "completed" && job.videoUrl && (
          <a
            href={job.videoUrl}
            download
            style={{
              padding: "5px 14px",
              background: "#00FF94",
              color: "#0a0a0f",
              borderRadius: "999px",
              fontSize: "12px",
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            ⬇ Download
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Batch Create Panel ───────────────────────────────────────────────────────

function BatchPanel({ onBatchCreated }: { onBatchCreated: () => void }) {
  const [topics, setTopics] = useState("");
  const [style, setStyle] = useState("informative");
  const [language, setLanguage] = useState("id");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSubmit = async () => {
    const topicList = topics
      .split("\n")
      .map((t) => t.trim())
      .filter(Boolean);

    if (topicList.length === 0) return;

    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("/api/generation-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topics: topicList, style, language }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(`✅ ${data.total} job dibuat dan masuk antrian`);
        setTopics("");
        onBatchCreated();
      } else {
        setResult(`✕ ${data.error?.message}`);
      }
    } catch {
      setResult("✕ Request gagal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.07)",
        borderRadius: "16px",
        padding: "20px",
        marginBottom: "28px",
      }}
    >
      <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "14px" }}>
        Batch Generate — 1 topik per baris (max 20)
      </p>

      <textarea
        value={topics}
        onChange={(e) => setTopics(e.target.value)}
        placeholder={"5 fakta unik otak manusia\nSejarah singkat internet\nCara belajar lebih cepat"}
        disabled={loading}
        rows={5}
        style={{
          width: "100%",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "10px",
          padding: "12px",
          color: "#fff",
          fontSize: "13px",
          fontFamily: "monospace",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: "8px", marginTop: "10px", flexWrap: "wrap" }}>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          disabled={loading}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            padding: "6px 10px",
            color: "#fff",
            fontSize: "12px",
          }}
        >
          <option value="informative">Informatif</option>
          <option value="motivational">Motivasi</option>
          <option value="educational">Edukasi</option>
          <option value="story">Cerita</option>
        </select>

        <select
          value={language}
          onChange={(e) => setLanguage(e.target.value)}
          disabled={loading}
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "8px",
            padding: "6px 10px",
            color: "#fff",
            fontSize: "12px",
          }}
        >
          <option value="id">🇮🇩 Indonesia</option>
          <option value="en">🇺🇸 English</option>
        </select>

        <button
          onClick={handleSubmit}
          disabled={loading || !topics.trim()}
          style={{
            marginLeft: "auto",
            padding: "6px 20px",
            background: loading || !topics.trim() ? "rgba(0,255,148,0.2)" : "#00FF94",
            color: loading || !topics.trim() ? "rgba(0,255,148,0.4)" : "#0a0a0f",
            border: "none",
            borderRadius: "8px",
            fontSize: "12px",
            fontWeight: 700,
            cursor: loading || !topics.trim() ? "not-allowed" : "pointer",
            fontFamily: "monospace",
          }}
        >
          {loading ? "Membuat..." : `⚡ Buat ${topics.split("\n").filter((t) => t.trim()).length || 0} Video`}
        </button>
      </div>

      {result && (
        <p
          style={{
            marginTop: "10px",
            fontSize: "13px",
            color: result.startsWith("✅") ? "#00FF94" : "#EF4444",
          }}
        >
          {result}
        </p>
      )}
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function JobsDashboard() {
  const [data, setData] = useState<JobsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<GenerationJobStatus | "all">("all");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/generation-jobs");
      const json = (await res.json()) as JobsResponse;
      setData(json);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchJobs();
    // Poll every 3 seconds while there are active jobs
    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/generation-jobs");
      const json = (await res.json()) as JobsResponse;
      setData(json);

      // Stop polling if nothing is pending/processing
      const hasActive = json.jobs.some(
        (j) => j.status === "pending" || j.status === "processing"
      );
      if (!hasActive && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }, 3000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchJobs]);

  // Re-start polling when new jobs are created
  const handleBatchCreated = () => {
    void fetchJobs();
    if (!pollRef.current) {
      pollRef.current = setInterval(() => void fetchJobs(), 3000);
    }
  };

  const filteredJobs =
    !data?.jobs
      ? []
      : filter === "all"
        ? data.jobs
        : data.jobs.filter((j) => j.status === filter);

  const counts = {
    all: data?.jobs.length ?? 0,
    pending: data?.jobs.filter((j) => j.status === "pending").length ?? 0,
    processing: data?.jobs.filter((j) => j.status === "processing").length ?? 0,
    completed: data?.jobs.filter((j) => j.status === "completed").length ?? 0,
    failed: data?.jobs.filter((j) => j.status === "failed").length ?? 0,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "monospace",
        padding: "28px 20px",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "6px" }}>
          Generation Jobs
        </p>
        <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, fontFamily: "Georgia, serif" }}>
          Job <span style={{ color: "#00FF94" }}>Dashboard</span>
        </h1>

        {data?.queue && (
          <div style={{ display: "flex", gap: "16px", marginTop: "10px" }}>
            <span style={{ fontSize: "12px", color: "rgba(255,255,255,0.3)" }}>
              Queue:{" "}
              <span style={{ color: data.queue.isProcessing ? "#FBBf24" : "rgba(255,255,255,0.5)" }}>
                {data.queue.isProcessing ? `Processing (${data.queue.queueLength} waiting)` : "Idle"}
              </span>
            </span>
            <button
              onClick={() => void fetchJobs()}
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.3)",
                cursor: "pointer",
                fontSize: "12px",
                fontFamily: "monospace",
                padding: 0,
              }}
            >
              ↻ Refresh
            </button>
          </div>
        )}
      </div>

      {/* Batch panel */}
      <BatchPanel onBatchCreated={handleBatchCreated} />

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "18px", flexWrap: "wrap" }}>
        {(["all", "pending", "processing", "completed", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 12px",
              borderRadius: "999px",
              border: `1px solid ${filter === f ? "rgba(0,255,148,0.4)" : "rgba(255,255,255,0.08)"}`,
              background: filter === f ? "rgba(0,255,148,0.08)" : "transparent",
              color: filter === f ? "#00FF94" : "rgba(255,255,255,0.35)",
              fontSize: "11px",
              fontWeight: filter === f ? 700 : 400,
              cursor: "pointer",
              fontFamily: "monospace",
            }}
          >
            {f === "all" ? "Semua" : f.charAt(0).toUpperCase() + f.slice(1)}{" "}
            <span style={{ opacity: 0.6 }}>({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Job list */}
      {loading ? (
        <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "14px" }}>Memuat jobs...</p>
      ) : filteredJobs.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "60px 20px",
            border: "1px dashed rgba(255,255,255,0.06)",
            borderRadius: "16px",
          }}
        >
          <p style={{ color: "rgba(255,255,255,0.2)", fontSize: "14px" }}>
            {filter === "all" ? "Belum ada job. Buat video pertama kamu!" : `Tidak ada job dengan status "${filter}"`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
