import { randomUUID } from "crypto";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { writeJsonFileAtomic } from "./localFileStore";

export type LocalNotification = {
  id: string;
  audience: "admin" | "customer";
  recipient?: string;
  type: "order" | "payment" | "delivery" | "support" | "system";
  title: string;
  message: string;
  href?: string;
  orderNumber?: string;
  supportIssueId?: string;
  dedupeKey: string;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalNotificationInput = Omit<
  LocalNotification,
  "id" | "readAt" | "createdAt" | "updatedAt"
>;

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "notifications.json");
let storeQueue: Promise<void> = Promise.resolve();

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeJsonFileAtomic(dataFile, []);
  }
}

async function writeNotifications(notifications: LocalNotification[]) {
  await ensureStore();
  await writeJsonFileAtomic(dataFile, notifications.slice(0, 1000));
}

async function readNotifications() {
  await ensureStore();
  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalNotification[]) : [];
  } catch {
    return [];
  }
}

function queueStoreOperation<T>(operation: () => Promise<T>) {
  const result = storeQueue.then(operation, operation);
  storeQueue = result.then(() => undefined, () => undefined);
  return result;
}

export async function listLocalNotifications() {
  return queueStoreOperation(readNotifications);
}

export async function createLocalNotification(input: LocalNotificationInput) {
  return queueStoreOperation(async () => {
    const notifications = await readNotifications();
    const duplicate = notifications.find(
      (notification) => notification.dedupeKey === input.dedupeKey
    );
    if (duplicate) return { notification: duplicate, created: false };

    const now = new Date().toISOString();
    const notification: LocalNotification = {
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now
    };
    await writeNotifications([notification, ...notifications]);
    return { notification, created: true };
  });
}

export async function markLocalNotificationRead(id: string) {
  return queueStoreOperation(async () => {
    const notifications = await readNotifications();
    const index = notifications.findIndex((notification) => notification.id === id);
    if (index < 0) return null;
    const now = new Date().toISOString();
    notifications[index] = {
      ...notifications[index],
      readAt: notifications[index].readAt ?? now,
      updatedAt: now
    };
    await writeNotifications(notifications);
    return notifications[index];
  });
}

export async function markAllLocalNotificationsRead(
  audience: "admin" | "customer",
  recipient?: string
) {
  return queueStoreOperation(async () => {
    const notifications = await readNotifications();
    const now = new Date().toISOString();
    let changed = 0;
    const updated = notifications.map((notification) => {
      const belongsToUser =
        notification.audience === audience &&
        (audience === "admin" || notification.recipient === recipient);
      if (!belongsToUser || notification.readAt) return notification;
      changed += 1;
      return { ...notification, readAt: now, updatedAt: now };
    });
    if (changed > 0) await writeNotifications(updated);
    return changed;
  });
}
