"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CreateJobResponse,
  GenerationJob,
  GenerateVideoErrorResponse,
} from "@/lib/autoclip/generation/types";

const VOICE_OPTIONS = [
  { value: "nova", label: "Nova — Warm female (recommended)" },
  { value: "alloy", label: "Alloy — Neutral" },
  { value: "echo", label: "Echo — Male" },
  { value: "fable", label: "Fable — Expressive" },
  { value: "onyx", label: "Onyx — Deep male" },
  { value: "shimmer", label: "Shimmer — Soft female" },
];

const PIPELINE_STEP_LABELS: Record<string, string> = {
  generating_script: "Menulis script...",
  generating_voice: "Generate suara...",
  fetching_stock_video: "Cari stock video...",
  assembling_video: "Merender video...",
  completed: "Selesai!",
  failed: "Gagal",
};

const PIPELINE_STEPS = [
  "generating_script",
  "generating_voice",
  "fetching_stock_video",
  "assembling_video",
];

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        marginBottom: 6,
        fontSize: 11,
        fontWeight: 700,
        textTransform: "uppercase" as const,
        letterSpacing: "0.06em",
        color: "var(--accent)",
      }}
    >
      {children}
    </label>
  );
}

export function GenerateUi() {
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("informative");
  const [language, setLanguage] = useState("id");
  const [duration, setDuration] = useState(60);
  const [voice, setVoice] = useState("nova");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [trackedJob, setTrackedJob] = useState<GenerationJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!trackedJobId) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/generation-jobs/${trackedJobId}`);
        const data = await res.json() as { success: boolean; job: GenerationJob };
        if (data.success) {
          setTrackedJob(data.job);
          if (data.job.status === "completed" || data.job.status === "failed") {
            if (pollRef.current) clearInterval(pollRef.current);
            pollRef.current = null;
          }
        }
      } catch {
        // silent
      }
    };

    void poll();
    pollRef.current = setInterval(poll, 2500);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [trackedJobId]);

  const handleGenerate = async () => {
    const trimmed = topic.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setError(null);
    setTrackedJobId(null);
    setTrackedJob(null);

    try {
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: trimmed,
          style,
          language,
          durationSeconds: duration,
          voice,
        }),
      });

      const data = (await res.json()) as CreateJobResponse | GenerateVideoErrorResponse;

      if (!data.success) {
        setError((data as GenerateVideoErrorResponse).error.message);
        return;
      }

      const jobRes = data as CreateJobResponse;
      setTrackedJobId(jobRes.jobId);
    } catch {
      setError("Request gagal. Cek apakah dev server berjalan.");
    } finally {
      setSubmitting(false);
    }
  };

  const isRunning =
    trackedJob?.status === "pending" || trackedJob?.status === "processing";

  const activeStepIndex = trackedJob?.pipelineStatus
    ? PIPELINE_STEPS.indexOf(trackedJob.pipelineStatus)
    : -1;

  const selectStyle = {
    width: "100%",
    background: "var(--surface-alt)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: "8px 12px",
    color: "var(--text)",
    fontSize: 13,
    outline: "none",
  };

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
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
          AI Video Generator
        </p>
        <h1 style={{ margin: "6px 0 0", fontSize: 22, fontWeight: 800, color: "var(--text)" }}>
          Topik → Video Pendek
        </h1>
        <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--text-sec)" }}>
          Ketik topik → AI buat script → suara → video → download
        </p>
      </div>

      {/* Form — hide when tracking a job */}
      {!trackedJobId && (
        <div className="clipora-card" style={{ padding: 20, marginBottom: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <FieldLabel>Topik Video</FieldLabel>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !submitting && void handleGenerate()}
                placeholder="Contoh: 5 fakta unik tentang otak manusia"
                disabled={submitting}
                style={{
                  width: "100%",
                  background: "var(--surface-alt)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "10px 14px",
                  color: "var(--text)",
                  fontSize: 14,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div>
                <FieldLabel>Gaya</FieldLabel>
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                  disabled={submitting}
                  style={selectStyle}
                >
                  <option value="informative">Informatif</option>
                  <option value="motivational">Motivasi</option>
                  <option value="educational">Edukasi</option>
                  <option value="story">Cerita</option>
                </select>
              </div>
              <div>
                <FieldLabel>Bahasa</FieldLabel>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value)}
                  disabled={submitting}
                  style={selectStyle}
                >
                  <option value="id">Indonesia</option>
                  <option value="en">English</option>
                </select>
              </div>
              <div>
                <FieldLabel>Durasi</FieldLabel>
                <select
                  value={String(duration)}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  disabled={submitting}
                  style={selectStyle}
                >
                  <option value="30">~30 detik</option>
                  <option value="60">~60 detik</option>
                </select>
              </div>
              <div>
                <FieldLabel>Suara</FieldLabel>
                <select
                  value={voice}
                  onChange={(e) => setVoice(e.target.value)}
                  disabled={submitting}
                  style={selectStyle}
                >
                  {VOICE_OPTIONS.map((v) => (
                    <option key={v.value} value={v.value}>
                      {v.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => void handleGenerate()}
              disabled={submitting || !topic.trim()}
              className="primary-button"
              style={{ width: "100%", minHeight: 44, fontSize: 14 }}
            >
              {submitting ? "Membuat job..." : "Generate Video"}
            </button>

            {error && (
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--error-bg)",
                  border: "1px solid rgba(208,90,74,0.2)",
                  borderRadius: 8,
                }}
              >
                <p style={{ margin: 0, fontSize: 13, color: "var(--error)" }}>{error}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Job tracking */}
      {trackedJobId && trackedJob && (
        <div
          className="clipora-card"
          style={{
            padding: 20,
            marginBottom: 20,
            borderColor:
              trackedJob.status === "completed"
                ? "rgba(74,122,101,0.3)"
                : trackedJob.status === "failed"
                  ? "rgba(208,90,74,0.3)"
                  : "var(--border)",
          }}
        >
          {/* Status header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <div>
              <p
                style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", margin: 0 }}
              >
                {trackedJob.script?.title ?? trackedJob.topic}
              </p>
              <p
                style={{
                  fontSize: 11,
                  color: "var(--text-muted)",
                  margin: "3px 0 0",
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                Job {trackedJob.id.slice(0, 8)}…
              </p>
            </div>
            <span
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                fontSize: 11,
                fontWeight: 700,
                background:
                  trackedJob.status === "completed"
                    ? "var(--accent-light)"
                    : trackedJob.status === "failed"
                      ? "var(--error-bg)"
                      : "var(--warn-bg)",
                color:
                  trackedJob.status === "completed"
                    ? "var(--accent)"
                    : trackedJob.status === "failed"
                      ? "var(--error)"
                      : "var(--warn)",
              }}
            >
              {trackedJob.status}
            </span>
          </div>

          {/* Pipeline progress */}
          {isRunning && (
            <div style={{ marginBottom: 16 }}>
              {PIPELINE_STEPS.map((step, i) => {
                const isDone = i < activeStepIndex;
                const isActive = i === activeStepIndex;
                return (
                  <div
                    key={step}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "5px 0",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: isDone
                          ? "var(--accent)"
                          : isActive
                            ? "var(--accent-light)"
                            : "var(--surface-alt)",
                        border: isActive ? "1.5px solid var(--accent)" : "1px solid var(--border)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: isDone ? "#fff" : "var(--accent)",
                        flexShrink: 0,
                      }}
                    >
                      {isDone ? "✓" : isActive ? "·" : ""}
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        color: isDone
                          ? "var(--text-sec)"
                          : isActive
                            ? "var(--text)"
                            : "var(--text-muted)",
                        fontWeight: isActive ? 700 : 400,
                      }}
                    >
                      {PIPELINE_STEP_LABELS[step]}
                    </span>
                  </div>
                );
              })}
              <p style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 8 }}>
                Proses 30–90 detik. Jangan tutup tab.
              </p>
            </div>
          )}

          {/* Completed */}
          {trackedJob.status === "completed" && trackedJob.videoUrl && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <video
                src={trackedJob.videoUrl}
                controls
                style={{
                  width: "100%",
                  borderRadius: 10,
                  background: "#000",
                  maxHeight: 320,
                }}
              />
              <a
                href={trackedJob.videoUrl}
                download
                className="primary-button"
                style={{ textAlign: "center", minHeight: 42, fontSize: 13 }}
              >
                Download MP4
              </a>
            </div>
          )}

          {/* Failed */}
          {trackedJob.status === "failed" && (
            <div
              style={{
                padding: "8px 12px",
                background: "var(--error-bg)",
                borderRadius: 8,
              }}
            >
              <p style={{ fontSize: 13, color: "var(--error)", margin: 0 }}>
                {trackedJob.error}
              </p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button
              onClick={() => {
                setTrackedJobId(null);
                setTrackedJob(null);
                setTopic("");
              }}
              className="ghost-button"
              style={{ flex: 1 }}
            >
              + Video Baru
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="ghost-button"
              style={{ flex: 1, borderColor: "var(--accent)", color: "var(--accent)" }}
            >
              Lihat Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
