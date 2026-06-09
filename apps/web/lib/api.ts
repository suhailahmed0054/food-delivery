import { menuItems } from "@/lib/data";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api";

export async function fetchMenu() {
  try {
    const response = await fetch(`${API_URL}/menu`, { next: { revalidate: 60 } });
    if (!response.ok) throw new Error("Menu API unavailable");
    const data = await response.json();
    if (!Array.isArray(data) || data.some((item) => !item.customization?.sizes || !item.customization?.addOns)) {
      return menuItems;
    }
    return data;
  } catch {
    return menuItems;
  }
}

export async function createCheckout(total: number) {
  const response = await fetch(`${API_URL}/payments/create-order`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount: total })
  });

  if (!response.ok) {
    return { id: "demo_order", amount: total * 100, currency: "INR", mode: "demo" };
  }

  return response.json();
}
