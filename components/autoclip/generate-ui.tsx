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

export function GenerateUi() {
  const router = useRouter();

  const [topic, setTopic] = useState("");
  const [style, setStyle] = useState("informative");
  const [language, setLanguage] = useState("id");
  const [duration, setDuration] = useState(60);
  const [voice, setVoice] = useState("nova");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // After job creation — we track the job via polling
  const [trackedJobId, setTrackedJobId] = useState<string | null>(null);
  const [trackedJob, setTrackedJob] = useState<GenerationJob | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll job status after creation
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

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: "monospace",
        padding: "28px 20px",
        maxWidth: "720px",
        margin: "0 auto",
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: "28px" }}>
        <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.25)", textTransform: "uppercase", letterSpacing: "0.2em", marginBottom: "6px" }}>
          AI Video Generator
        </p>
        <h1 style={{ fontSize: "22px", fontWeight: 800, margin: 0, fontFamily: "Georgia, serif" }}>
          Topik <span style={{ color: "#00FF94" }}>→ Video Pendek</span>
        </h1>
        <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "13px", marginTop: "6px" }}>
          Ketik topik → AI buat script → suara → video → download
        </p>
      </div>

      {/* Form — hide when tracking a job */}
      {!trackedJobId && (
        <div style={{ display: "flex", flexDirection: "column", gap: "14px", marginBottom: "20px" }}>
          <div>
            <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "8px" }}>
              Topik Video
            </label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !submitting && handleGenerate()}
              placeholder="Contoh: 5 fakta unik tentang otak manusia"
              disabled={submitting}
              style={{
                width: "100%",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: "12px",
                padding: "12px 16px",
                color: "#fff",
                fontSize: "14px",
                fontFamily: "monospace",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            {[
              {
                label: "Gaya",
                value: style,
                onChange: setStyle,
                options: [
                  { value: "informative", label: "Informatif" },
                  { value: "motivational", label: "Motivasi" },
                  { value: "educational", label: "Edukasi" },
                  { value: "story", label: "Cerita" },
                ],
              },
              {
                label: "Bahasa",
                value: language,
                onChange: setLanguage,
                options: [
                  { value: "id", label: "Indonesia 🇮🇩" },
                  { value: "en", label: "English 🇺🇸" },
                ],
              },
              {
                label: "Durasi",
                value: String(duration),
                onChange: (v: string) => setDuration(Number(v)),
                options: [
                  { value: "30", label: "~30 detik" },
                  { value: "60", label: "~60 detik" },
                ],
              },
              {
                label: "Suara",
                value: voice,
                onChange: setVoice,
                options: VOICE_OPTIONS.map((v) => ({ value: v.value, label: v.label })),
              },
            ].map(({ label, value, onChange, options }) => (
              <div key={label}>
                <label style={{ fontSize: "11px", color: "rgba(255,255,255,0.35)", textTransform: "uppercase", letterSpacing: "0.1em", display: "block", marginBottom: "6px" }}>
                  {label}
                </label>
                <select
                  value={value}
                  onChange={(e) => onChange(e.target.value)}
                  disabled={submitting}
                  style={{
                    width: "100%",
                    background: "rgba(255,255,255,0.05)",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: "10px",
                    padding: "9px 12px",
                    color: "#fff",
                    fontSize: "13px",
                    fontFamily: "monospace",
                    outline: "none",
                  }}
                >
                  {options.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <button
            onClick={handleGenerate}
            disabled={submitting || !topic.trim()}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "12px",
              border: "none",
              fontWeight: 700,
              fontSize: "14px",
              fontFamily: "monospace",
              letterSpacing: "0.05em",
              cursor: submitting || !topic.trim() ? "not-allowed" : "pointer",
              background: submitting || !topic.trim() ? "rgba(0,255,148,0.15)" : "#00FF94",
              color: submitting || !topic.trim() ? "rgba(0,255,148,0.35)" : "#0a0a0f",
              transition: "all 0.15s",
            }}
          >
            {submitting ? "Membuat job..." : "⚡ Generate Video"}
          </button>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "10px", padding: "12px 14px" }}>
              <p style={{ fontSize: "13px", color: "#EF4444", margin: 0 }}>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* Job tracking panel */}
      {trackedJobId && trackedJob && (
        <div style={{ border: `1px solid ${trackedJob.status === "completed" ? "rgba(0,255,148,0.25)" : trackedJob.status === "failed" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)"}`, borderRadius: "16px", padding: "22px", marginBottom: "20px" }}>
          {/* Status header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div>
              <p style={{ fontSize: "13px", fontWeight: 600, color: "#fff", margin: 0 }}>
                {trackedJob.script?.title ?? trackedJob.topic}
              </p>
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.3)", margin: "3px 0 0" }}>
                Job {trackedJob.id.slice(0, 8)}…
              </p>
            </div>
            <span style={{
              padding: "4px 12px",
              borderRadius: "999px",
              fontSize: "11px",
              fontWeight: 700,
              background: trackedJob.status === "completed" ? "rgba(0,255,148,0.1)" : trackedJob.status === "failed" ? "rgba(239,68,68,0.1)" : "rgba(251,191,36,0.1)",
              color: trackedJob.status === "completed" ? "#00FF94" : trackedJob.status === "failed" ? "#EF4444" : "#FBBf24",
            }}>
              {trackedJob.status}
            </span>
          </div>

          {/* Pipeline progress */}
          {isRunning && (
            <div style={{ marginBottom: "16px" }}>
              {PIPELINE_STEPS.map((step, i) => {
                const isDone = i < activeStepIndex;
                const isActive = i === activeStepIndex;
                return (
                  <div key={step} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px 0" }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%",
                      background: isDone ? "#00FF94" : isActive ? "rgba(0,255,148,0.15)" : "rgba(255,255,255,0.04)",
                      border: isActive ? "1.5px solid #00FF94" : "none",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", color: isDone ? "#0a0a0f" : "#00FF94",
                      flexShrink: 0,
                    }}>
                      {isDone ? "✓" : isActive ? "·" : ""}
                    </div>
                    <span style={{ fontSize: "13px", color: isDone ? "rgba(255,255,255,0.6)" : isActive ? "#fff" : "rgba(255,255,255,0.2)" }}>
                      {PIPELINE_STEP_LABELS[step]}
                    </span>
                  </div>
                );
              })}
              <p style={{ fontSize: "11px", color: "rgba(255,255,255,0.2)", marginTop: "10px" }}>
                Proses 30–90 detik. Jangan tutup tab.
              </p>
            </div>
          )}

          {/* Completed */}
          {trackedJob.status === "completed" && trackedJob.videoUrl && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <video src={trackedJob.videoUrl} controls style={{ width: "100%", borderRadius: "10px", background: "#000", maxHeight: "320px" }} />
              <a
                href={trackedJob.videoUrl}
                download
                style={{ display: "block", textAlign: "center", padding: "11px", background: "#00FF94", color: "#0a0a0f", borderRadius: "10px", fontWeight: 700, fontSize: "13px", textDecoration: "none" }}
              >
                ⬇ Download MP4
              </a>
            </div>
          )}

          {/* Failed */}
          {trackedJob.status === "failed" && (
            <div style={{ background: "rgba(239,68,68,0.06)", borderRadius: "8px", padding: "10px 12px" }}>
              <p style={{ fontSize: "13px", color: "#EF4444", margin: 0 }}>{trackedJob.error}</p>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button
              onClick={() => { setTrackedJobId(null); setTrackedJob(null); setTopic(""); }}
              style={{ flex: 1, padding: "9px", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: "10px", color: "rgba(255,255,255,0.6)", fontSize: "13px", cursor: "pointer", fontFamily: "monospace" }}
            >
              + Video Baru
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              style={{ flex: 1, padding: "9px", background: "rgba(0,255,148,0.06)", border: "1px solid rgba(0,255,148,0.15)", borderRadius: "10px", color: "#00FF94", fontSize: "13px", cursor: "pointer", fontFamily: "monospace" }}
            >
              📋 Lihat Dashboard
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
