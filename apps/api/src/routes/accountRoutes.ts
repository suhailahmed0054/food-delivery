import { Router } from "express";
import {
  addCustomerAddress,
  claimCustomerOrders,
  deleteCustomerAddress,
  getCustomerAccount,
  listCustomerOrders,
  updateCustomerNotifications,
  updateCustomerProfile
} from "../controllers/accountController";
import { asyncHandler } from "../middleware/asyncHandler";
import { requireCustomerAuth } from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

export const accountRouter = Router();

accountRouter.use(requireCustomerAuth);
accountRouter.get("/", asyncHandler(getCustomerAccount));
accountRouter.put("/profile", asyncHandler(updateCustomerProfile));
accountRouter.post("/addresses", asyncHandler(addCustomerAddress));
accountRouter.delete("/addresses/:id", asyncHandler(deleteCustomerAddress));
accountRouter.put("/notifications", asyncHandler(updateCustomerNotifications));
accountRouter.get("/orders", asyncHandler(listCustomerOrders));
accountRouter.post("/orders/claim", rateLimit(10, 15 * 60_000, "orders-claim"), asyncHandler(claimCustomerOrders));
