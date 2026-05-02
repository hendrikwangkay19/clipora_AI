import fs from "fs/promises";
import path from "path";
import { appConfig } from "@/lib/autoclip/config";

export async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function writeJsonFile(filePath: string, data: unknown) {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), "utf8");
}

export async function readJsonFile<T>(filePath: string): Promise<T> {
  const content = await fs.readFile(filePath, "utf8");
  return JSON.parse(content) as T;
}

export function getJobDir(jobId: string) {
  return path.join(appConfig.jobsDir, jobId);
}

export function getArtifactsDir(jobId: string) {
  return path.join(getJobDir(jobId), "artifacts");
}

export function toPublicRelativePath(filePath: string) {
  const relativePath = path
    .relative(appConfig.dataDir, filePath)
    .replaceAll("\\", "/");
  return `.autoclip/${relativePath}`;
}
