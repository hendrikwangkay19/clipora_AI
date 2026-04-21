import { execFile } from "child_process";

type CommandResult = {
  stdout: string;
  stderr: string;
};

export async function runCommand(
  command: string,
  args: string[],
  options?: {
    cwd?: string;
    maxBuffer?: number;
  }
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        cwd: options?.cwd,
        maxBuffer: options?.maxBuffer ?? 1024 * 1024 * 32,
        windowsHide: true,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(
            new Error(
              [error.message, stderr, stdout].filter(Boolean).join("\n").trim()
            )
          );
          return;
        }

        resolve({ stdout, stderr });
      }
    );
  });
}
