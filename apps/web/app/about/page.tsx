"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, MapPin, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { fetchMenu } from "@/lib/api";
import { restaurant } from "@/lib/data";

export default function AboutPage() {
  const { data: menu = [] } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenu
  });
  const reviewCount = menu.reduce((total, item) => total + item.reviews, 0);
  const restaurantRating = reviewCount > 0
    ? menu.reduce(
        (total, item) => total + item.rating * item.reviews,
        0
      ) / reviewCount
    : 0;

  return (
    <main className="min-h-screen bg-background px-5 py-6 text-foreground">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card transition hover:bg-foreground/5">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black">About Al-Arab</h1>
          <div className="h-11 w-11" />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6 text-center">
          <Image src="/images/logo-watermark.png" alt="Al-Arab Restaurant" width={92} height={92} className="mx-auto h-20 w-auto object-contain" />
          <h2 className="mt-5 text-3xl font-black">{restaurant.name}</h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Al-Arab serves premium Arabic-inspired food with fresh mandi, grills, shawarma, desserts, and fast local delivery.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-background p-4">
              <Star className="mx-auto text-primary" size={22} />
              <p className="mt-2 text-xl font-black">
                {reviewCount > 0 ? restaurantRating.toFixed(1) : "New"}
              </p>
              <p className="text-xs font-semibold text-muted-foreground">
                {reviewCount > 0
                  ? `${reviewCount} verified reviews`
                  : "No verified reviews yet"}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <MapPin className="mx-auto text-primary" size={22} />
              <p className="mt-2 text-xl font-black">2 Zones</p>
              <p className="text-xs font-semibold text-muted-foreground">Vijayapura and KR Puram</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-xl font-black text-primary">{restaurant.deliveryTime}</p>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">Average delivery time</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
