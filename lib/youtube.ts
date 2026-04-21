import { exec } from "child_process";
import fs from "fs";
import path from "path";

export function downloadYoutubeVideo(url: string, outputBasePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const safeBase = path.resolve(outputBasePath);

    const possibleOldFiles = [
      safeBase,
      `${safeBase}.mp4`,
      `${safeBase}.webm`,
      `${safeBase}.mkv`,
    ];

    for (const file of possibleOldFiles) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file);
      }
    }

    const command = `C:\\yt-dlp\\yt-dlp.exe -4 -o "${safeBase}.%(ext)s" "${url}"`;

    console.log("YT-DLP COMMAND:", command);
    console.log("DOWNLOAD START:", url);

    exec(command, { maxBuffer: 1024 * 1024 * 50 }, (error, stdout, stderr) => {
      console.log("YT-DLP STDOUT:", stdout);
      console.log("YT-DLP STDERR:", stderr);

      if (error) {
        console.error("yt-dlp ERROR:", error);
        reject(new Error(stderr || stdout || error.message));
        return;
      }

      const candidates = [
        `${safeBase}.mp4`,
        `${safeBase}.webm`,
        `${safeBase}.mkv`,
      ];

      const downloadedFile = candidates.find((file) => fs.existsSync(file));

      if (!downloadedFile) {
        reject(new Error("Video selesai didownload, tapi file output tidak ditemukan"));
        return;
      }

      console.log("Video berhasil didownload:", downloadedFile);
      resolve(downloadedFile);
    });
  });
}