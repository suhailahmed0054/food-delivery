import { Request, Response } from "express";
import { Order } from "../models/Order";
import { Review } from "../models/Review";
import { listLocalOrders } from "../services/localOrderStore";
import { listLocalReviews } from "../services/localReviewStore";

type ReportOrder = {
  total: number;
  status: string;
  orderType: "delivery" | "takeaway" | "dine_in";
  paymentMethod?: string;
  paymentStatus?: string;
  tableNumber?: string;
  customer?: unknown;
  customerName?: string;
  phone?: string;
  deliveryAgent?: { name?: string };
  items: Array<{ name?: string; quantity?: number; price?: number }>;
  createdAt: string | Date;
};

function parseDate(value: unknown, fallback: Date) {
  if (typeof value !== "string" || !value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function summarizeOrders(
  orders: ReportOrder[],
  from: Date,
  to: Date,
  reviewRatings: number[]
) {
  const filtered = orders.filter((order) => {
    const createdAt = new Date(order.createdAt);
    return createdAt >= from && createdAt <= to;
  });
  const revenueOrders = filtered.filter(
    (order) =>
      order.status.toLowerCase() !== "cancelled" &&
      order.paymentStatus !== "refunded" &&
      (order.paymentMethod !== "razorpay" || order.paymentStatus === "paid")
  );
  const revenueOrderSet = new Set(revenueOrders);
  const revenue = revenueOrders.reduce((sum, order) => sum + order.total, 0);
  const itemStats = new Map<string, { quantity: number; revenue: number }>();
  const dailyStats = new Map<string, { orders: number; revenue: number }>();
  const deliveryStats = new Map<string, { assigned: number; delivered: number }>();
  const tableStats = new Map<string, { orders: number; revenue: number }>();
  const customerOrders = new Map<string, number>();

  filtered.forEach((order) => {
    const date = new Date(order.createdAt).toISOString().slice(0, 10);
    const daily = dailyStats.get(date) ?? { orders: 0, revenue: 0 };
    daily.orders += 1;
    if (revenueOrderSet.has(order)) daily.revenue += order.total;
    dailyStats.set(date, daily);

    if (revenueOrderSet.has(order)) {
      order.items.forEach((item) => {
        const name = item.name?.trim() || "Item";
        const current = itemStats.get(name) ?? { quantity: 0, revenue: 0 };
        const quantity = Number(item.quantity) || 1;
        current.quantity += quantity;
        current.revenue += (Number(item.price) || 0) * quantity;
        itemStats.set(name, current);
      });
    }

    if (order.deliveryAgent?.name) {
      const current = deliveryStats.get(order.deliveryAgent.name) ?? {
        assigned: 0,
        delivered: 0
      };
      current.assigned += 1;
      if (order.status.toLowerCase() === "delivered") current.delivered += 1;
      deliveryStats.set(order.deliveryAgent.name, current);
    }

    if (order.orderType === "dine_in" && order.tableNumber) {
      const current = tableStats.get(order.tableNumber) ?? {
        orders: 0,
        revenue: 0
      };
      current.orders += 1;
      if (revenueOrderSet.has(order)) current.revenue += order.total;
      tableStats.set(order.tableNumber, current);
    }

    const customerKey =
      order.phone?.replace(/\D/g, "") ||
      (typeof order.customer === "string" ? order.customer : "") ||
      order.customerName?.trim().toLowerCase() ||
      "guest";
    customerOrders.set(customerKey, (customerOrders.get(customerKey) ?? 0) + 1);
  });

  return {
    period: { from: from.toISOString(), to: to.toISOString() },
    totals: {
      orders: filtered.length,
      revenue,
      averageOrderValue:
        revenueOrders.length > 0 ? Math.round(revenue / revenueOrders.length) : 0,
      deliveryOrders: filtered.filter((order) => order.orderType === "delivery").length,
      takeawayOrders: filtered.filter((order) => order.orderType === "takeaway").length,
      dineInOrders: filtered.filter((order) => order.orderType === "dine_in").length,
      paidOrders: filtered.filter((order) => order.paymentStatus === "paid").length,
      cancelledOrders: filtered.filter(
        (order) => order.status.toLowerCase() === "cancelled"
      ).length,
      uniqueCustomers: customerOrders.size,
      repeatCustomers: Array.from(customerOrders.values()).filter(
        (count) => count > 1
      ).length
    },
    payments: {
      cash: filtered.filter(
        (order) => order.paymentMethod === "cash_on_delivery"
      ).length,
      online: filtered.filter((order) => order.paymentMethod === "razorpay")
        .length
    },
    feedback: {
      averageRating: reviewRatings.length > 0
        ? Number((reviewRatings.reduce((sum, rating) => sum + rating, 0) / reviewRatings.length).toFixed(1))
        : 0,
      reviewCount: reviewRatings.length
    },
    topItems: Array.from(itemStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((first, second) => second.quantity - first.quantity)
      .slice(0, 8),
    dailySales: Array.from(dailyStats.entries())
      .map(([date, stats]) => ({ date, ...stats }))
      .sort((first, second) => first.date.localeCompare(second.date)),
    deliveryPerformance: Array.from(deliveryStats.entries())
      .map(([name, stats]) => ({ name, ...stats }))
      .sort((first, second) => second.delivered - first.delivered),
    tablePerformance: Array.from(tableStats.entries())
      .map(([tableNumber, stats]) => ({ tableNumber, ...stats }))
      .sort((first, second) => second.orders - first.orders)
  };
}

export async function getReportSummary(req: Request, res: Response) {
  const now = new Date();
  const defaultFrom = new Date(now);
  defaultFrom.setDate(defaultFrom.getDate() - 30);
  const from = parseDate(req.query.from, defaultFrom);
  const to = parseDate(req.query.to, now);
  to.setHours(23, 59, 59, 999);

  if (from > to) {
    return res.status(400).json({ message: "Report start date must be before end date" });
  }
  if (to.getTime() - from.getTime() > 366 * 24 * 60 * 60 * 1000) {
    return res.status(400).json({ message: "Report range cannot exceed 366 days" });
  }

  const [orders, reviews] = Order.db.readyState === 1
    ? await Promise.all([
        Order.find({ createdAt: { $gte: from, $lte: to } }).lean(),
        Review.find({ createdAt: { $gte: from, $lte: to } }).select({ rating: 1 }).lean()
      ])
    : await Promise.all([listLocalOrders(), listLocalReviews()]);
  const reviewRatings = reviews
    .filter((review) => {
      const createdAt = new Date(review.createdAt);
      return createdAt >= from && createdAt <= to;
    })
    .map((review) => Number(review.rating))
    .filter((rating) => Number.isFinite(rating) && rating >= 1 && rating <= 5);
  return res.json(
    summarizeOrders(orders as unknown as ReportOrder[], from, to, reviewRatings)
  );
}
