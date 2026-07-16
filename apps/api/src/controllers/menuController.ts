import { Request, Response } from "express";
import { z } from "zod";
import { MenuItem } from "../models/MenuItem";
import {
  createLocalMenuItem,
  deleteLocalMenuItem,
  listLocalMenu,
  updateLocalMenuItem
} from "../services/localMenuStore";
import { env } from "../config/env";

const FALLBACK_MENU_IMAGE =
  "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=1200&q=80";

const menuImageSchema = z
  .string()
  .trim()
  .url("Dish image must be an HTTPS URL")
  .max(2048)
  .refine((value) => value.startsWith("https://"), "Dish image must use HTTPS")
  .refine((value) => {
    try {
      return env.menuImageHosts.includes(new URL(value).hostname.toLowerCase());
    } catch {
      return false;
    }
  }, "Dish image host is not approved");

const menuItemSchema = z.object({
  name: z.string().trim().min(1),
  category: z.enum(["Appetizers", "Mains", "Desserts", "Beverages"]),
  price: z.coerce.number().min(0),
  available: z.boolean(),
  image: menuImageSchema,
  description: z.string().trim().min(1),
  ingredients: z.array(z.string()),
  allergens: z.array(z.string()),
  customization: z.object({
    sizes: z.array(z.object({ name: z.string().trim().min(1), priceDelta: z.coerce.number() })).min(1),
    spiceLevels: z.array(z.string().trim().min(1)).min(1),
    addOns: z.array(z.object({ name: z.string().trim().min(1), price: z.coerce.number().min(0) }))
  })
});

const menuItemUpdateSchema = menuItemSchema.partial();

function isMongoConnected() {
  return MenuItem.db.readyState === 1;
}

function routeId(req: Request) {
  const id = req.params.id;
  return Array.isArray(id) ? id[0] : id;
}

function publicMenuItem<T extends object>(item: T): T & { image: string } {
  const image = (item as { image?: unknown }).image;
  let approvedImage = false;
  if (typeof image === "string" && image.startsWith("https://")) {
    try {
      approvedImage = env.menuImageHosts.includes(new URL(image).hostname.toLowerCase());
    } catch {
      approvedImage = false;
    }
  }
  return {
    ...item,
    image: approvedImage ? image as string : FALLBACK_MENU_IMAGE
  };
}

function emitMenuUpdated(req: Request) {
  req.app.get("io")?.emit("menu:updated", { updatedAt: new Date().toISOString() });
}

export async function listMenu(_req: Request, res: Response) {
  try {
    res.set("Cache-Control", "public, max-age=30, stale-while-revalidate=300");
    if (!isMongoConnected()) {
      const menu = await listLocalMenu();
      return res.json(menu.map((item) => publicMenuItem(item)));
    }

    const menu = await MenuItem.find({}).sort({ category: 1, name: 1 }).lean();
    return res.json(menu.map((item) => publicMenuItem(item)));
  } catch {
    return res.status(500).json({ message: "Unable to load menu" });
  }
}

export async function createMenuItem(req: Request, res: Response) {
  const parsed = menuItemSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid menu item", errors: parsed.error.flatten() });

  try {
    if (!isMongoConnected()) {
      const item = await createLocalMenuItem(parsed.data);
      emitMenuUpdated(req);
      return res.status(201).json(item);
    }

    const item = await MenuItem.create({
      ...parsed.data,
      rating: 0,
      reviews: 0
    });
    emitMenuUpdated(req);
    return res.status(201).json(item);
  } catch {
    return res.status(500).json({ message: "Unable to create menu item" });
  }
}

export async function updateMenuItem(req: Request, res: Response) {
  const parsed = menuItemUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ message: "Invalid menu item", errors: parsed.error.flatten() });

  try {
    const id = routeId(req);

    if (!isMongoConnected()) {
      const item = await updateLocalMenuItem(id, parsed.data);
      if (!item) return res.status(404).json({ message: "Menu item not found" });
      emitMenuUpdated(req);
      return res.json(item);
    }

    const item = await MenuItem.findByIdAndUpdate(id, parsed.data, { new: true, runValidators: true });
    if (!item) return res.status(404).json({ message: "Menu item not found" });
    emitMenuUpdated(req);
    return res.json(item);
  } catch {
    return res.status(500).json({ message: "Unable to update menu item" });
  }
}

export async function deleteMenuItem(req: Request, res: Response) {
  try {
    const id = routeId(req);

    if (!isMongoConnected()) {
      const deleted = await deleteLocalMenuItem(id);
      if (!deleted) return res.status(404).json({ message: "Menu item not found" });
      emitMenuUpdated(req);
      return res.status(204).send();
    }

    const item = await MenuItem.findByIdAndDelete(id);
    if (!item) return res.status(404).json({ message: "Menu item not found" });
    emitMenuUpdated(req);
    return res.status(204).send();
  } catch {
    return res.status(500).json({ message: "Unable to delete menu item" });
  }
}
