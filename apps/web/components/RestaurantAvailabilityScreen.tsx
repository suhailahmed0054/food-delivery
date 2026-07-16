import Image from "next/image";
import { Clock3, PhoneCall, PowerOff } from "lucide-react";
import type { RestaurantSettingsData } from "@/lib/api";

function compactPhone(phone: string) {
  return phone.replace(/\s+/g, "");
}

export function RestaurantStatusLoadingScreen() {
  return (
    <main className="flex min-h-screen items-center justify-center overflow-hidden bg-background px-6 text-foreground">
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center text-center"
      >
        <Image
          src="/images/logo-watermark.png"
          alt="Al-Arab Restaurant"
          width={96}
          height={96}
          priority
          className="h-24 w-auto animate-pulse object-contain drop-shadow-xl motion-reduce:animate-none"
        />
        <p className="mt-5 text-sm font-black uppercase tracking-[0.18em] text-primary">
          Checking restaurant status
        </p>
      </div>
    </main>
  );
}

export function RestaurantOfflineScreen({
  settings
}: {
  settings: RestaurantSettingsData;
}) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-10 text-foreground">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 -right-24 h-80 w-80 rounded-full bg-primary/10 blur-3xl"
      />

      <section
        role="status"
        aria-live="polite"
        className="relative w-full max-w-md overflow-hidden rounded-[32px] border border-primary/25 bg-card/95 p-7 text-center shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9"
      >
        <Image
          src="/images/logo-watermark.png"
          alt={settings.restaurantName}
          width={104}
          height={104}
          priority
          className="mx-auto h-24 w-auto object-contain drop-shadow-xl"
        />

        <div className="mx-auto mt-5 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black uppercase tracking-[0.14em] text-red-300">
          <PowerOff size={15} aria-hidden="true" />
          Currently offline
        </div>

        <h1 className="mt-6 font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl">
          Restaurant is not live
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm font-medium leading-6 text-muted-foreground">
          {settings.restaurantName} is not accepting customer orders right
          now. The menu will return automatically when the restaurant goes
          online.
        </p>

        <div className="mt-7 flex items-center gap-3 rounded-2xl border border-border bg-background/70 p-4 text-left">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Clock3 size={20} aria-hidden="true" />
          </span>
          <span>
            <span className="block text-[10px] font-black uppercase tracking-[0.15em] text-muted-foreground">
              Restaurant hours
            </span>
            <span className="mt-1 block text-sm font-black text-foreground">
              {settings.openingTime} – {settings.closingTime}
            </span>
          </span>
        </div>

        <a
          href={`tel:${compactPhone(settings.phone)}`}
          className="mt-4 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-[0.98]"
        >
          <PhoneCall size={18} aria-hidden="true" />
          Call restaurant
        </a>
      </section>
    </main>
  );
}
