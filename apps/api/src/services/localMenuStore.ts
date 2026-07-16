import { randomUUID } from "crypto";
import { mkdir, readFile } from "fs/promises";
import path from "path";
import { writeJsonFileAtomic } from "./localFileStore";

export type LocalMenuItem = {
  id: string;
  name: string;
  category: "Appetizers" | "Mains" | "Desserts" | "Beverages";
  price: number;
  available: boolean;
  rating: number;
  reviews: number;
  image: string;
  description: string;
  ingredients: string[];
  allergens: string[];
  customization: {
    sizes: Array<{ name: string; priceDelta: number }>;
    spiceLevels: string[];
    addOns: Array<{ name: string; price: number }>;
  };
};

export type LocalMenuItemInput = Omit<LocalMenuItem, "id" | "rating" | "reviews">;

const dataDir = path.resolve(__dirname, "../../data");
const dataFile = path.join(dataDir, "menu-items.json");

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureStore() {
  await mkdir(dataDir, { recursive: true });

  try {
    await readFile(dataFile, "utf8");
  } catch {
    await writeJsonFileAtomic(dataFile, []);
  }
}

async function writeLocalMenu(items: LocalMenuItem[]) {
  await ensureStore();
  await writeJsonFileAtomic(dataFile, items);
}

export async function listLocalMenu() {
  await ensureStore();
  const raw = await readFile(dataFile, "utf8");
  return JSON.parse(raw) as LocalMenuItem[];
}

export async function createLocalMenuItem(input: LocalMenuItemInput) {
  const items = await listLocalMenu();
  const baseId = slugify(input.name) || "menu-item";
  let id = baseId;

  if (items.some((item) => item.id === id)) {
    id = `${baseId}-${randomUUID().slice(0, 8)}`;
  }

  const item: LocalMenuItem = { id, ...input, rating: 0, reviews: 0 };
  await writeLocalMenu([item, ...items]);
  return item;
}

export async function updateLocalMenuItem(id: string, input: Partial<LocalMenuItemInput>) {
  const items = await listLocalMenu();
  const index = items.findIndex((item) => item.id === id);

  if (index === -1) return null;

  const updated = { ...items[index], ...input, id };
  items[index] = updated;
  await writeLocalMenu(items);
  return updated;
}

export async function deleteLocalMenuItem(id: string) {
  const items = await listLocalMenu();
  const nextItems = items.filter((item) => item.id !== id);

  if (nextItems.length === items.length) return false;

  await writeLocalMenu(nextItems);
  return true;
}

export async function updateLocalMenuRatings(
  ratings: Map<string, { rating: number; reviews: number }>
) {
  const items = await listLocalMenu();
  const updated = items.map((item) => ({
    ...item,
    ...(ratings.get(item.id) ?? { rating: 0, reviews: 0 })
  }));
  await writeLocalMenu(updated);
  return updated;
}
