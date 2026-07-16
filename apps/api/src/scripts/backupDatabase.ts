import { spawn } from "child_process";
import { mkdir, readdir, stat, unlink } from "fs/promises";
import path from "path";
import { env } from "../config/env";

function positiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function removeExpiredBackups(directory: string, retentionDays: number) {
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1_000;
  const files = await readdir(directory);

  await Promise.all(files
    .filter((file) => /^al-arab-.*\.archive\.gz$/.test(file))
    .map(async (file) => {
      const filePath = path.join(directory, file);
      const metadata = await stat(filePath);
      if (metadata.mtimeMs < cutoff) await unlink(filePath);
    }));
}

function runMongoDump(outputPath: string) {
  const executable = process.platform === "win32" ? "mongodump.exe" : "mongodump";
  return new Promise<void>((resolve, reject) => {
    const child = spawn(executable, [
      `--uri=${env.mongoUri}`,
      `--archive=${outputPath}`,
      "--gzip"
    ], { stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`mongodump exited with code ${code ?? "unknown"}`)));
  });
}

async function main() {
  if (!env.mongoUri) throw new Error("MONGODB_URI is required for backups");

  const directory = path.resolve(process.env.BACKUP_DIR ?? "backups");
  const retentionDays = positiveNumber(process.env.BACKUP_RETENTION_DAYS, 14);
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputPath = path.join(directory, `al-arab-${timestamp}.archive.gz`);

  await mkdir(directory, { recursive: true });
  await runMongoDump(outputPath);
  await removeExpiredBackups(directory, retentionDays);
  console.log(`MongoDB backup completed: ${outputPath}`);
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown backup error";
  console.error(`MongoDB backup failed: ${message}`);
  process.exitCode = 1;
});
