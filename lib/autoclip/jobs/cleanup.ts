/**
 * Auto-cleanup: Hapus job artifacts yang lebih tua dari batas waktu.
 * Dapat dipanggil via API endpoint atau scheduled task.
 */
import fs from "fs/promises";
import path from "path";
import { appConfig } from "@/lib/autoclip/config";

/** Default: hapus job lebih tua dari 7 hari */
const MAX_AGE_MS = parseInt(process.env.JOB_MAX_AGE_DAYS ?? "7", 10) * 24 * 60 * 60 * 1000;

export type CleanupResult = {
  scanned: number;
  deleted: number;
  freedBytes: number;
  errors: string[];
};

/**
 * Hitung ukuran direktori secara rekursif.
 */
async function dirSize(dirPath: string): Promise<number> {
  let total = 0;
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        total += await dirSize(full);
      } else {
        const stat = await fs.stat(full).catch(() => null);
        if (stat) total += stat.size;
      }
    }
  } catch {
    // ignore
  }
  return total;
}

/**
 * Hapus job folder yang lebih tua dari MAX_AGE_MS.
 */
export async function cleanupOldJobs(): Promise<CleanupResult> {
  const result: CleanupResult = { scanned: 0, deleted: 0, freedBytes: 0, errors: [] };
  const now = Date.now();

  let entries;
  try {
    entries = await fs.readdir(appConfig.jobsDir, { withFileTypes: true });
  } catch {
    return result; // jobsDir tidak ada
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    result.scanned++;

    const jobDir = path.join(appConfig.jobsDir, entry.name);
    const jobFile = path.join(jobDir, "job.json");

    try {
      const stat = await fs.stat(jobFile).catch(() => null);
      if (!stat) continue;

      const ageMs = now - stat.mtimeMs;
      if (ageMs < MAX_AGE_MS) continue;

      // Hitung ukuran sebelum hapus
      const size = await dirSize(jobDir);

      await fs.rm(jobDir, { recursive: true, force: true });
      result.deleted++;
      result.freedBytes += size;

      console.log(
        `[cleanup] Deleted job ${entry.name} (age: ${Math.round(ageMs / 86400000)}d, size: ${(size / 1024 / 1024).toFixed(1)}MB)`
      );
    } catch (err) {
      result.errors.push(`${entry.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (result.deleted > 0) {
    console.log(
      `[cleanup] Done: ${result.deleted}/${result.scanned} jobs removed, freed ${(result.freedBytes / 1024 / 1024).toFixed(1)}MB`
    );
  }

  return result;
}
