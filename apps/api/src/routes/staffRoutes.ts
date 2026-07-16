import { Router } from "express";
import {
  createDeliveryPerson,
  deleteDeliveryPerson,
  listDeliveryPeople,
  updateDeliveryPerson
} from "../controllers/staffController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

export const staffRouter = Router();

staffRouter.use(requireAuth, requireRole("admin"));
staffRouter.get("/", asyncHandler(listDeliveryPeople));
staffRouter.post("/", asyncHandler(createDeliveryPerson));
staffRouter.put("/:id", asyncHandler(updateDeliveryPerson));
staffRouter.delete("/:id", asyncHandler(deleteDeliveryPerson));
