import { mkdir, readFile } from "fs/promises";
import path from "path";
import { writeJsonFileAtomic } from "./localFileStore";

export type LocalIssue = {
  id: string;
  order: string;
  orderNumber: string;
  customer?: string;
  customerName: string;
  phone: string;
  email?: string;
  category: "missing_items" | "wrong_items" | "poor_quality" | "delivery_delay" | "other";
  description: string;
  desiredResolution: "refund" | "redelivery" | "feedback";
  status: "open" | "investigating" | "resolved" | "refunded" | "closed";
  resolutionDetails: string;
  refundAmount: number;
  images?: string[];
  chatStatus: "waiting" | "active" | "closed";
  assignedAgent?: string;
  assignedAgentName?: string;
  lastMessage: string;
  lastMessageAt?: string;
  resolutionType: "none" | "refund" | "partial_refund" | "replacement" | "coupon" | "rejected" | "resolved";
  decisionReason: string;
  refundApproved: boolean;
  refundStatus: "none" | "pending" | "processed" | "failed";
  razorpayRefundId?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type LocalIssueInput = Omit<LocalIssue, "id" | "status" | "resolutionDetails" | "refundAmount" | "createdAt" | "updatedAt" | "chatStatus" | "lastMessage" | "resolutionType" | "decisionReason" | "refundApproved" | "refundStatus">;

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "issues.json");

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeJsonFileAtomic(dataFile, []);
  }
}

async function writeLocalIssues(issues: LocalIssue[]) {
  await ensureStore();
  await writeJsonFileAtomic(dataFile, issues);
}

export async function listLocalIssues(): Promise<LocalIssue[]> {
  await ensureStore();
  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    if (!Array.isArray(parsed)) return [];
    return (parsed as LocalIssue[]).map((issue) => {
      const legacyRefundStatus = (issue as unknown as { refundStatus?: string }).refundStatus;
      return legacyRefundStatus === "simulated" || legacyRefundStatus === "refunded"
        ? {
            ...issue,
            status: "investigating" as const,
            chatStatus: "active" as const,
            refundStatus: "failed" as const,
            closedAt: undefined
          }
        : issue;
    });
  } catch {
    return [];
  }
}

export async function getLocalIssue(id: string): Promise<LocalIssue | null> {
  const issues = await listLocalIssues();
  return issues.find((issue) => issue.id === id) ?? null;
}

export async function createLocalIssue(input: LocalIssueInput): Promise<LocalIssue> {
  const issues = await listLocalIssues();
  const now = new Date().toISOString();
  const id = `ISS-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 90 + 10)}`;

  const issue: LocalIssue = {
    ...input,
    id,
    status: "open",
    resolutionDetails: "",
    refundAmount: 0,
    images: input.images || [],
    chatStatus: "waiting",
    lastMessage: "",
    resolutionType: "none",
    decisionReason: "",
    refundApproved: false,
    refundStatus: "none",
    createdAt: now,
    updatedAt: now
  };

  await writeLocalIssues([issue, ...issues]);
  return issue;
}

export async function updateLocalIssue(
  id: string,
  updateData: Partial<Omit<LocalIssue, "id" | "createdAt">>
): Promise<LocalIssue | null> {
  const issues = await listLocalIssues();
  const index = issues.findIndex((issue) => issue.id === id);
  if (index === -1) return null;

  const currentIssue = issues[index];
  const now = new Date().toISOString();

  const nextIssue: LocalIssue = {
    ...currentIssue,
    ...updateData,
    updatedAt: now
  };

  issues[index] = nextIssue;
  await writeLocalIssues(issues);
  return issues[index];
}
