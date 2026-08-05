import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const webDirectory = resolve(import.meta.dirname, "..");
const androidDirectory = resolve(webDirectory, "android");
const isWindows = process.platform === "win32";
const isRelease = process.argv.includes("--release");

function firstExisting(paths) {
  return paths.find((path) => path && existsSync(path));
}

const javaHome = firstExisting([
  process.env.JAVA_HOME,
  isWindows ? "C:\\Program Files\\Android\\Android Studio\\jbr" : "",
  process.platform === "darwin"
    ? "/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    : "",
  "/opt/android-studio/jbr"
]);

const androidHome = firstExisting([
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  isWindows && process.env.LOCALAPPDATA
    ? resolve(process.env.LOCALAPPDATA, "Android/Sdk")
    : "",
  process.platform === "darwin"
    ? resolve(homedir(), "Library/Android/sdk")
    : "",
  resolve(homedir(), "Android/Sdk")
]);

if (!existsSync(androidDirectory)) {
  throw new Error("Android platform is missing. Run npm run android:dev first.");
}
if (!javaHome) {
  throw new Error("Java was not found. Install Android Studio or set JAVA_HOME.");
}
if (!androidHome) {
  throw new Error("Android SDK was not found. Install it in Android Studio or set ANDROID_HOME.");
}

if (isRelease) {
  const requiredReleaseVariables = [
    "ANDROID_VERSION_CODE",
    "ANDROID_VERSION_NAME",
    "ANDROID_KEYSTORE_PATH",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
    "CAPACITOR_SERVER_URL"
  ];
  const missing = requiredReleaseVariables.filter(
    (name) => !process.env[name]?.trim()
  );
  if (missing.length > 0) {
    throw new Error(
      `Android release configuration is incomplete. Missing: ${missing.join(", ")}`
    );
  }
  const serverUrl = new URL(process.env.CAPACITOR_SERVER_URL);
  if (
    serverUrl.origin !== "https://al-arabrestaurant.cc.cd" ||
    serverUrl.pathname !== "/"
  ) {
    throw new Error(
      "CAPACITOR_SERVER_URL must be https://al-arabrestaurant.cc.cd for a production Android release"
    );
  }
  if (!existsSync(resolve(process.env.ANDROID_KEYSTORE_PATH))) {
    throw new Error("ANDROID_KEYSTORE_PATH does not point to an existing keystore");
  }
}

const environment = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome
};

if (isRelease) {
  const syncResult = spawnSync(
    isWindows ? "npx.cmd" : "npx",
    ["cap", "sync", "android"],
    { cwd: webDirectory, env: environment, stdio: "inherit" }
  );
  if (syncResult.error) throw syncResult.error;
  if (syncResult.status !== 0) {
    throw new Error(`Capacitor sync failed with exit code ${syncResult.status}`);
  }
}

const gradleTask = isRelease ? "bundleRelease" : "assembleDebug";
const result = isWindows
  ? spawnSync(
      process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe",
      ["/d", "/s", "/c", `gradlew.bat ${gradleTask} --no-daemon`],
      { cwd: androidDirectory, env: environment, stdio: "inherit" }
    )
  : spawnSync(
      resolve(androidDirectory, "gradlew"),
      [gradleTask, "--no-daemon"],
      { cwd: androidDirectory, env: environment, stdio: "inherit" }
    );

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Android build failed with exit code ${result.status}`);
}

console.log(isRelease
  ? `Release bundle: ${resolve(androidDirectory, "app/build/outputs/bundle/release/app-release.aab")}`
  : `Debug APK: ${resolve(androidDirectory, "app/build/outputs/apk/debug/app-debug.apk")}`
);
