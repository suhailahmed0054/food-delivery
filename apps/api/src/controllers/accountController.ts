import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import type { Request, Response } from "express";
import { z } from "zod";
import { Order } from "../models/Order";
import { User } from "../models/User";
import {
  findLocalAccountByEmail,
  findLocalAccountById,
  updateLocalAccount,
  type CustomerAddress
} from "../services/localAccountStore";
import { listLocalOrders } from "../services/localOrderStore";
import {
  attachTrackedOrderToCustomer,
  withoutOrderTrackingSecret
} from "../services/orderTrackingService";

const profileSchema = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().min(7).max(30)
});

const addressSchema = z.object({
  label: z.string().trim().min(1).max(50),
  address: z.string().trim().min(5).max(1000),
  phone: z.string().trim().min(7).max(30).optional(),
  latitude: z.number().finite().min(-90).max(90).optional(),
  longitude: z.number().finite().min(-180).max(180).optional(),
  isDefault: z.boolean().optional()
}).superRefine((address, context) => {
  if ((address.latitude === undefined) !== (address.longitude === undefined)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Both latitude and longitude are required",
      path: ["latitude"]
    });
  }
});

const notificationSchema = z.object({
  orderUpdates: z.boolean(),
  offers: z.boolean()
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(72),
  newPassword: z.string().min(8).max(72)
});

const claimOrdersSchema = z.object({
  orders: z.array(z.object({
    orderNumber: z.string().trim().min(4).max(64),
    trackingToken: z.string().trim().min(32).max(128)
  })).max(50)
});

function isMongoConnected() {
  return User.db.readyState === 1;
}

function accountId(req: Request) {
  return req.user?.id ?? "";
}

function publicAccount(account: {
  id?: string;
  _id?: unknown;
  name: string;
  email: string;
  phone?: string;
  addresses?: CustomerAddress[];
  notificationPreferences?: { orderUpdates?: boolean; offers?: boolean };
  createdAt: Date | string;
}) {
  return {
    id: account.id ?? String(account._id),
    name: account.name,
    email: account.email,
    phone: account.phone ?? "",
    addresses: account.addresses ?? [],
    notificationPreferences: {
      orderUpdates: account.notificationPreferences?.orderUpdates ?? true,
      offers: account.notificationPreferences?.offers ?? true
    },
    joinedAt:
      account.createdAt instanceof Date
        ? account.createdAt.toISOString()
        : account.createdAt
  };
}

async function getAccount(req: Request) {
  if (!accountId(req)) return null;
  if (!isMongoConnected()) return findLocalAccountById(accountId(req));
  return User.findOne({
    _id: accountId(req),
    role: "customer",
    isBlocked: false
  });
}

export async function getCustomerAccount(req: Request, res: Response) {
  const account = await getAccount(req);
  if (!account || account.isBlocked) {
    return res.status(401).json({ message: "Account is unavailable" });
  }
  return res.json(publicAccount(account));
}

export async function updateCustomerProfile(req: Request, res: Response) {
  const parsed = profileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Enter a valid name, email and phone number",
      errors: parsed.error.flatten()
    });
  }

  if (!isMongoConnected()) {
    const emailOwner = await findLocalAccountByEmail(parsed.data.email);
    if (emailOwner && emailOwner.id !== accountId(req)) {
      return res.status(409).json({ message: "This email is already in use" });
    }
    const account = await updateLocalAccount(accountId(req), parsed.data);
    if (!account) return res.status(404).json({ message: "Account not found" });
    return res.json(publicAccount(account));
  }

  const duplicate = await User.exists({
    email: parsed.data.email,
    _id: { $ne: accountId(req) }
  });
  if (duplicate) {
    return res.status(409).json({ message: "This email is already in use" });
  }
  const account = await User.findOneAndUpdate(
    { _id: accountId(req), role: "customer", isBlocked: false },
    parsed.data,
    { new: true, runValidators: true }
  );
  if (!account) return res.status(404).json({ message: "Account not found" });
  return res.json(publicAccount(account));
}

