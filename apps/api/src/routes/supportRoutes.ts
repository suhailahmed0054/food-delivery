import { Router } from "express";
import { createIssue, listIssues, getCustomerIssues, getIssue, updateIssue, getMessages, sendMessage, assignIssue, decideIssue } from "../controllers/supportController";
import { asyncHandler } from "../middleware/asyncHandler";
import { rateLimit } from "../middleware/rateLimit";
import { requireAuth, requireRole, optionalCustomerAuth } from "../middleware/auth";

export const supportRouter = Router();

supportRouter.post("/issues", rateLimit(10, 15 * 60_000, "support-create"), optionalCustomerAuth, asyncHandler(createIssue));
supportRouter.get("/issues/customer", optionalCustomerAuth, asyncHandler(getCustomerIssues));
supportRouter.get("/issues", requireAuth, requireRole("admin"), asyncHandler(listIssues));
supportRouter.get("/issues/:id", optionalCustomerAuth, asyncHandler(getIssue));
supportRouter.get("/issues/:id/messages", optionalCustomerAuth, asyncHandler(getMessages));
supportRouter.post("/issues/:id/messages", rateLimit(30, 15 * 60_000, "support-message"), optionalCustomerAuth, asyncHandler(sendMessage));
supportRouter.patch("/issues/:id/assign", requireAuth, requireRole("admin"), asyncHandler(assignIssue));
supportRouter.patch("/issues/:id/decision", requireAuth, requireRole("admin"), asyncHandler(decideIssue));
supportRouter.patch("/issues/:id", requireAuth, requireRole("admin"), asyncHandler(updateIssue));
