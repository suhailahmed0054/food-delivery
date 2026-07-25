import { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { MenuItem } from "../models/MenuItem";
import { Order } from "../models/Order";
import { Review } from "../models/Review";
import { getLocalOrder } from "../services/localOrderStore";
import { listLocalMenu, updateLocalMenuRatings } from "../services/localMenuStore";
import {
  getLocalReviewAggregates,
  listLocalReviews,
  upsertLocalReviews
} from "../services/localReviewStore";
import { findOrderForTracking } from "../services/orderTrackingService";

const reviewItemSchema = z.object({
  menuItem: z.string().trim().min(1).max(200),
  rating: z.coerce.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default("")
});

const submitReviewSchema = z.object({
  orderNumber: z.string().trim().regex(/^[A-Za-z0-9-]{4,64}$/),
  trackingToken: z.string().trim().min(32).max(128).optional(),
  items: z.array(reviewItemSchema).min(1).max(30)
});

const reviewCredentialsSchema = z.object({
  orderNumber: z.string().trim().regex(/^[A-Za-z0-9-]{4,64}$/),
  trackingToken: z.string().trim().min(32).max(128).optional()
});

const adminReviewQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().trim().max(100).default(""),
  rating: z.preprocess(
    (value) => value === "" || value === undefined ? undefined : value,
    z.coerce.number().int().min(1).max(5).optional()
  )
});

type ReviewableOrder = {
  _id?: unknown;
  id?: string;
  orderNumber: string;
  customer?: unknown;
  customerName?: string;
  status: string;
  items: Array<{ menuItem?: unknown; name?: string }>;
};

type ReviewRecord = {
  id?: string;
  _id?: unknown;
  menuItem: unknown;
  customerName?: string;
  rating: number;
  comment?: string;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

function routeId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function publicReview(review: ReviewRecord) {
  const nameParts = (review.customerName?.trim() || "Verified customer")
    .split(/\s+/)
    .filter(Boolean);
  const customerName = nameParts.length > 1
    ? `${nameParts[0]} ${nameParts.at(-1)?.charAt(0)}.`
    : nameParts[0];

  return {
    id: review.id ?? String(review._id),
    menuItem: String(review.menuItem),
    customerName,
    rating: review.rating,
    comment: review.comment ?? "",
    createdAt: review.createdAt,
    updatedAt: review.updatedAt
  };
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function populatedText(value: unknown, field: "name" | "orderNumber") {
  if (!value || typeof value !== "object" || !(field in value)) return "";
  const text = (value as Record<string, unknown>)[field];
  return typeof text === "string" ? text : "";
}

function populatedId(value: unknown) {
  if (value && typeof value === "object" && "_id" in value) {
    return String((value as { _id: unknown })._id);
  }
  return String(value ?? "");
}

async function findOwnedOrder(
  orderNumber: string,
  trackingToken: string | undefined,
  customerId: string | undefined
): Promise<ReviewableOrder | null> {
  if (trackingToken) {
    return await findOrderForTracking(orderNumber, trackingToken) as
      | ReviewableOrder
      | null;
  }
  if (!customerId) return null;

  if (Order.db.readyState === 1) {
    return await Order.findOne({ orderNumber, customer: customerId }).lean() as
      | ReviewableOrder
      | null;
  }

  const order = await getLocalOrder(orderNumber);
  return order?.customer === customerId
    ? (order as ReviewableOrder)
    : null;
}

function reviewableItemIds(order: ReviewableOrder) {
  return new Set(
    order.items.flatMap((item) => {
      if (!item.menuItem) return [];
      return [String(item.menuItem)];
    })
  );
}

async function refreshMenuRatings(menuItemIds: string[]) {
  if (Review.db.readyState !== 1) {
    const aggregates = await getLocalReviewAggregates();
    await updateLocalMenuRatings(aggregates);
    return;
  }

  const objectIds = menuItemIds
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (objectIds.length === 0) return;

  const aggregates = await Review.aggregate<{
    _id: mongoose.Types.ObjectId;
    rating: number;
    reviews: number;
  }>([
    { $match: { menuItem: { $in: objectIds } } },
    {
      $group: {
        _id: "$menuItem",
        rating: { $avg: "$rating" },
        reviews: { $sum: 1 }
      }
    }
  ]);
  const byId = new Map(aggregates.map((value) => [String(value._id), value]));

  await MenuItem.bulkWrite(
    objectIds.map((id) => {
      const aggregate = byId.get(String(id));
      return {
        updateOne: {
          filter: { _id: id },
          update: {
            $set: {
              rating: aggregate ? Number(aggregate.rating.toFixed(1)) : 0,
              reviews: aggregate?.reviews ?? 0
            }
          }
        }
      };
    })
  );
}

export async function submitOrderReviews(req: Request, res: Response) {
  const parsed = submitReviewSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Enter a rating from 1 to 5 for each selected dish",
      errors: parsed.error.flatten()
    });
  }

  const order = await findOwnedOrder(
    parsed.data.orderNumber,
    parsed.data.trackingToken,
    req.user?.role === "customer" ? req.user.id : undefined
  );
  if (!order) {
    return res.status(403).json({ message: "Review access was denied" });
  }
  if (!['delivered', 'served'].includes(order.status.toLowerCase())) {
    return res.status(409).json({
      message: "You can review this order after it has been delivered or served"
    });
  }

  const allowedItemIds = reviewableItemIds(order);
  const uniqueItemIds = new Set(parsed.data.items.map((item) => item.menuItem));
  if (
    uniqueItemIds.size !== parsed.data.items.length ||
    parsed.data.items.some((item) => !allowedItemIds.has(item.menuItem))
  ) {
    return res.status(400).json({
      message: "A reviewed dish does not belong to this order"
    });
  }

  const customerName = order.customerName?.trim() || "Verified customer";
  let reviews: ReviewRecord[];
  if (Review.db.readyState === 1) {
    if (!order._id) return res.status(404).json({ message: "Order not found" });
    const operations = parsed.data.items.map((item) => ({
      updateOne: {
        filter: { order: order._id, menuItem: item.menuItem },
        update: {
          $set: {
            customer: req.user?.role === "customer" ? req.user.id : undefined,
            customerName,
            rating: item.rating,
            comment: item.comment
          },
          $setOnInsert: { order: order._id, menuItem: item.menuItem }
        },
        upsert: true
      }
    }));
    await Review.bulkWrite(operations, { ordered: false });
    reviews = await Review.find({ order: order._id })
      .sort({ createdAt: 1 })
      .lean() as unknown as ReviewRecord[];
  } else {
    reviews = await upsertLocalReviews(
      order.orderNumber,
      req.user?.role === "customer" ? req.user.id : undefined,
      customerName,
      parsed.data.items
    );
  }

  await refreshMenuRatings([...uniqueItemIds]);
  return res.status(201).json({
    reviews: reviews.map((review) => publicReview(review))
  });
}

