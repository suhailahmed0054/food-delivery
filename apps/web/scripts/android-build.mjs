import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { resolve } from "node:path";

const webDirectory = resolve(import.meta.dirname, "..");
const androidDirectory = resolve(webDirectory, "android");
const isWindows = process.platform === "win32";

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

const environment = {
  ...process.env,
  JAVA_HOME: javaHome,
  ANDROID_HOME: androidHome,
  ANDROID_SDK_ROOT: androidHome
};

const result = isWindows
  ? spawnSync(
      process.env.ComSpec ?? "C:\\Windows\\System32\\cmd.exe",
      ["/d", "/s", "/c", "gradlew.bat assembleDebug --no-daemon"],
      { cwd: androidDirectory, env: environment, stdio: "inherit" }
    )
  : spawnSync(
      resolve(androidDirectory, "gradlew"),
      ["assembleDebug", "--no-daemon"],
      { cwd: androidDirectory, env: environment, stdio: "inherit" }
    );

if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`Android build failed with exit code ${result.status}`);
}

console.log(
  `Debug APK: ${resolve(androidDirectory, "app/build/outputs/apk/debug/app-debug.apk")}`
);
