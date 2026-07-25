import { spawnSync } from "node:child_process";

const isWindows = process.platform === "win32";
const executable = isWindows
  ? process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe"
  : "npm";
const checks = [
  ["Customer/Admin Web and Android", "apps/web"],
  ["Backend API and managed dependencies", "apps/api"]
];

let failed = false;

for (const [label, workspace] of checks) {
  console.log(`\n=== ${label} ===`);
  const args = isWindows
    ? ["/d", "/s", "/c", `npm.cmd run verify-production -w ${workspace}`]
    : ["run", "verify-production", "-w", workspace];
  const result = spawnSync(
    executable,
    args,
    {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit",
      shell: false
    }
  );

  if (result.error) {
    console.error(`Verification process failed to start: ${result.error.message}`);
    failed = true;
  } else if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  console.error(
    "\nProduction verification failed. No secret values were displayed; add the reported variables in the appropriate local production file or hosting dashboard."
  );
  process.exitCode = 1;
} else {
  console.log("\nAll production configuration and dependency checks passed.");
}
