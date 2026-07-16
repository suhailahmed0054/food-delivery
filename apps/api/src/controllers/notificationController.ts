import { Request, Response } from "express";
import mongoose from "mongoose";
import { Notification } from "../models/Notification";
import {
  listLocalNotifications,
  markAllLocalNotificationsRead,
  markLocalNotificationRead
} from "../services/localNotificationStore";
import { publicNotification } from "../services/inAppNotificationService";

function notificationScope(req: Request) {
  if (req.user?.role === "admin") {
    return { audience: "admin" as const, recipient: undefined };
  }
  if (req.user?.role === "customer") {
    return { audience: "customer" as const, recipient: req.user.id };
  }
  return null;
}

function routeId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

export async function listNotifications(req: Request, res: Response) {
  const scope = notificationScope(req);
  if (!scope) return res.status(403).json({ message: "Notifications are unavailable for this role" });

  const notifications = Notification.db.readyState === 1
    ? await Notification.find({
        audience: scope.audience,
        ...(scope.recipient ? { recipient: scope.recipient } : {})
      })
        .sort({ createdAt: -1 })
        .limit(100)
        .lean()
    : (await listLocalNotifications())
        .filter(
          (notification) =>
            notification.audience === scope.audience &&
            (!scope.recipient || notification.recipient === scope.recipient)
        )
        .slice(0, 100);
  const items = notifications.map((notification) => publicNotification(notification));
  return res.json({
    notifications: items,
    unreadCount: items.filter((notification) => !notification.readAt).length
  });
}

export async function markNotificationRead(req: Request, res: Response) {
  const scope = notificationScope(req);
  if (!scope) return res.status(403).json({ message: "Notifications are unavailable for this role" });
  const id = routeId(req);

  if (Notification.db.readyState === 1) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ message: "Notification not found" });
    }
    const notification = await Notification.findOneAndUpdate(
      {
        _id: id,
        audience: scope.audience,
        ...(scope.recipient ? { recipient: scope.recipient } : {})
      },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: "Notification not found" });
    return res.json(publicNotification(notification));
  }

  const allowed = (await listLocalNotifications()).some(
    (notification) =>
      notification.id === id &&
      notification.audience === scope.audience &&
      (!scope.recipient || notification.recipient === scope.recipient)
  );
  if (!allowed) return res.status(404).json({ message: "Notification not found" });
  const notification = await markLocalNotificationRead(id);
  return res.json(publicNotification(notification));
}

export async function markAllNotificationsRead(req: Request, res: Response) {
  const scope = notificationScope(req);
  if (!scope) return res.status(403).json({ message: "Notifications are unavailable for this role" });

  if (Notification.db.readyState === 1) {
    const result = await Notification.updateMany(
      {
        audience: scope.audience,
        ...(scope.recipient ? { recipient: scope.recipient } : {}),
        readAt: { $exists: false }
      },
      { $set: { readAt: new Date() } }
    );
    return res.json({ updated: result.modifiedCount });
  }

  const updated = await markAllLocalNotificationsRead(
    scope.audience,
    scope.recipient
  );
  return res.json({ updated });
}
