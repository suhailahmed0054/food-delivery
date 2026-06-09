import { Router } from "express";
import { createMenuItem, listMenu } from "../controllers/menuController";
import { requireAuth, requireRole } from "../middleware/auth";

export const menuRouter = Router();

menuRouter.get("/", listMenu);
menuRouter.post("/", requireAuth, requireRole("admin"), createMenuItem);
