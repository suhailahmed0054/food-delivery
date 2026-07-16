import type { Server } from "socket.io";
import { Notification } from "../models/Notification";
import { User } from "../models/User";
import { findLocalAccountById } from "./localAccountStore";
import {
  createLocalNotification,
  type LocalNotificationInput
} from "./localNotificationStore";

export type InAppNotificationInput = LocalNotificationInput;

export type PublicInAppNotification = {
  id: string;
  audience: "admin" | "customer";
  recipient?: string;
  type: string;
  title: string;
  message: string;
  href?: string;
  orderNumber?: string;
  supportIssueId?: string;
  readAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

function publicNotification(notification: unknown): PublicInAppNotification {
  const value = notification as {
    id?: string;
    _id?: unknown;
    audience: "admin" | "customer";
    recipient?: unknown;
    type: string;
    title: string;
    message: string;
    href?: string;
    orderNumber?: string;
    supportIssueId?: string;
    readAt?: string | Date;
    createdAt?: string | Date;
    updatedAt?: string | Date;
    toObject?: () => Record<string, unknown>;
  };
  return {
    id: value.id ?? String(value._id),
    audience: value.audience,
    recipient: value.recipient ? String(value.recipient) : undefined,
    type: value.type,
    title: value.title,
    message: value.message,
    href: value.href,
    orderNumber: value.orderNumber,
    supportIssueId: value.supportIssueId,
    readAt: value.readAt,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt
  };
}

async function customerWantsOrderUpdates(customerId: string) {
  if (User.db.readyState === 1) {
    const customer = await User.findById(customerId)
      .select("notificationPreferences.orderUpdates")
      .lean();
    return customer?.notificationPreferences?.orderUpdates ?? true;
  }
  const customer = await findLocalAccountById(customerId);
  return customer?.notificationPreferences.orderUpdates ?? true;
}

export async function createInAppNotification(
  input: InAppNotificationInput,
  io?: Server
) {
  try {
    if (
      input.audience === "customer" &&
      (
        !input.recipient ||
        (["order", "delivery"].includes(input.type) &&
          !(await customerWantsOrderUpdates(input.recipient)))
      )
    ) {
      return null;
    }

    let result: { notification: unknown; created: boolean };
    if (Notification.db.readyState === 1) {
      const existing = await Notification.findOne({ dedupeKey: input.dedupeKey });
      if (existing) {
        result = { notification: existing, created: false };
      } else {
        try {
          const notification = await Notification.create(input);
          result = { notification, created: true };
        } catch (error) {
          const duplicate = await Notification.findOne({ dedupeKey: input.dedupeKey });
          if (!duplicate) throw error;
          result = { notification: duplicate, created: false };
        }
      }
    } else {
      result = await createLocalNotification(input);
    }

    const notification = publicNotification(result.notification);
    if (result.created && io) {
      const room = input.audience === "admin"
        ? "notifications:admin"
        : `notifications:user:${input.recipient}`;
      io.to(room).emit("notification:new", notification);
    }
    return notification;
  } catch (error) {
    console.warn("Unable to create in-app notification", error);
    return null;
  }
}

export { publicNotification };
