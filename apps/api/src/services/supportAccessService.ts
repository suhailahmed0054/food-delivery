import mongoose from "mongoose";
import { z } from "zod";
import { Issue } from "../models/Issue";
import type { UserRole } from "../models/User";
import { getLocalIssue } from "./localIssueStore";
import { findOrderForTracking } from "./orderTrackingService";

export const supportRoomCredentialsSchema = z.object({
  issueId: z.string().trim().regex(/^[A-Za-z0-9-]{4,100}$/),
  trackingToken: z.string().trim().min(32).max(128).optional()
});

type SupportAccessUser = {
  id: string;
  role: UserRole;
};

type SupportAccessIssue = {
  customer?: unknown;
  orderNumber: string;
};

export async function canAccessSupportIssue(
  issueId: string,
  user?: SupportAccessUser,
  trackingToken?: string
) {
  let issue: SupportAccessIssue | null;
  if (Issue.db.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(issueId)) return false;
    issue = await Issue.findById(issueId)
      .select("customer orderNumber")
      .lean() as SupportAccessIssue | null;
  } else {
    issue = await getLocalIssue(issueId);
  }

  if (!issue) return false;
  if (user?.role === "admin" || user?.role === "kitchen") return true;

  const customerId = String(issue.customer ?? "");
  if (user?.role === "customer" && customerId === user.id) return true;
  if (!trackingToken) return false;

  return Boolean(await findOrderForTracking(issue.orderNumber, trackingToken));
}
