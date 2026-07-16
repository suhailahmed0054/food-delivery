import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { Order } from "../models/Order";
import { User } from "../models/User";
import {
  getLocalCustomer,
  listLocalCustomers,
  updateLocalCustomer
} from "../services/localCustomerStore";

const blockSchema = z.object({
  reason: z.string().trim().max(500).optional()
});

const notesSchema = z.object({
  notes: z.string().trim().max(2000)
});

function routeId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function isMongoConnected() {
  return User.db.readyState === 1;
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function listMongoCustomers(search: string, status: string) {
  const userFilter: Record<string, unknown> = { role: "customer" };
  if (status === "blocked") userFilter.isBlocked = true;
  if (status === "active") userFilter.isBlocked = { $ne: true };
  if (search) {
    const pattern = new RegExp(escapeRegex(search), "i");
    userFilter.$or = [{ name: pattern }, { email: pattern }, { phone: pattern }];
  }
  const users = await User.find(userFilter)
    .select("name email phone isBlocked blockedAt blockReason adminNotes createdAt")
    .sort({ createdAt: -1 })
    .limit(200)
    .lean();
  const userIds = users.map((user) => user._id);
  const stats = await Order.aggregate<{
    _id: mongoose.Types.ObjectId;
    orderCount: number;
    totalSpent: number;
    lastOrderAt: Date;
  }>([
    { $match: { customer: { $in: userIds } } },
    {
      $group: {
        _id: "$customer",
        orderCount: { $sum: 1 },
        totalSpent: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $ne: ["$status", "cancelled"] },
                  { $ne: ["$paymentStatus", "refunded"] }
                ]
              },
              "$total",
              0
            ]
          }
        },
        lastOrderAt: { $max: "$createdAt" }
      }
    }
  ]);
  const statsById = new Map(stats.map((item) => [String(item._id), item]));

  return users.map((user) => {
    const customerStats = statsById.get(String(user._id));
    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      phone: user.phone,
      orderCount: customerStats?.orderCount ?? 0,
      totalSpent: customerStats?.totalSpent ?? 0,
      joinedAt: user.createdAt?.toISOString(),
      lastOrderAt: customerStats?.lastOrderAt?.toISOString(),
      isBlocked: Boolean(user.isBlocked),
      blockedAt: user.blockedAt?.toISOString(),
      blockReason: user.blockReason,
      adminNotes: user.adminNotes
    };
  });
}

export async function listCustomers(req: Request, res: Response) {
  const search = String(req.query.search ?? "").trim().toLowerCase();
  const status = String(req.query.status ?? "all");
  if (!new Set(["all", "active", "blocked"]).has(status)) {
    return res.status(400).json({ message: "Invalid customer status filter" });
  }
  const customers = isMongoConnected()
    ? await listMongoCustomers(search, status)
    : (await listLocalCustomers()).map(({ orders: _orders, ...customer }) => customer);

  const filtered = customers.filter((customer) => {
    const matchesSearch =
      !search ||
      [customer.name, customer.email, customer.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(search));
    const matchesStatus =
      status === "all" ||
      (status === "blocked" ? customer.isBlocked : !customer.isBlocked);
    return matchesSearch && matchesStatus;
  });

  return res.json(filtered.slice(0, 200));
}

export async function getCustomer(req: Request, res: Response) {
  const id = routeId(req);
  if (!isMongoConnected()) {
    const customer = await getLocalCustomer(id);
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    return res.json(customer);
  }

  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Customer not found" });
  }
  const user = await User.findOne({ _id: id, role: "customer" })
    .select("name email phone isBlocked blockedAt blockReason adminNotes createdAt")
    .lean();
  if (!user) return res.status(404).json({ message: "Customer not found" });

  const [orders, stats] = await Promise.all([
    Order.find({ customer: user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean(),
    Order.aggregate<{ orderCount: number; totalSpent: number; lastOrderAt?: Date }>([
      { $match: { customer: user._id } },
      {
        $group: {
          _id: null,
          orderCount: { $sum: 1 },
          totalSpent: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ["$status", "cancelled"] },
                    { $ne: ["$paymentStatus", "refunded"] }
                  ]
                },
                "$total",
                0
              ]
            }
          },
          lastOrderAt: { $max: "$createdAt" }
        }
      }
    ])
  ]);
  const customerStats = stats[0];
  return res.json({
    id: String(user._id),
    name: user.name,
    email: user.email,
    phone: user.phone,
    joinedAt: user.createdAt?.toISOString(),
    isBlocked: Boolean(user.isBlocked),
    blockedAt: user.blockedAt?.toISOString(),
    blockReason: user.blockReason,
    adminNotes: user.adminNotes,
    orderCount: customerStats?.orderCount ?? 0,
    totalSpent: customerStats?.totalSpent ?? 0,
    lastOrderAt: customerStats?.lastOrderAt?.toISOString(),
    orders
  });
}

export async function blockCustomer(req: Request, res: Response) {
  const parsed = blockSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid block reason" });
  const id = routeId(req);

  if (!isMongoConnected()) {
    const customer = await updateLocalCustomer(id, {
      isBlocked: true,
      blockedAt: new Date().toISOString(),
      blockReason: parsed.data.reason
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    return res.json(customer);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Customer not found" });
  }
  const customer = await User.findOneAndUpdate(
    { _id: id, role: "customer" },
    {
      isBlocked: true,
      blockedAt: new Date(),
      blockReason: parsed.data.reason
    },
    { new: true, runValidators: true }
  )
    .select("name email phone isBlocked blockedAt blockReason adminNotes createdAt")
    .lean();
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  return res.json({ id: String(customer._id), ...customer });
}

export async function unblockCustomer(req: Request, res: Response) {
  const id = routeId(req);
  if (!isMongoConnected()) {
    const customer = await updateLocalCustomer(id, {
      isBlocked: false,
      blockedAt: undefined,
      blockReason: undefined
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    return res.json(customer);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Customer not found" });
  }
  const customer = await User.findOneAndUpdate(
    { _id: id, role: "customer" },
    {
      isBlocked: false,
      $unset: { blockedAt: 1, blockReason: 1 }
    },
    { new: true, runValidators: true }
  )
    .select("name email phone isBlocked blockedAt blockReason adminNotes createdAt")
    .lean();
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  return res.json({ id: String(customer._id), ...customer });
}

export async function updateCustomerNotes(req: Request, res: Response) {
  const parsed = notesSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Notes are too long" });
  const id = routeId(req);

  if (!isMongoConnected()) {
    const customer = await updateLocalCustomer(id, {
      adminNotes: parsed.data.notes
    });
    if (!customer) return res.status(404).json({ message: "Customer not found" });
    return res.json(customer);
  }
  if (!mongoose.Types.ObjectId.isValid(id)) {
    return res.status(404).json({ message: "Customer not found" });
  }
  const customer = await User.findOneAndUpdate(
    { _id: id, role: "customer" },
    { adminNotes: parsed.data.notes },
    { new: true, runValidators: true }
  )
    .select("name email phone isBlocked blockedAt blockReason adminNotes createdAt")
    .lean();
  if (!customer) return res.status(404).json({ message: "Customer not found" });
  return res.json({ id: String(customer._id), ...customer });
}
