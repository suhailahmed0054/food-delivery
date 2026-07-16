import { Router } from "express";
import { getReportSummary } from "../controllers/reportController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

export const reportRouter = Router();

reportRouter.use(requireAuth, requireRole("admin"));
reportRouter.get("/summary", asyncHandler(getReportSummary));
