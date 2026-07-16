import { Router } from "express";
import {
  createTable,
  listTables,
  regenerateTableToken,
  resolveTable,
  updateTable
} from "../controllers/tableController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

export const tableRouter = Router();

tableRouter.post("/resolve", asyncHandler(resolveTable));
tableRouter.get("/", requireAuth, requireRole("admin"), asyncHandler(listTables));
tableRouter.post("/", requireAuth, requireRole("admin"), asyncHandler(createTable));
tableRouter.post("/:id/regenerate", requireAuth, requireRole("admin"), asyncHandler(regenerateTableToken));
tableRouter.patch("/:id", requireAuth, requireRole("admin"), asyncHandler(updateTable));
