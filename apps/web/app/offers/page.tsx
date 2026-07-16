"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft, Tag, Copy, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

const coupons = [
  { code: "ALARAB10", discount: "10% OFF", desc: "Valid on all orders above ₹500.", color: "yellow" },
  { code: "FREEDEL", discount: "FREE DELIVERY", desc: "Valid on orders above ₹999.", color: "blue" },
  { code: "WELCOME50", discount: "₹50 OFF", desc: "Valid for your first order only.", color: "green" },
];

export default function OffersPage() {
  const router = useRouter();
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!copiedCode) return;
    const timeout = window.setTimeout(() => setCopiedCode(null), 2000);
    return () => window.clearTimeout(timeout);
  }, [copiedCode]);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
    } catch {
      window.prompt("Copy this coupon code:", code);
    }
  };

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/90 px-4 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="rounded-md bg-[#111111] p-2 hover:bg-white/5 transition">
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-xl font-black">Offers & Coupons</h1>
        </div>
      </header>

      <div className="p-4 space-y-4">
        {coupons.map((coupon) => (
          <div key={coupon.code} className="relative overflow-hidden rounded-2xl bg-[#111111] border border-white/10 p-5 flex items-center justify-between">
            {/* Left dashed edge effect */}
            <div className="absolute left-0 top-0 bottom-0 w-2 border-r-2 border-dashed border-[#080808]"></div>

            <div className="pl-4">
              <div className="flex items-center gap-2 mb-1">
                <Tag size={16} className={coupon.color === 'yellow' ? 'text-yellow-500' : coupon.color === 'blue' ? 'text-blue-500' : 'text-green-500'} />
                <h3 className="text-lg font-black">{coupon.discount}</h3>
              </div>
              <p className="text-xs text-white/50 mt-1 max-w-[180px]">{coupon.desc}</p>
              <div className="mt-3 inline-block rounded border border-white/20 bg-black px-3 py-1 text-sm font-bold tracking-widest text-white/80">
                {coupon.code}
              </div>
            </div>

            <button
              onClick={() => void handleCopy(coupon.code)}
              className="editorial-copy-button flex flex-col items-center gap-1 rounded-full px-3 py-2 text-[#D84315] transition hover:bg-[#D84315]/10 hover:text-[#3E2723]"
            >
              {copiedCode === coupon.code ? <CheckCircle2 size={24} className="text-green-500" /> : <Copy size={24} />}
              <span className="text-[10px] font-bold">{copiedCode === coupon.code ? "COPIED" : "COPY"}</span>
            </button>
          </div>
        ))}
      </div>
    </main>
  );
}
