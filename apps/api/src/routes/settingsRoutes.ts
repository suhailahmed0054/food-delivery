import { Router } from "express";
import { getSettings, updateSettings } from "../controllers/settingsController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

export const settingsRouter = Router();

settingsRouter.get("/public", asyncHandler(getSettings));
settingsRouter.get("/", requireAuth, requireRole("admin"), asyncHandler(getSettings));
settingsRouter.put(
  "/",
  requireAuth,
  requireRole("admin"),
  asyncHandler(updateSettings)
);
