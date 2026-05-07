"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GenerationJob, GenerationJobStatus } from "@/lib/autoclip/generation/types";

type JobsResponse = {
  success: boolean;
  jobs: GenerationJob[];
  queue: { isProcessing: boolean; queueLength: number };
  total: number;
};

const STATUS_STYLES: Record<
  GenerationJobStatus,
  { label: string; bg: string; color: string }
> = {
  pending: { label: "Pending", bg: "var(--surface-alt)", color: "var(--text-muted)" },
  processing: { label: "Processing", bg: "var(--warn-bg)", color: "var(--warn)" },
  completed: { label: "Selesai", bg: "var(--accent-light)", color: "var(--accent)" },
  failed: { label: "Gagal", bg: "var(--error-bg)", color: "var(--error)" },
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
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        background: s.bg,
        color: s.color,
      }}
    >
      <span
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: s.color,
        }}
      />
      {s.label}
    </span>
  );
}

function JobCard({ job }: { job: GenerationJob }) {
  const elapsed = job.completedAt
    ? Math.round(
        (new Date(job.completedAt).getTime() - new Date(job.createdAt).getTime()) / 1000
      )
    : null;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: "16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--text)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {job.script?.title ?? job.topic}
          </p>
          <p
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              margin: "3px 0 0",
              fontFamily: "var(--font-mono, monospace)",
            }}
          >
            {job.id.slice(0, 8)}… · {job.style} · {job.language.toUpperCase()} · {job.durationSeconds}s
          </p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      {job.status === "processing" && job.pipelineStatus && (
        <div
          style={{
            fontSize: 12,
            color: "var(--warn)",
            background: "var(--warn-bg)",
            borderRadius: 6,
            padding: "6px 10px",
          }}
        >
          {PIPELINE_STEP_LABELS[job.pipelineStatus] ?? job.pipelineStatus}
        </div>
      )}

      {job.status === "failed" && job.error && (
        <div
          style={{
            fontSize: 12,
            color: "var(--error)",
            background: "var(--error-bg)",
            borderRadius: 6,
            padding: "6px 10px",
          }}
        >
          {job.error}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
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
              background: "var(--accent)",
              color: "#fff",
              borderRadius: 999,
              fontSize: 12,
              fontWeight: 700,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            Download
          </a>
        )}
      </div>
    </div>
  );
}

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
        setResult(`${data.total} job dibuat dan masuk antrian`);
        setTopics("");
        onBatchCreated();
      } else {
        setResult(`Error: ${data.error?.message}`);
      }
    } catch {
      setResult("Request gagal");
    } finally {
      setLoading(false);
    }
  };

  const topicCount = topics.split("\n").filter((t) => t.trim()).length;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 12,
        padding: 18,
        marginBottom: 24,
      }}
    >
      <p
        style={{
          margin: "0 0 12px",
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: "var(--accent)",
        }}
      >
        Batch Generate — 1 topik per baris (maks 20)
      </p>

      <textarea
        value={topics}
        onChange={(e) => setTopics(e.target.value)}
        placeholder={"5 fakta unik otak manusia\nSejarah singkat internet\nCara belajar lebih cepat"}
        disabled={loading}
        rows={4}
        style={{
          width: "100%",
          background: "var(--surface-alt)",
          border: "1px solid var(--border)",
          borderRadius: 8,
          padding: "10px 12px",
          color: "var(--text)",
          fontSize: 13,
          fontFamily: "var(--font-mono, monospace)",
          resize: "vertical",
          outline: "none",
          boxSizing: "border-box",
        }}
      />

      <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          disabled={loading}
          style={{
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 10px",
            color: "var(--text)",
            fontSize: 12,
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
            background: "var(--surface-alt)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "6px 10px",
            color: "var(--text)",
            fontSize: 12,
          }}
        >
          <option value="id">Indonesia</option>
          <option value="en">English</option>
        </select>

        <button
          onClick={handleSubmit}
          disabled={loading || !topics.trim()}
          style={{
            marginLeft: "auto",
            padding: "6px 18px",
            background: loading || !topics.trim() ? "var(--accent-light)" : "var(--accent)",
            color: loading || !topics.trim() ? "var(--accent)" : "#fff",
            border: "none",
            borderRadius: 8,
            fontSize: 12,
            fontWeight: 700,
            cursor: loading || !topics.trim() ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Membuat..." : `Buat ${topicCount || 0} Video`}
        </button>
      </div>

      {result && (
        <p
          style={{
            marginTop: 8,
            fontSize: 12,
            fontWeight: 600,
            color: result.startsWith("Error") || result.startsWith("Request") ? "var(--error)" : "var(--accent)",
          }}
        >
          {result}
        </p>
      )}
    </div>
  );
}

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
    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/generation-jobs");
      const json = (await res.json()) as JobsResponse;
      setData(json);

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
    <div style={{ padding: 24, maxWidth: 860, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
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
          Generation Jobs
        </p>
        <h1
          style={{
            margin: "6px 0 0",
            fontSize: 22,
            fontWeight: 800,
            color: "var(--text)",
          }}
        >
          Job Dashboard
        </h1>

        {data?.queue && (
          <div style={{ display: "flex", gap: 14, marginTop: 8, alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "var(--text-sec)" }}>
              Queue:{" "}
              <span
                style={{
                  fontWeight: 700,
                  color: data.queue.isProcessing ? "var(--warn)" : "var(--text-muted)",
                }}
              >
                {data.queue.isProcessing
                  ? `Processing (${data.queue.queueLength} waiting)`
                  : "Idle"}
              </span>
            </span>
            <button
              onClick={() => void fetchJobs()}
              style={{
                background: "none",
                border: "none",
                color: "var(--accent)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 700,
                padding: 0,
              }}
            >
              Refresh
            </button>
          </div>
        )}
      </div>

      <BatchPanel onBatchCreated={handleBatchCreated} />

      {/* Filter tabs */}
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {(["all", "pending", "processing", "completed", "failed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: "5px 12px",
              borderRadius: 999,
              border: `1px solid ${filter === f ? "var(--accent)" : "var(--border)"}`,
              background: filter === f ? "var(--accent-light)" : "transparent",
              color: filter === f ? "var(--accent)" : "var(--text-sec)",
              fontSize: 11,
              fontWeight: filter === f ? 700 : 500,
              cursor: "pointer",
            }}
          >
            {f === "all" ? "Semua" : f.charAt(0).toUpperCase() + f.slice(1)}{" "}
            <span style={{ opacity: 0.6 }}>({counts[f]})</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: "var(--text-muted)", fontSize: 14 }}>Memuat jobs...</p>
      ) : filteredJobs.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "48px 20px",
            border: "1.5px dashed var(--border-med)",
            borderRadius: 12,
          }}
        >
          <p style={{ color: "var(--text-muted)", fontSize: 14, margin: 0 }}>
            {filter === "all"
              ? "Belum ada job. Buat video pertama kamu!"
              : `Tidak ada job dengan status "${filter}"`}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} />
          ))}
        </div>
      )}
    </div>
  );
}
