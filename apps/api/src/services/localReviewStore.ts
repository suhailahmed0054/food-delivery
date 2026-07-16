import { randomUUID } from "crypto";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { writeJsonFileAtomic } from "./localFileStore";

export type LocalReview = {
  id: string;
  orderNumber: string;
  menuItem: string;
  customer?: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "reviews.json");

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });
  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeJsonFileAtomic(dataFile, []);
  }
}

async function writeLocalReviews(reviews: LocalReview[]) {
  await ensureStore();
  await writeJsonFileAtomic(dataFile, reviews);
}

export async function listLocalReviews() {
  await ensureStore();
  try {
    const parsed = JSON.parse(await readFile(dataFile, "utf8")) as unknown;
    return Array.isArray(parsed) ? (parsed as LocalReview[]) : [];
  } catch {
    return [];
  }
}

export async function upsertLocalReviews(
  orderNumber: string,
  customer: string | undefined,
  customerName: string,
  items: Array<{ menuItem: string; rating: number; comment: string }>
) {
  const reviews = await listLocalReviews();
  const now = new Date().toISOString();

  for (const item of items) {
    const index = reviews.findIndex(
      (review) =>
        review.orderNumber === orderNumber && review.menuItem === item.menuItem
    );
    if (index >= 0) {
      reviews[index] = {
        ...reviews[index],
        customer,
        customerName,
        rating: item.rating,
        comment: item.comment,
        updatedAt: now
      };
    } else {
      reviews.push({
        id: randomUUID(),
        orderNumber,
        menuItem: item.menuItem,
        customer,
        customerName,
        rating: item.rating,
        comment: item.comment,
        createdAt: now,
        updatedAt: now
      });
    }
  }

  await writeLocalReviews(reviews);
  return reviews.filter((review) => review.orderNumber === orderNumber);
}

export async function getLocalReviewAggregates() {
  const reviews = await listLocalReviews();
  const totals = new Map<string, { total: number; reviews: number }>();
  for (const review of reviews) {
    const current = totals.get(review.menuItem) ?? { total: 0, reviews: 0 };
    current.total += review.rating;
    current.reviews += 1;
    totals.set(review.menuItem, current);
  }

  return new Map(
    [...totals].map(([menuItem, value]) => [
      menuItem,
      {
        rating: Number((value.total / value.reviews).toFixed(1)),
        reviews: value.reviews
      }
    ])
  );
}
