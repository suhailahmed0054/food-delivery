import { Router } from "express";
import {
  listAdminReviews,
  listMenuItemReviews,
  listOrderReviews,
  submitOrderReviews
} from "../controllers/reviewController";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  optionalCustomerAuth,
  requireAuth,
  requireRole
} from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

export const reviewRouter = Router();

reviewRouter.get(
  "/admin",
  requireAuth,
  requireRole("admin"),
  asyncHandler(listAdminReviews)
);
reviewRouter.get("/menu/:id", rateLimit(60, 60_000, "reviews-menu-read"), asyncHandler(listMenuItemReviews));
reviewRouter.get(
  "/order/:id",
  rateLimit(30, 60_000, "reviews-order-read"),
  optionalCustomerAuth,
  asyncHandler(listOrderReviews)
);
reviewRouter.post(
  "/",
  rateLimit(20, 60_000, "review-submit"),
  optionalCustomerAuth,
  asyncHandler(submitOrderReviews)
);