export async function listOrderReviews(req: Request, res: Response) {
  const parsed = reviewCredentialsSchema.safeParse({
    orderNumber: routeId(req),
    trackingToken: req.header("x-order-tracking-token")
  });
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid review details" });
  }

  const order = await findOwnedOrder(
    parsed.data.orderNumber,
    parsed.data.trackingToken,
    req.user?.role === "customer" ? req.user.id : undefined
  );
  if (!order) return res.status(403).json({ message: "Review access was denied" });

  const reviews: ReviewRecord[] = Review.db.readyState === 1
    ? await Review.find({ order: order._id })
        .sort({ createdAt: 1 })
        .lean() as unknown as ReviewRecord[]
    : (await listLocalReviews()).filter(
        (review) => review.orderNumber === order.orderNumber
      );
  return res.json(reviews.map((review) => publicReview(review)));
}

export async function listMenuItemReviews(req: Request, res: Response) {
  const menuItemId = routeId(req);
  const reviews: ReviewRecord[] = Review.db.readyState === 1
    ? mongoose.Types.ObjectId.isValid(menuItemId)
      ? await Review.find({ menuItem: menuItemId })
          .sort({ createdAt: -1 })
          .limit(50)
          .lean() as unknown as ReviewRecord[]
      : []
    : (await listLocalReviews())
        .filter((review) => review.menuItem === menuItemId)
        .sort((first, second) => second.createdAt.localeCompare(first.createdAt))
        .slice(0, 50);

  return res.json(reviews.map((review) => publicReview(review)));
}

export async function listAdminReviews(req: Request, res: Response) {
  const parsed = adminReviewQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid review filters",
      errors: parsed.error.flatten()
    });
  }

  const { page, limit, rating, search } = parsed.data;
  const skip = (page - 1) * limit;

  if (Review.db.readyState === 1) {
    const filter: Record<string, unknown> = {};
    if (rating) filter.rating = rating;

    if (search) {
      const pattern = new RegExp(escapeRegex(search), "i");
      const [matchingOrders, matchingMenuItems] = await Promise.all([
        Order.find({ orderNumber: pattern }).select({ _id: 1 }).lean(),
        MenuItem.find({ name: pattern }).select({ _id: 1 }).lean()
      ]);
      filter.$or = [
        { customerName: pattern },
        { comment: pattern },
        { order: { $in: matchingOrders.map((order) => order._id) } },
        { menuItem: { $in: matchingMenuItems.map((item) => item._id) } }
      ];
    }

    const [reviews, total] = await Promise.all([
      Review.find(filter)
        .populate({ path: "order", select: "orderNumber" })
        .populate({ path: "menuItem", select: "name" })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Review.countDocuments(filter)
    ]);

    return res.json({
      reviews: reviews.map((review) => ({
        id: String(review._id),
        orderNumber: populatedText(review.order, "orderNumber"),
        menuItem: populatedId(review.menuItem),
        menuItemName: populatedText(review.menuItem, "name") || "Deleted dish",
        customerName: review.customerName?.trim() || "Verified customer",
        rating: review.rating,
        comment: review.comment ?? "",
        createdAt: review.createdAt,
        updatedAt: review.updatedAt
      })),
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(1, Math.ceil(total / limit))
      }
    });
  }

  const [reviews, menu] = await Promise.all([
    listLocalReviews(),
    listLocalMenu()
  ]);
  const menuNames = new Map(menu.map((item) => [item.id, item.name]));
  const normalizedSearch = search.toLowerCase();
  const filtered = reviews
    .filter((review) => !rating || review.rating === rating)
    .filter((review) => {
      if (!normalizedSearch) return true;
      const menuName = menuNames.get(review.menuItem) ?? "";
      return [
        review.customerName,
        review.comment,
        review.orderNumber,
        menuName
      ].some((value) => value.toLowerCase().includes(normalizedSearch));
    })
    .sort((first, second) => second.createdAt.localeCompare(first.createdAt));
  const total = filtered.length;

  return res.json({
    reviews: filtered.slice(skip, skip + limit).map((review) => ({
      id: review.id,
      orderNumber: review.orderNumber,
      menuItem: review.menuItem,
      menuItemName: menuNames.get(review.menuItem) ?? "Deleted dish",
      customerName: review.customerName || "Verified customer",
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt,
      updatedAt: review.updatedAt
    })),
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit))
    }
  });
}
