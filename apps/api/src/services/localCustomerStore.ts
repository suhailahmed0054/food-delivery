import { createHash } from "crypto";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { writeJsonFileAtomic } from "./localFileStore";
import {
  findLocalAccountById,
  listLocalAccounts,
  updateLocalAccount
} from "./localAccountStore";
import { listLocalOrders, type LocalOrder } from "./localOrderStore";

type LocalCustomerOverride = {
  id: string;
  isBlocked?: boolean;
  blockedAt?: string;
  blockReason?: string;
  adminNotes?: string;
};

export type LocalCustomer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  orderCount: number;
  totalSpent: number;
  joinedAt: string;
  lastOrderAt?: string;
  isBlocked: boolean;
  blockedAt?: string;
  blockReason?: string;
  adminNotes?: string;
  orders: LocalOrder[];
};

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "customer-overrides.json");

function countsTowardSpend(order: LocalOrder) {
  return order.status !== "cancelled" && order.paymentStatus !== "refunded";
}

function customerKey(order: LocalOrder) {
  if (order.customer) return `customer:${order.customer}`;
  const phone = order.phone?.replace(/\D/g, "");
  if (phone) return `phone:${phone}`;
  return `name:${(order.customerName ?? "Guest customer").trim().toLowerCase()}`;
}

function customerId(key: string) {
  return `local-${createHash("sha256").update(key).digest("hex").slice(0, 20)}`;
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeJsonFileAtomic(dataFile, []);
  }
}

async function listOverrides() {
  await ensureStore();
  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalCustomerOverride[]) : [];
  } catch {
    return [];
  }
}

async function writeOverrides(overrides: LocalCustomerOverride[]) {
  await ensureStore();
  await writeJsonFileAtomic(dataFile, overrides);
}

export async function listLocalCustomers() {
  const [orders, overrides, accounts] = await Promise.all([
    listLocalOrders(),
    listOverrides(),
    listLocalAccounts()
  ]);
  const grouped = new Map<string, LocalOrder[]>();

  orders.forEach((order) => {
    const key = customerKey(order);
    grouped.set(key, [...(grouped.get(key) ?? []), order]);
  });

  const accountCustomers = accounts
    .filter((account) => account.role === "customer")
    .map((account): LocalCustomer => {
      const accountOrders = [...(grouped.get(`customer:${account.id}`) ?? [])]
        .sort(
          (first, second) =>
            new Date(second.createdAt).getTime() -
            new Date(first.createdAt).getTime()
        );
      const lastOrder = accountOrders[0];

      return {
        id: account.id,
        name: account.name,
        email: account.email,
        phone: account.phone ?? lastOrder?.phone,
        orderCount: accountOrders.length,
        totalSpent: accountOrders.reduce(
          (sum, order) => sum + (countsTowardSpend(order) ? order.total : 0),
          0
        ),
        joinedAt: account.createdAt,
        lastOrderAt: lastOrder?.createdAt,
        isBlocked: account.isBlocked,
        blockedAt: account.blockedAt,
        blockReason: account.blockReason,
        adminNotes: account.adminNotes,
        orders: accountOrders
      };
    });
  const accountIds = new Set(accountCustomers.map((customer) => customer.id));
  const orderCustomers = Array.from(grouped.entries())
    .filter(([key]) => {
      if (!key.startsWith("customer:")) return true;
      return !accountIds.has(key.slice("customer:".length));
    })
    .map(([key, customerOrders]): LocalCustomer => {
      const sortedOrders = [...customerOrders].sort(
        (first, second) =>
          new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime()
      );
      const id = customerId(key);
      const override = overrides.find((item) => item.id === id);
      const firstOrder = sortedOrders.at(-1)!;
      const lastOrder = sortedOrders[0];

      return {
        id,
        name: lastOrder.customerName?.trim() || "Guest customer",
        phone: lastOrder.phone,
        orderCount: sortedOrders.length,
        totalSpent: sortedOrders.reduce(
          (sum, order) => sum + (countsTowardSpend(order) ? order.total : 0),
          0
        ),
        joinedAt: firstOrder.createdAt,
        lastOrderAt: lastOrder.createdAt,
        isBlocked: Boolean(override?.isBlocked),
        blockedAt: override?.blockedAt,
        blockReason: override?.blockReason,
        adminNotes: override?.adminNotes,
        orders: sortedOrders
      };
    });

  return [...accountCustomers, ...orderCustomers].sort((first, second) => {
    const firstActivity = first.lastOrderAt ?? first.joinedAt;
    const secondActivity = second.lastOrderAt ?? second.joinedAt;
    return (
      new Date(secondActivity).getTime() - new Date(firstActivity).getTime()
    );
  });
}

export async function getLocalCustomer(id: string) {
  const customers = await listLocalCustomers();
  return customers.find((customer) => customer.id === id) ?? null;
}

export async function updateLocalCustomer(
  id: string,
  update: Partial<
    Pick<
      LocalCustomerOverride,
      "isBlocked" | "blockedAt" | "blockReason" | "adminNotes"
    >
  >
) {
  const account = await findLocalAccountById(id);
  if (account?.role === "customer") {
    const updated = await updateLocalAccount(id, update);
    return updated ? getLocalCustomer(id) : null;
  }

  const customer = await getLocalCustomer(id);
  if (!customer) return null;

  const overrides = await listOverrides();
  const index = overrides.findIndex((item) => item.id === id);
  const current = index >= 0 ? overrides[index] : { id };
  const next = { ...current, ...update };

  if (index >= 0) overrides[index] = next;
  else overrides.push(next);
  await writeOverrides(overrides);
  return getLocalCustomer(id);
}
