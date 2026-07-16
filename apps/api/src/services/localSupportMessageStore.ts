import { mkdir, readFile } from "fs/promises";
import path from "path";
import { writeJsonFileAtomic } from "./localFileStore";

export type LocalSupportMessage = {
  id: string;
  issue: string;
  order?: string;
  sender?: string;
  senderType: "customer" | "guest" | "agent" | "admin" | "system";
  senderName: string;
  message: string;
  images: string[];
  createdAt: string;
  readAt?: string;
};

export type LocalSupportMessageInput = Omit<LocalSupportMessage, "id" | "createdAt" | "readAt">;

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "support-messages.json");

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeJsonFileAtomic(dataFile, []);
  }
}

async function writeMessages(messages: LocalSupportMessage[]) {
  await ensureStore();
  await writeJsonFileAtomic(dataFile, messages);
}

export async function listMessagesByIssue(issueId: string): Promise<LocalSupportMessage[]> {
  await ensureStore();
  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    const all = Array.isArray(parsed) ? (parsed as LocalSupportMessage[]) : [];
    return all.filter((m) => m.issue === issueId).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function createLocalMessage(input: LocalSupportMessageInput): Promise<LocalSupportMessage> {
  await ensureStore();
  let all: LocalSupportMessage[] = [];
  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    all = Array.isArray(parsed) ? (parsed as LocalSupportMessage[]) : [];
  } catch { /* empty */ }

  const now = new Date().toISOString();
  const id = `MSG-${Date.now().toString().slice(-8)}-${Math.floor(Math.random() * 900 + 100)}`;

  const msg: LocalSupportMessage = {
    ...input,
    id,
    images: input.images || [],
    createdAt: now
  };

  all.push(msg);
  await writeMessages(all);
  return msg;
}
