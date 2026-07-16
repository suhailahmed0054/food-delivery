import { env } from "../config/env";

type OperationalAlert = {
  event: string;
  message: string;
  requestId?: string;
  route?: string;
  severity?: "warning" | "error" | "fatal";
};

const ALERT_TIMEOUT_MS = 5_000;

export async function reportOperationalAlert(alert: OperationalAlert) {
  if (!env.alertWebhookUrl) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ALERT_TIMEOUT_MS);

  try {
    const response = await fetch(env.alertWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service: "al-arab-api",
        environment: env.nodeEnv,
        release: env.releaseSha,
        timestamp: new Date().toISOString(),
        severity: alert.severity ?? "error",
        event: alert.event,
        message: alert.message.slice(0, 1_000),
        requestId: alert.requestId,
        route: alert.route
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      console.error(`Operational alert delivery failed with status ${response.status}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown alert delivery error";
    console.error(`Operational alert delivery failed: ${message}`);
  } finally {
    clearTimeout(timeout);
  }
}
