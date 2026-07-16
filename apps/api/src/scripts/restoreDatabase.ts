import { spawn } from "child_process";
import { access } from "fs/promises";
import path from "path";
import { env } from "../config/env";

async function main() {
  if (process.env.CONFIRM_RESTORE !== "RESTORE_AL_ARAB") {
    throw new Error("Set CONFIRM_RESTORE=RESTORE_AL_ARAB to authorize a destructive restore");
  }
  if (!env.mongoUri) throw new Error("MONGODB_URI is required for restore");

  const archiveArgument = process.argv[2];
  if (!archiveArgument) throw new Error("Provide the backup archive path");
  const archivePath = path.resolve(archiveArgument);
  await access(archivePath);

  const executable = process.platform === "win32" ? "mongorestore.exe" : "mongorestore";
  await new Promise<void>((resolve, reject) => {
    const child = spawn(executable, [
      `--uri=${env.mongoUri}`,
      `--archive=${archivePath}`,
      "--gzip",
      "--drop"
    ], { stdio: ["ignore", "inherit", "inherit"] });
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve()
      : reject(new Error(`mongorestore exited with code ${code ?? "unknown"}`)));
  });

  console.log("MongoDB restore completed successfully.");
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown restore error";
  console.error(`MongoDB restore failed: ${message}`);
  process.exitCode = 1;
});
