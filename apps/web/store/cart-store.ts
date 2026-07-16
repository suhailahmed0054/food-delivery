"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MenuItem } from "@/lib/data";

export type CartCustomization = {
  size: string;
  spiceLevel: string;
  addOns: string[];
};

export type CartLine = {
  lineId: string;
  item: MenuItem;
  quantity: number;
  customization: CartCustomization;
  unitPrice: number;
};

export type CartItemInput = {
  item: MenuItem;
  customization: CartCustomization;
  quantity: number;
};

type CartState = {
  items: CartLine[];
  promoCode: string;
  discount: number;
  addItem: (item: MenuItem, customization: CartCustomization) => void;
  addItems: (items: CartItemInput[]) => void;
  removeItem: (lineId: string) => void;
  setQuantity: (lineId: string, quantity: number) => void;
  applyPromo: (code: string) => void;
  clearCart: () => void;
};

// --- UPSALE RECOMMENDATION ENGINE ---
export const getUpsellRecommendation = (cartItems: CartLine[], menu: MenuItem[]) => {
  // If user has 'Mains' in cart, suggest a Beverage or Dessert not yet in cart
  const hasMains = cartItems.some((i) => i.item.category === "Mains");

  if (hasMains) {
    return menu.find((i) =>
      (i.category === "Beverages" || i.category === "Desserts") &&
      i.available &&
      !cartItems.some((c) => c.item.id === i.id)
    );
  }
  return null;
};

function getUnitPrice(item: MenuItem, customization: CartCustomization) {
  const sizePrice = item.customization.sizes.find((size) => size.name === customization.size)?.priceDelta ?? 0;
  const addOnPrice = customization.addOns.reduce((sum, addOn) => {
    return sum + (item.customization.addOns.find((option) => option.name === addOn)?.price ?? 0);
  }, 0);
  return item.price + sizePrice + addOnPrice;
}

function getLineId(item: MenuItem, customization: CartCustomization) {
  return [item.id, customization.size, customization.spiceLevel, ...[...customization.addOns].sort()].join("|");
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      promoCode: "",
      discount: 0,
      addItem: (item, customization) =>
        set((state) => {
          const lineId = getLineId(item, customization);
          const existing = state.items.find((line) => line.lineId === lineId);
          if (existing) {
            return {
              items: state.items.map((line) => (line.lineId === lineId ? { ...line, quantity: line.quantity + 1 } : line))
            };
          }
          return {
            items: [
              ...state.items,
              {
                lineId,
                item,
                quantity: 1,
                customization,
                unitPrice: getUnitPrice(item, customization)
              }
            ]
          };
        }),
      addItems: (newItems) =>
        set((state) => {
          const items = [...state.items];

          newItems.forEach(({ item, customization, quantity }) => {
            const normalizedQuantity = Math.max(1, Math.floor(quantity));
            const lineId = getLineId(item, customization);
            const existingIndex = items.findIndex((line) => line.lineId === lineId);

            if (existingIndex >= 0) {
              const existing = items[existingIndex];
              items[existingIndex] = {
                ...existing,
                quantity: existing.quantity + normalizedQuantity
              };
              return;
            }

            items.push({
              lineId,
              item,
              quantity: normalizedQuantity,
              customization,
              unitPrice: getUnitPrice(item, customization)
            });
          });

          return { items };
        }),
      removeItem: (lineId) =>
        set((state) => ({
          items: state.items.filter((line) => line.lineId !== lineId)
        })),
      setQuantity: (lineId, quantity) =>
        set((state) => ({
          items: state.items
            .map((line) => (line.lineId === lineId ? { ...line, quantity } : line))
            .filter((line) => line.quantity > 0)
        })),
      applyPromo: (code) =>
        set(() => {
          const normalized = code.trim().toUpperCase();
          return {
            promoCode: normalized,
            discount: 0
          };
        }),
      clearCart: () => set({ items: [], promoCode: "", discount: 0 })
    }),
    { name: "al-arab-cart" }
  )
);
