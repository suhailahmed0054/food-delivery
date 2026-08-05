import { execFileSync } from "child_process";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function main() {
  const branch = git("branch", "--show-current");
  const changes = git("status", "--porcelain");
  const commit = git("rev-parse", "--short=12", "HEAD");

  if (branch !== "main") throw new Error(`Release branch must be main, found ${branch}`);
  if (changes) throw new Error("Release worktree is not clean");

  let upstream;
  try {
    upstream = git("rev-parse", "--abbrev-ref", "@{upstream}");
  } catch {
    throw new Error("Release branch must track a remote upstream");
  }
  const [behind, ahead] = git(
    "rev-list",
    "--left-right",
    "--count",
    `${upstream}...HEAD`
  ).split(/\s+/).map(Number);
  if (behind || ahead) {
    throw new Error(
      `Release source must match ${upstream}; behind=${behind}, ahead=${ahead}`
    );
  }

  console.log(`Release source verified: ${branch}@${commit} matches ${upstream}`);
}

try {
  main();
} catch (error) {
  console.error(`Release check failed: ${error.message}`);
  process.exitCode = 1;
}
