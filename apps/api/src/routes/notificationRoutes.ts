import { Router } from "express";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead
} from "../controllers/notificationController";
import { asyncHandler } from "../middleware/asyncHandler";
import {
  requireAuth,
  requireCustomerAuth
} from "../middleware/auth";
import { rateLimit } from "../middleware/rateLimit";

export const notificationRouter = Router();

notificationRouter.use((req, res, next) => {
  const requestedScope = req.get("x-notification-scope");
  if (requestedScope === "customer") {
    return requireCustomerAuth(req, res, next);
  }
  if (requestedScope !== "admin") {
    return res.status(400).json({ message: "Notification scope is required" });
  }
  return requireAuth(req, res, () => {
    if (req.user?.role !== "admin") {
      return res.status(403).json({ message: "Admin access required" });
    }
    return next();
  });
});
notificationRouter.get("/", asyncHandler(listNotifications));
notificationRouter.patch(
  "/read-all",
  rateLimit(30, 60_000, "notifications-read-all"),
  asyncHandler(markAllNotificationsRead)
);
notificationRouter.patch(
  "/:id/read",
  rateLimit(60, 60_000, "notification-read"),
  asyncHandler(markNotificationRead)
);
