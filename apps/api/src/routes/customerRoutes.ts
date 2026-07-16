import { Router } from "express";
import {
  blockCustomer,
  getCustomer,
  listCustomers,
  unblockCustomer,
  updateCustomerNotes
} from "../controllers/customerController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireAuth, requireRole } from "../middleware/auth";

export const customerRouter = Router();

customerRouter.use(requireAuth, requireRole("admin"));
customerRouter.get("/", asyncHandler(listCustomers));
customerRouter.get("/:id", asyncHandler(getCustomer));
customerRouter.patch("/:id/block", asyncHandler(blockCustomer));
customerRouter.patch("/:id/unblock", asyncHandler(unblockCustomer));
customerRouter.put("/:id/notes", asyncHandler(updateCustomerNotes));
