import { create } from "zustand";
import { persist } from "zustand/middleware";
import { MenuItem } from "@/lib/data";

type WishlistState = {
  items: MenuItem[];

  addToWishlist: (item: MenuItem) => void;

  removeFromWishlist: (id: string) => void;
};

export const useWishlistStore = create<WishlistState>()(
  persist(
    (set) => ({
      items: [],
      addToWishlist: (item) =>
        set((state) => ({
          items: state.items.some((wishlistItem) => wishlistItem.id === item.id)
            ? state.items
            : [...state.items, item]
        })),
      removeFromWishlist: (id) =>
        set((state) => ({
          items: state.items.filter((item) => item.id !== id)
        }))
    }),
    { name: "al-arab-wishlist" }
  )
);
