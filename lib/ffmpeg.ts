
import { exec } from "child_process";

export function extractAudio(input: string, output: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -i "${input}" -vn -acodec libmp3lame -q:a 2 "${output}" -y`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("FFmpeg Extract Audio Error:", stderr);
        reject(error);
      } else {
        console.log("Audio berhasil dibuat:", output);
        resolve();
      }
    });
  });
}

export function clipVideo(
  input: string,
  output: string,
  start: number,
  duration: number
): Promise<void> {
  return new Promise((resolve, reject) => {
    const command = `ffmpeg -ss ${start} -i "${input}" -t ${duration} -map 0:v:0 -map 0:a:0 -c:v libx264 -preset veryfast -crf 23 -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart "${output}" -y`;

    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error("FFmpeg Error:", stderr);
        reject(error);
      } else {
        console.log("Clip berhasil:", output);
        resolve();
      }
    });
  });
}