export async function addCustomerAddress(req: Request, res: Response) {
  const parsed = addressSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Enter a valid delivery address",
      errors: parsed.error.flatten()
    });
  }
  const account = await getAccount(req);
  if (!account) return res.status(404).json({ message: "Account not found" });
  if ((account.addresses?.length ?? 0) >= 10) {
    return res.status(409).json({ message: "You can save up to 10 addresses" });
  }

  const makeDefault =
    parsed.data.isDefault === true || (account.addresses?.length ?? 0) === 0;
  const address: CustomerAddress = {
    id: randomUUID(),
    ...parsed.data,
    isDefault: makeDefault
  };
  const addresses = [
    ...(account.addresses ?? []).map((item) => ({
      ...item,
      isDefault: makeDefault ? false : item.isDefault
    })),
    address
  ];
  const updated = isMongoConnected()
    ? await User.findByIdAndUpdate(
        accountId(req),
        { addresses },
        { new: true, runValidators: true }
      )
    : await updateLocalAccount(accountId(req), { addresses });
  if (!updated) return res.status(404).json({ message: "Account not found" });
  return res.status(201).json(address);
}

export async function deleteCustomerAddress(req: Request, res: Response) {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const account = await getAccount(req);
  if (!account) return res.status(404).json({ message: "Account not found" });

  const existing = account.addresses ?? [];
  const removed = existing.find((address) => address.id === id);
  if (!removed) return res.status(404).json({ message: "Address not found" });
  const addresses = existing
    .filter((address) => address.id !== id)
    .map((address, index) => ({
      ...address,
      isDefault: removed.isDefault ? index === 0 : address.isDefault
    }));
  const updated = isMongoConnected()
    ? await User.findByIdAndUpdate(
        accountId(req),
        { addresses },
        { new: true, runValidators: true }
      )
    : await updateLocalAccount(accountId(req), { addresses });
  if (!updated) return res.status(404).json({ message: "Account not found" });
  return res.status(204).send();
}

export async function updateCustomerNotifications(req: Request, res: Response) {
  const parsed = notificationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid notification preferences" });
  }
  const account = isMongoConnected()
    ? await User.findOneAndUpdate(
        { _id: accountId(req), role: "customer", isBlocked: false },
        { notificationPreferences: parsed.data },
        { new: true, runValidators: true }
      )
    : await updateLocalAccount(accountId(req), {
        notificationPreferences: parsed.data
      });
  if (!account) return res.status(404).json({ message: "Account not found" });
  return res.json(parsed.data);
}

export async function changeCustomerPassword(req: Request, res: Response) {
  const parsed = passwordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "The new password must be at least 8 characters" });
  }
  const account = await getAccount(req);
  if (!account?.passwordHash) {
    return res.status(400).json({ message: "This account uses an external sign-in provider" });
  }
  if (!(await bcrypt.compare(parsed.data.currentPassword, account.passwordHash))) {
    return res.status(400).json({ message: "Current password is incorrect" });
  }
  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 10);
  if (isMongoConnected()) {
    await User.findByIdAndUpdate(accountId(req), { passwordHash });
  } else {
    await updateLocalAccount(accountId(req), { passwordHash });
  }
  return res.status(204).send();
}

export async function listCustomerOrders(req: Request, res: Response) {
  const orders = isMongoConnected()
    ? await Order.find({ customer: accountId(req) }).sort({ createdAt: -1 }).limit(100)
    : (await listLocalOrders())
        .filter((order) => order.customer === accountId(req))
        .slice(0, 100);
  return res.json(orders.map((order) => withoutOrderTrackingSecret(order)));
}

export async function claimCustomerOrders(req: Request, res: Response) {
  const parsed = claimOrdersSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid saved order details" });
  }
  const results = await Promise.all(
    parsed.data.orders.map((order) =>
      attachTrackedOrderToCustomer(
        order.orderNumber,
        order.trackingToken,
        accountId(req)
      )
    )
  );
  return res.json({ claimed: results.filter(Boolean).length });
}
