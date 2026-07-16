import { Router } from "express";
import {
  createMenuItem,
  deleteMenuItem,
  listMenu,
  updateMenuItem
} from "../controllers/menuController";
import { requireAuth, requireRole } from "../middleware/auth";
import { asyncHandler } from "../middleware/asyncHandler";

export const menuRouter = Router();

menuRouter.get("/", asyncHandler(listMenu));

menuRouter.post("/", requireAuth, requireRole("admin"), asyncHandler(createMenuItem));
menuRouter.put("/:id", requireAuth, requireRole("admin"), asyncHandler(updateMenuItem));
menuRouter.delete("/:id", requireAuth, requireRole("admin"), asyncHandler(deleteMenuItem));
