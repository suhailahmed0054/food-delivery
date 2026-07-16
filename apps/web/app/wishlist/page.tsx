"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Heart, ShoppingBag, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { useWishlistStore } from "@/store/wishlist-store";

function money(value: number) {
  return `Rs ${value.toLocaleString("en-IN")}`;
}

export default function WishlistPage() {
  const { items, removeFromWishlist } = useWishlistStore();
  const { addItem } = useCartStore();

  return (
    <main className="min-h-screen bg-black p-5 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Link
            href="/mobile"
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-[#111111]"
            aria-label="Back to menu"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-3xl font-black">Wishlist</h1>
          <div className="h-10 w-10" />
        </div>

        {items.length === 0 ? (
          <section className="rounded-lg border border-white/10 bg-[#111111] p-5 text-center">
            <Heart className="mx-auto text-[#D84315]" size={32} />
            <h2 className="mt-3 text-xl font-bold">No saved items</h2>
            <Link
              href="/mobile"
              className="mt-4 inline-flex h-11 items-center justify-center rounded-md bg-yellow-500 px-5 font-bold text-black"
            >
              Browse Menu
            </Link>
          </section>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.id} className="flex gap-3 rounded-lg border border-white/10 bg-[#111111] p-3">
                <Image
                  src={item.image}
                  alt={item.name}
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-md object-cover"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="truncate font-bold">{item.name}</h2>
                      <p className="mt-1 line-clamp-2 text-sm text-white/60">{item.description}</p>
                    </div>
                    <p className="shrink-0 font-black text-yellow-500">{money(item.price)}</p>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        addItem(item, {
                          size: item.customization.sizes[0]?.name ?? "Regular",
                          spiceLevel: item.customization.spiceLevels[0] ?? "Regular",
                          addOns: []
                        })
                      }
                      className="flex h-10 items-center justify-center gap-2 rounded-md bg-yellow-500 px-4 text-sm font-bold text-black"
                    >
                      <ShoppingBag size={16} />
                      Add
                    </button>

                    <button
                      type="button"
                      onClick={() => removeFromWishlist(item.id)}
                      className="flex h-10 w-10 items-center justify-center rounded-md text-red-300 hover:bg-red-500/10"
                      aria-label={`Remove ${item.name}`}
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
