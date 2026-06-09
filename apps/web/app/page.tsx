"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Banknote,
  Clock3,
  CreditCard,
  Download,
  Heart,
  LocateFixed,
  MapPinned,
  Minus,
  Phone,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  Timer,
  Truck,
  UserCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchMenu, createCheckout } from "@/lib/api";
import { Category, MenuItem, categories, menuItems, orderTimeline, restaurant } from "@/lib/data";
import { CartCustomization, useCartStore } from "@/store/cart-store";

const paymentMethods = [
  { id: "razorpay", label: "Razorpay", icon: CreditCard },
  { id: "cod", label: "Cash on Delivery", icon: Banknote }
];

export default function Home() {
  const [category, setCategory] = useState<"All" | Category>("All");
  const [query, setQuery] = useState("");
  const [promo, setPromo] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("razorpay");
  const [deliveryTime, setDeliveryTime] = useState("ASAP");
  const [orderId, setOrderId] = useState("AR-1043");
  const [selectedOptions, setSelectedOptions] = useState<Record<string, CartCustomization>>({});
  const { data = menuItems } = useQuery<MenuItem[]>({ queryKey: ["menu"], queryFn: fetchMenu });
  const { items, addItem, removeItem, setQuantity, applyPromo, clearCart, discount } = useCartStore();

  const filteredMenu = data.filter((item) => {
    const matchesCategory = category === "All" || item.category === category;
    const search = query.trim().toLowerCase();
    const matchesSearch =
      !search || item.name.toLowerCase().includes(search) || item.category.toLowerCase().includes(search);
    return matchesCategory && matchesSearch;
  });

  const subtotal = useMemo(() => items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0), [items]);
  const discountAmount = Math.round(subtotal * discount);
  const tax = Math.round((subtotal - discountAmount) * restaurant.taxRate);
  const deliveryFee = subtotal >= restaurant.minimumOrder ? restaurant.deliveryFee : restaurant.deliveryFee + 30;
  const total = Math.max(0, subtotal - discountAmount + tax + (subtotal > 0 ? deliveryFee : 0));

  function optionsFor(item: MenuItem): CartCustomization {
    return (
      selectedOptions[item.id] ?? {
        size: item.customization.sizes[0]?.name ?? "Regular",
        spiceLevel: item.customization.spiceLevels[0] ?? "Regular",
        addOns: []
      }
    );
  }

  function updateOptions(item: MenuItem, changes: Partial<CartCustomization>) {
    setSelectedOptions((current) => ({ ...current, [item.id]: { ...optionsFor(item), ...changes } }));
  }

  async function placeOrder() {
    if (!total) return;
    if (paymentMethod === "razorpay") {
      await createCheckout(total);
    }
    const nextId = `AR-${Math.floor(1000 + Math.random() * 9000)}`;
    setOrderId(nextId);
    clearCart();
    alert(`Order confirmed. Your order ID is ${nextId}.`);
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="relative min-h-[88vh] overflow-hidden bg-[#152018] text-white">
        <Image src="/images/al-arab-hero.png" alt="Al-Arab Restaurant food spread" fill priority className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/86 via-black/48 to-black/18" />
        <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-2xl font-black leading-none">Al-Arab Restaurant</p>
            <p className="mt-1 text-xs uppercase tracking-[0.22em] text-white/72">Single restaurant delivery</p>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-semibold text-white/82 lg:flex">
            <a href="#menu">Menu</a>
            <a href="#checkout">Checkout</a>
            <a href="#tracking">Track</a>
            <a href="#account">Account</a>
          </nav>
          <Button asChild variant="secondary">
            <a href="#checkout">
              <ShoppingCart size={18} />
              {items.length}
            </a>
          </Button>
        </header>

        <div className="relative z-10 mx-auto flex min-h-[70vh] w-full max-w-7xl items-center px-4 pb-12 sm:px-6">
          <div className="max-w-3xl">
            <div className="mb-5 flex flex-wrap gap-3">
              <span className="rounded-md bg-white/14 px-3 py-2 text-sm font-bold backdrop-blur">
                <Star size={15} className="mr-1 inline" fill="currentColor" /> {restaurant.rating} ({restaurant.reviews}+)
              </span>
              <span className="rounded-md bg-white/14 px-3 py-2 text-sm font-bold backdrop-blur">
                <Clock3 size={15} className="mr-1 inline" /> {restaurant.deliveryTime}
              </span>
              <span className="rounded-md bg-white/14 px-3 py-2 text-sm font-bold backdrop-blur">
                Delivery fee Rs {restaurant.deliveryFee}
              </span>
            </div>
            <h1 className="text-5xl font-black leading-[1.04] sm:text-6xl lg:text-7xl">{restaurant.name}</h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-white/84">
              Fresh mandi, grills, shawarma, desserts and beverages with real-time tracking, secure checkout and a mobile-first ordering experience.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="secondary">
                <a href="#menu">
                  <Search size={18} />
                  Start order
                </a>
              </Button>
              <Button asChild variant="outline" className="border-white/40 bg-white/10 text-white hover:bg-white/18">
                <a href="#tracking">
                  <Truck size={18} />
                  Track order
                </a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="menu" className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="font-bold text-secondary">Customer view</p>
              <h2 className="text-3xl font-black">Menu</h2>
            </div>
            <div className="relative w-full lg:w-[380px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search food or category"
                className="h-12 w-full rounded-md border border-border bg-white pl-10 pr-4 outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>

          <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
            {(["All", ...categories] as Array<"All" | Category>).map((item) => (
              <Button key={item} variant={category === item ? "default" : "outline"} size="sm" onClick={() => setCategory(item)}>
                {item}
              </Button>
            ))}
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {filteredMenu.map((item) => {
              const options = optionsFor(item);
              return (
                <Card key={item.id} className="overflow-hidden">
                  <div className="relative aspect-[4/3]">
                    <Image src={item.image} alt={item.name} fill className="object-cover" />
                    <span className={`absolute right-3 top-3 rounded-md px-2 py-1 text-xs font-black ${item.available ? "bg-white text-primary" : "bg-black/70 text-white"}`}>
                      {item.available ? "Available" : "Out of stock"}
                    </span>
                  </div>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <CardTitle>{item.name}</CardTitle>
                      <button aria-label={`Save ${item.name}`} className="rounded-md border border-border p-2 text-primary">
                        <Heart size={17} />
                      </button>
                    </div>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3 flex items-center justify-between text-sm">
                      <span className="font-black">Rs {item.price}</span>
                      <span className="flex items-center gap-1 font-semibold">
                        <Star size={14} fill="currentColor" className="text-accent" /> {item.rating} ({item.reviews})
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <select
                        value={options.size}
                        onChange={(event) => updateOptions(item, { size: event.target.value })}
                        className="h-10 rounded-md border border-border bg-white px-3"
                      >
                        {item.customization.sizes.map((size) => (
                          <option key={size.name} value={size.name}>
                            {size.name} {size.priceDelta ? `+ Rs ${size.priceDelta}` : ""}
                          </option>
                        ))}
                      </select>
                      <select
                        value={options.spiceLevel}
                        onChange={(event) => updateOptions(item, { spiceLevel: event.target.value })}
                        className="h-10 rounded-md border border-border bg-white px-3"
                      >
                        {item.customization.spiceLevels.map((level) => (
                          <option key={level}>{level}</option>
                        ))}
                      </select>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.customization.addOns.map((addOn) => {
                        const checked = options.addOns.includes(addOn.name);
                        return (
                          <label key={addOn.name} className="flex cursor-pointer items-center gap-2 rounded-md border border-border px-2 py-1 text-xs">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                updateOptions(item, {
                                  addOns: checked ? options.addOns.filter((name) => name !== addOn.name) : [...options.addOns, addOn.name]
                                });
                              }}
                            />
                            {addOn.name} {addOn.price ? `+Rs ${addOn.price}` : ""}
                          </label>
                        );
                      })}
                    </div>
                    <Button className="mt-4 w-full" disabled={!item.available} onClick={() => addItem(item, options)}>
                      <Plus size={17} />
                      Add to cart
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="checkout" className="bg-[#f4f6ef] px-4 py-12 sm:px-6">
        <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPinned size={20} />
                  Delivery details
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4">
                <input className="h-12 rounded-md border border-border px-4" placeholder="Full name" />
                <input className="h-12 rounded-md border border-border px-4" placeholder="Phone number" />
                <div className="grid gap-3 md:grid-cols-[1fr_auto]">
                  <input className="h-12 rounded-md border border-border px-4" placeholder="Delivery address" />
                  <Button variant="outline">
                    <LocateFixed size={18} />
                    Map pin
                  </Button>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <select value={deliveryTime} onChange={(event) => setDeliveryTime(event.target.value)} className="h-12 rounded-md border border-border px-4">
                    <option>ASAP</option>
                    <option>Today 7:30 PM</option>
                    <option>Today 8:30 PM</option>
                    <option>Tomorrow 1:00 PM</option>
                  </select>
                  <textarea className="min-h-24 rounded-md border border-border p-4" placeholder="Special instructions for kitchen or rider" />
                </div>
                <div className="rounded-md border border-border bg-white p-4">
                  <p className="mb-3 font-bold">Payment method</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {paymentMethods.map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setPaymentMethod(method.id)}
                        className={`flex h-12 items-center justify-center gap-2 rounded-md border font-bold ${paymentMethod === method.id ? "border-primary bg-primary text-white" : "border-border bg-white"}`}
                      >
                        <method.icon size={18} />
                        {method.label}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck size={20} />
                  Account
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                {["Email / phone login", "Saved addresses", "Order history and reorder"].map((item) => (
                  <div key={item} className="rounded-md border border-border p-4 text-sm font-semibold">
                    <UserCircle className="mb-3 text-primary" size={22} />
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart size={20} />
                Cart summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {items.length === 0 ? (
                  <p className="rounded-md bg-muted p-4 text-sm text-muted-foreground">Add items to begin checkout.</p>
                ) : (
                  items.map((line) => (
                    <div key={line.lineId} className="border-b border-border pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold">{line.item.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {line.customization.size}, {line.customization.spiceLevel}
                            {line.customization.addOns.length ? `, ${line.customization.addOns.join(", ")}` : ""}
                          </p>
                          <p className="mt-1 text-sm font-semibold">Rs {line.unitPrice}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="icon" variant="outline" onClick={() => setQuantity(line.lineId, line.quantity - 1)}>
                            <Minus size={15} />
                          </Button>
                          <span className="w-5 text-center font-bold">{line.quantity}</span>
                          <Button size="icon" variant="outline" onClick={() => setQuantity(line.lineId, line.quantity + 1)}>
                            <Plus size={15} />
                          </Button>
                        </div>
                      </div>
                      <button className="mt-2 text-sm font-bold text-secondary" onClick={() => removeItem(line.lineId)}>
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>

              <div className="mt-5 flex gap-2">
                <input value={promo} onChange={(event) => setPromo(event.target.value)} className="h-11 min-w-0 flex-1 rounded-md border border-border px-3" placeholder="Promo code" />
                <Button variant="outline" onClick={() => applyPromo(promo)}>
                  Apply
                </Button>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Try ALARAB10 for 10% off.</p>

              <div className="mt-5 space-y-2 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>Rs {subtotal}</span></div>
                <div className="flex justify-between"><span>Discount</span><span>- Rs {discountAmount}</span></div>
                <div className="flex justify-between"><span>GST 5%</span><span>Rs {tax}</span></div>
                <div className="flex justify-between"><span>Delivery fee</span><span>Rs {subtotal ? deliveryFee : 0}</span></div>
                <div className="flex justify-between border-t border-border pt-3 text-lg font-black"><span>Total</span><span>Rs {total}</span></div>
              </div>

              <Button className="mt-5 w-full" disabled={!total} onClick={placeOrder}>
                <Receipt size={18} />
                Confirm order
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      <section id="tracking" className="px-4 py-12 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="font-bold text-secondary">Order confirmation</p>
              <h2 className="text-3xl font-black">Track order {orderId}</h2>
            </div>
            <Button variant="outline">
              <Download size={18} />
              Download receipt
            </Button>
          </div>
          <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardContent className="pt-5">
                <div className="grid gap-4 md:grid-cols-5">
                  {orderTimeline.map((step, index) => (
                    <div key={step} className="rounded-md border border-border p-4">
                      <div className={`mb-4 h-2 rounded-full ${index < 3 ? "bg-primary" : "bg-muted"}`} />
                      <p className="text-sm font-black">{step} {index < 2 ? "✓" : ""}</p>
                      <p className="mt-2 text-xs text-muted-foreground">{index < 3 ? "Updated live" : "Waiting"}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="rounded-md bg-[#1b2a24] p-5 text-white">
                    <MapPinned className="mb-4 text-accent" />
                    <p className="font-black">Live delivery map</p>
                    <p className="mt-2 text-sm text-white/72">Map provider placeholder for rider and restaurant locations.</p>
                  </div>
                  <div className="rounded-md border border-border p-5">
                    <Timer className="mb-4 text-primary" />
                    <p className="font-black">Estimated arrival</p>
                    <p className="mt-2 text-3xl font-black">22 min</p>
                    <Button className="mt-4" variant="outline">
                      <Phone size={18} />
                      Contact agent
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>After delivery</CardTitle>
              </CardHeader>
              <CardContent>
                <textarea className="min-h-28 w-full rounded-md border border-border p-3" placeholder="Rate and review your order" />
                <Button className="mt-3 w-full" variant="secondary">
                  <Star size={18} />
                  Submit review
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </main>
  );
}
