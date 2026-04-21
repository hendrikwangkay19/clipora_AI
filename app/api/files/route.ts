/**
 * Menyajikan file video/audio dari .autoclip/jobs/ dengan dukungan range request.
 * Range request diperlukan agar elemen <video> HTML5 bisa seek.
 *
 * Fix: Readable.toWeb() tidak menangani client disconnect (video seeking).
 * Solusi: buat ReadableStream manual dengan try/catch di setiap push,
 * dan panggil nodeStream.destroy() saat client membatalkan request.
 */
import fs from "fs";
import path from "path";
import { stat } from "fs/promises";

export const runtime = "nodejs";

const JOBS_ROOT = path.join(process.cwd(), ".autoclip", "jobs");

function mimeType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".mp4")  return "video/mp4";
  if (ext === ".mp3")  return "audio/mpeg";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mov")  return "video/quicktime";
  return "application/octet-stream";
}

/** Bungkus Node.js ReadableStream ke Web ReadableStream dengan error handling aman */
function nodeToWebStream(nodeStream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk: Buffer | string) => {
        try {
          controller.enqueue(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        } catch {
          // Controller sudah ditutup (client disconnect / seek baru) — batalkan stream
          nodeStream.destroy();
        }
      });
      nodeStream.on("end", () => {
        try { controller.close(); } catch { /* sudah ditutup */ }
      });
      nodeStream.on("error", (err) => {
        try { controller.error(err); } catch { /* sudah ditutup */ }
      });
    },
    cancel() {
      // Client membatalkan request (seek ke posisi lain) — tutup stream Node.js
      nodeStream.destroy();
    },
  });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const relPath = searchParams.get("path") ?? "";

  // Keamanan: reject path traversal patterns dan null bytes
  if (relPath.includes("..") || relPath.includes("\0") || /[<>"|?*]/.test(relPath)) {
    return new Response("Forbidden", { status: 403 });
  }

  // Keamanan: pastikan path tetap di dalam JOBS_ROOT
  const resolved = path.resolve(JOBS_ROOT, relPath.replace(/^\.autoclip\/jobs\//, ""));
  if (!resolved.startsWith(JOBS_ROOT)) {
    return new Response("Forbidden", { status: 403 });
  }

  let fileStat;
  try {
    fileStat = await stat(resolved);
  } catch {
    return new Response("Not found", { status: 404 });
  }

  const fileSize    = fileStat.size;
  const rangeHeader = req.headers.get("range");

  if (rangeHeader) {
    const [startStr, endStr] = rangeHeader.replace("bytes=", "").split("-");
    const start     = parseInt(startStr, 10);
    const end       = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;

    const nodeStream = fs.createReadStream(resolved, { start, end });

    return new Response(nodeToWebStream(nodeStream), {
      status: 206,
      headers: {
        "Content-Range":  `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges":  "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type":   mimeType(resolved),
        "Cache-Control":  "no-store",
      },
    });
  }

  const nodeStream = fs.createReadStream(resolved);

  return new Response(nodeToWebStream(nodeStream), {
    headers: {
      "Content-Type":        mimeType(resolved),
      "Content-Length":      String(fileSize),
      "Accept-Ranges":       "bytes",
      // Cache clip yang sudah selesai selama 1 jam (private = hanya browser, bukan CDN)
      "Cache-Control":       "private, max-age=3600, immutable",
      "Content-Disposition": `inline; filename="${path.basename(resolved)}"`,
      // ETag sederhana berdasarkan ukuran file + mtime
      "ETag":                `"${fileSize}-${fileStat.mtimeMs.toString(36)}"`,
    },
  });
}
