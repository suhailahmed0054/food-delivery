import { Request, Response } from "express";
import { MenuItem } from "../models/MenuItem";

const fallbackMenu = [
  {
    id: "chicken-mandi",
    name: "Chicken Mandi",
    category: "Mandi",
    price: 349,
    rating: 4.8,
    image: "https://images.unsplash.com/photo-1677686707390-9c56626c7fbd?auto=format&fit=crop&w=900&q=80",
    description: "Smoky rice, tender chicken, mandi spice, salata and garlic sauce."
  },
  {
    id: "mixed-grill",
    name: "Mixed Arabic Grill",
    category: "Grill",
    price: 699,
    rating: 4.7,
    image: "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&q=80",
    description: "Seekh kebab, tikka, grilled chicken, pita, pickles and dips."
  }
];

export async function listMenu(_req: Request, res: Response) {
  const connected = MenuItem.db.readyState === 1;
  if (!connected) return res.json(fallbackMenu);
  const menu = await MenuItem.find({ available: true }).sort({ category: 1, name: 1 });
  return res.json(menu);
}

export async function createMenuItem(req: Request, res: Response) {
  const item = await MenuItem.create(req.body);
  return res.status(201).json(item);
}
