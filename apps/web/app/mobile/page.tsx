"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import LiquidGlass from "@/components/LiquidGlass";
import { useCartStore, getUpsellRecommendation } from "@/store/cart-store";
import {
  fetchCustomerAccount,
  fetchMenu,
  fetchMenuItemReviews,
  fetchPublicRestaurantSettings,
  getApiSocketUrl,
  type CustomerReview
} from "@/lib/api";
import { restaurant, type MenuItem } from "@/lib/data";
import {
  clearTableSession,
  getCheckoutPath,
  readStoredTableSession,
  type TableSession
} from "@/lib/table-session";
import { TableSessionTracker } from "@/components/TableSessionTracker";
import { DineInScanner } from "@/components/DineInScanner";
import { NotificationCenter } from "@/components/NotificationCenter";
import { MenuSearchOverlay } from "@/components/MenuSearchOverlay";
import {
  RestaurantOfflineScreen,
  RestaurantStatusLoadingScreen
} from "@/components/RestaurantAvailabilityScreen";
import { useWishlistStore } from "@/store/wishlist-store";
import { useCustomer3DReveal } from "@/lib/use-customer-3d-reveal";
import { useRouter } from "next/navigation";
import { getCheckoutLoginPath } from "@/lib/auth-navigation";
import {
  Menu,
  ShoppingCart,
  Search,
  Home,
  User,
  Heart,
  X,
  MapPin,
  Package,
  Tag,
  Minus,
  Plus,
  Flame,
  ChevronRight,
  CheckCircle2,
  CircleHelp,
  FileText,
  HeadphonesIcon,
  Info,
  PhoneCall,
  ShieldCheck,
  Bike,
  QrCode,
  Star
} from "lucide-react";

function GlassBadge({
  variant = "primary",
  children,
}: {
  variant?: "primary" | "danger";
  children: ReactNode;
}) {
  const variantClassName =
    variant === "danger"
      ? "border-red-500/20 bg-red-500/15 text-red-300"
      : "border-primary/30 bg-primary/15 text-primary";

  return (
    <span
      className={`liquid-badge inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] ${variantClassName}`}
    >
      {children}
    </span>
  );
}

// ═══════════════════════════════════════════════════════════════
//  iOS 26 LIQUID GLASS — 3D PARALLAX TILT ENGINE
// ═══════════════════════════════════════════════════════════════
function TiltCard({
  children,
  className = "",
  style,
  intensity = 10,
  ...props
}: React.HTMLAttributes<HTMLElement> & { intensity?: number }) {
  const [transform, setTransform] = useState(
    "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)"
  );
  const [glowPos, setGlowPos] = useState({ x: 50, y: 50 });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotateX = ((y - centerY) / centerY) * -intensity;
    const rotateY = ((x - centerX) / centerX) * intensity;

    setTransform(
      `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.02, 1.02, 1.02)`
    );
    setGlowPos({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
    });
  };

  const handleMouseLeave = () => {
    setTransform(
      "perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)"
    );
    setGlowPos({ x: 50, y: 50 });
  };

  return (
    <article
      className={`group relative transition-transform duration-300 ease-out will-change-transform ${className}`}
      style={{
        transform,
        transformStyle: "preserve-3d",
        ...style,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {/* Dynamic specular highlight that follows cursor */}
      <div
        className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-50"
        style={{
          background: `radial-gradient(circle at ${glowPos.x}% ${glowPos.y}%, rgba(255,255,255,0.12) 0%, transparent 60%)`,
          transform: "translateZ(1px)"
        }}
      />
      <div className="relative" style={{ transformStyle: "preserve-3d" }}>
        {children}
      </div>
    </article>
  );
}

// ═══════════════════════════════════════════════════════════════
//  iOS SPRING ANIMATION HOOK
// ═══════════════════════════════════════════════════════════════
function useAnimatedNumber(targetValue: number, durationMs = 450) {
  const [current, setCurrent] = useState(targetValue);
  const currentRef = useRef(targetValue);
  const rafRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      currentRef.current = targetValue;
      setCurrent(targetValue);
      return;
    }

    const startValue = currentRef.current;
    const difference = targetValue - startValue;
    const startedAt = performance.now();

    const animate = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / durationMs);
      const easedProgress = 1 - Math.pow(1 - progress, 3);
      const nextValue = startValue + difference * easedProgress;

      currentRef.current = nextValue;
      setCurrent(nextValue);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        currentRef.current = targetValue;
        setCurrent(targetValue);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, [durationMs, targetValue]);

  return current;
}

// ═══════════════════════════════════════════════════════════════
//  iOS HAPTIC FEEDBACK
// ═══════════════════════════════════════════════════════════════
function triggerHaptic(type: "light" | "medium" | "heavy" | "success") {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    const patterns = {
      light: [10],
      medium: [20],
      heavy: [30],
      success: [10, 50, 20],
    };
    navigator.vibrate(patterns[type]);
  }
}

// ═══════════════════════════════════════════════════════════════
//  TYPES & HELPERS
// ═══════════════════════════════════════════════════════════════
type SizeOption = { name: string; priceDelta: number };
type CustomerSummary = { name: string; email: string; phone?: string };

const profileLinks = [
  { label: "Track Order", href: "/orders/track", icon: MapPin },
  { label: "My Orders", href: "/orders", icon: Package },
  { label: "Saved Addresses", href: "/profile", icon: Home },
  { label: "Offers & Coupons", href: "/offers", icon: Tag },
];

const supportLinks = [
  { label: "Support & Help", href: "/support", icon: HeadphonesIcon },
  { label: "FAQs", href: "/faqs", icon: CircleHelp },
  { label: "About Al-Arab", href: "/about", icon: Info },
  { label: "Terms & Conditions", href: "/terms", icon: FileText },
  { label: "Privacy Policy", href: "/privacy", icon: ShieldCheck },
];

function compactPhone(phone: string) {
  return phone.replace(/\s+/g, "");
}

function normalizeSearchValue(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word))
    .join(" ");
}

function matchesMenuSearch(item: MenuItem, searchTerm: string) {
  const searchTokens = normalizeSearchValue(searchTerm).split(" ").filter(Boolean);
  if (searchTokens.length === 0) return true;
  const searchableText = normalizeSearchValue(
    [
      item.name,
      item.category,
      item.description,
      ...(item.ingredients ?? []),
      ...(item.allergens ?? []),
      ...(item.customization?.addOns ?? []).map((addOn) => addOn.name),
    ].join(" ")
  );
  return searchTokens.every((token) => searchableText.includes(token));
}

function getSizeOptions(item: MenuItem): SizeOption[] {
  const sizes = (item.customization?.sizes ?? []) as Array<string | SizeOption>;
  const options = sizes
    .map((size) => {
      if (typeof size === "string") return { name: size, priceDelta: 0 };
      return { name: size.name, priceDelta: Number(size.priceDelta) || 0 };
    })
    .filter((size) => size.name);
  return options.length > 0 ? options : [{ name: "Regular", priceDelta: 0 }];
}

function getSizePrice(item: MenuItem, size: SizeOption) {
  return item.price + size.priceDelta;
}

function getDefaultSpiceLevel(item: MenuItem) {
  return item.customization?.spiceLevels?.[0] ?? "Regular";
}

// ═══════════════════════════════════════════════════════════════
//  iOS LIQUID GLASS TOAST
// ═══════════════════════════════════════════════════════════════
function GlassToast({
  message,
  onDone,
}: {
  message: string;
  onDone: () => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const t = setTimeout(() => {
      setVisible(false);
      setTimeout(onDone, 300);
    }, 2200);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <div
      className={`fixed top-24 left-1/2 z-[300] -translate-x-1/2 transition-all duration-300 ${
        visible
          ? "opacity-100 translate-y-0"
          : "opacity-0 -translate-y-4 pointer-events-none"
      }`}
    >
      <div className="rounded-full border border-white/20 bg-black/80 backdrop-blur-xl px-5 py-2.5 shadow-2xl flex items-center gap-2.5">
        <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
        <span className="text-sm font-bold text-white whitespace-nowrap">{message}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function MobileHome() {
  const queryClient = useQueryClient();
  const { items, addItem, removeItem, setQuantity } = useCartStore();
  const { items: wishlistItems, addToWishlist, removeFromWishlist } = useWishlistStore();
  const {
    data: restaurantSettings,
    isLoading: isRestaurantSettingsLoading,
    isError: isRestaurantSettingsError,
  } = useQuery({
    queryKey: ["restaurant-settings", "public"],
    queryFn: fetchPublicRestaurantSettings,
    refetchInterval: 5000,
    refetchOnWindowFocus: "always",
    staleTime: 2000,
  });
  const { data = [], isLoading } = useQuery<MenuItem[]>({
    queryKey: ["menu"],
    queryFn: fetchMenu,
    enabled:
      isRestaurantSettingsError || restaurantSettings?.restaurantOpen === true,
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: true,
  });

  const router = useRouter();
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [searchTerm, setSearchTerm] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [tableSession, setTableSession] = useState<TableSession | null>(null);
  const [tableError, setTableError] = useState("");
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [showDineInScanner, setShowDineInScanner] = useState(false);
  const [portionPickerItem, setPortionPickerItem] = useState<MenuItem | null>(null);
  const [cartNotice, setCartNotice] = useState<{ id: number; message: string } | null>(null);
  const [customerSummary, setCustomerSummary] = useState<CustomerSummary | null>(null);
  const [showCart, setShowCart] = useState(false);
  const [sidebarAnimating, setSidebarAnimating] = useState(false);
  const [reviewsItem, setReviewsItem] = useState<MenuItem | null>(null);
  const [menuReviews, setMenuReviews] = useState<CustomerReview[]>([]);
  const [isReviewsLoading, setIsReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState("");
  const [isCheckoutAuthLoading, setIsCheckoutAuthLoading] = useState(false);

  const profileDrawerRef = useRef<HTMLElement | null>(null);
  const profileMenuButtonRef = useRef<HTMLButtonElement | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = io(getApiSocketUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: true
    });
    const refreshMenu = () => {
      void queryClient.invalidateQueries({ queryKey: ["menu"] });
    };
    socket.on("menu:updated", refreshMenu);
    return () => {
      socket.off("menu:updated", refreshMenu);
      socket.disconnect();
    };
  }, [queryClient]);

  // Animated cart total
  const rawTotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const animatedTotal = useAnimatedNumber(rawTotal);

  const proceedToCheckout = async () => {
    if (isCheckoutAuthLoading) return;

    const checkoutPath = getCheckoutPath();
    triggerHaptic("heavy");
    setIsCheckoutAuthLoading(true);
    try {
      await fetchCustomerAccount();
      router.push(checkoutPath);
    } catch {
      router.push(getCheckoutLoginPath(checkoutPath));
    } finally {
      setIsCheckoutAuthLoading(false);
    }
  };

  const openDishReviews = async (item: MenuItem) => {
    setReviewsItem(item);
    setMenuReviews([]);
    setReviewsError("");
    setIsReviewsLoading(true);
    try {
      setMenuReviews(await fetchMenuItemReviews(item.id));
    } catch (error) {
      setReviewsError(
        error instanceof Error ? error.message : "Unable to load reviews"
      );
    } finally {
      setIsReviewsLoading(false);
    }
  };

  // ── Load customer & table session ──
  useEffect(() => {
    setTableSession(readStoredTableSession());
    try {
      const storedUser = window.localStorage.getItem("al-arab-user");
      const parsed = storedUser
        ? (JSON.parse(storedUser) as {
            name?: unknown;
            email?: unknown;
            role?: unknown;
          })
        : null;
      if (
        parsed?.role === "customer" &&
        typeof parsed.name === "string" &&
        typeof parsed.email === "string"
      ) {
        setCustomerSummary({ name: parsed.name, email: parsed.email });
      }
    } catch {
      // ignore malformed legacy session
    }

    void fetchCustomerAccount()
      .then((account) => {
        setCustomerSummary({
          name: account.name,
          email: account.email,
          phone: account.phone,
        });
      })
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!showSearch) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowSearch(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showSearch]);

  // ── URL params ──
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get("cart") === "1") {
      setShowCart(true);
    }
    const reorderedQuantity = Number.parseInt(searchParams.get("reordered") ?? "", 10);
    const unavailableQuantity = Number.parseInt(searchParams.get("unavailable") ?? "0", 10);
    if (Number.isInteger(reorderedQuantity) && reorderedQuantity > 0) {
      const unavailableMessage =
        Number.isInteger(unavailableQuantity) && unavailableQuantity > 0
          ? ` ${unavailableQuantity} unavailable item${unavailableQuantity === 1 ? " was" : "s were"} skipped.`
          : "";
      setCartNotice({
        id: Date.now(),
        message: `${reorderedQuantity} item${reorderedQuantity === 1 ? "" : "s"} added from your previous order.${unavailableMessage}`,
      });
    }
  }, []);

  // ── Sidebar animation & focus trap ──
  useEffect(() => {
    if (showSidebar) {
      setSidebarAnimating(true);
      document.body.style.overflow = "hidden";
    } else {
      const t = setTimeout(() => setSidebarAnimating(false), 350);
      document.body.style.overflow = "";
      return () => clearTimeout(t);
    }
  }, [showSidebar]);

  useEffect(() => {
    if (!showSidebar) return;
    const previousBodyOverflow = document.body.style.overflow;
    const profileMenuButton = profileMenuButtonRef.current;
    const focusFrame = window.requestAnimationFrame(() => {
      profileDrawerRef.current
        ?.querySelector<HTMLElement>("button, a[href]")
        ?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setShowSidebar(false);
        return;
      }
      if (event.key !== "Tab" || !profileDrawerRef.current) return;
      const focusableElements = Array.from(
        profileDrawerRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled])"
        )
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements.at(-1);
      if (!firstElement || !lastElement) return;
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      profileMenuButton?.focus();
    };
  }, [showSidebar]);

  // ── Handlers ──
  const closeDineInScanner = useCallback(() => {
    setShowDineInScanner(false);
  }, []);

  const handleTableResolved = useCallback((session: TableSession) => {
    setTableSession(session);
    setTableError("");
  }, []);

  const switchToDelivery = useCallback(() => {
    clearTableSession();
    setTableSession(null);
    setTableError("");
    setShowDineInScanner(false);
  }, []);

  const addItemWithSize = (item: MenuItem, sizeName: string) => {
    addItem(item, { size: sizeName, spiceLevel: getDefaultSpiceLevel(item), addOns: [] });
    setCartNotice({
      id: Date.now(),
      message: `${item.name} · ${sizeName} added to cart`,
    });
    triggerHaptic("light");
  };

  const handleAddItem = (item: MenuItem) => {
    const sizeOptions = getSizeOptions(item);
    if (sizeOptions.length > 1) {
      setPortionPickerItem(item);
      return;
    }
    addItemWithSize(item, sizeOptions[0].name);
  };

  const handleCopyCoupon = async () => {
    const code = "ALARAB10";
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(code);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = code;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        const copied = document.execCommand("copy");
        textArea.remove();
        if (!copied) throw new Error("Copy command was rejected");
      }
      setCartNotice({ id: Date.now(), message: "Coupon ALARAB10 copied!" });
      triggerHaptic("success");
    } catch {
      setCartNotice({ id: Date.now(), message: "Copy blocked. Type ALARAB10 manually." });
    }
  };

  const visibleItems = data.filter(
    (item) =>
      (selectedCategory === "All" || item.category === selectedCategory) &&
      matchesMenuSearch(item, searchTerm)
  );
  const searchResults = data.filter((item) => matchesMenuSearch(item, searchTerm));
  const popularSearchItems = [...data]
    .sort((first, second) => {
      if (Boolean(first.bestSeller) !== Boolean(second.bestSeller)) {
        return first.bestSeller ? -1 : 1;
      }
      return (second.rating ?? 0) - (first.rating ?? 0);
    })
    .slice(0, 5);

  const openSearchResult = (item: MenuItem) => {
    setSelectedCategory("All");
    if (!searchTerm.trim()) setSearchTerm(item.name);
    setShowSearch(false);
    window.requestAnimationFrame(() => {
      document.getElementById(`menu-item-${item.id}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center"
      });
    });
  };


  useCustomer3DReveal(visibleItems.map((item) => item.id).join("|"));

  if (isRestaurantSettingsLoading && !isRestaurantSettingsError) {
    return <RestaurantStatusLoadingScreen />;
  }

  if (restaurantSettings && !restaurantSettings.restaurantOpen) {
    return <RestaurantOfflineScreen settings={restaurantSettings} />;
  }

  return (
    <main className="mobile-liquid-page customer-3d-page min-h-screen w-full max-w-full overflow-x-hidden bg-[#050505] text-foreground selection:bg-primary/30 pb-safe">
      <Suspense fallback={null}>
        <TableSessionTracker
          onTableChange={setTableSession}
          onError={setTableError}
          onLoadingChange={setIsTableLoading}
        />
      </Suspense>

      <DineInScanner
        open={showDineInScanner}
        onClose={closeDineInScanner}
        onTableResolved={handleTableResolved}
      />

      {/* ═══════════════════════════════════════════════
          iOS LIQUID GLASS — PROFILE DRAWER
          ═══════════════════════════════════════════════ */}
      {(showSidebar || sidebarAnimating) && (
        <div
          aria-hidden={!showSidebar}
          inert={!showSidebar}
          className={`fixed inset-0 z-[200] transition-all duration-500 ${
            showSidebar
              ? "opacity-100 pointer-events-auto"
              : "opacity-0 pointer-events-none"
          }`}
          style={{
            transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          {/* Backdrop with liquid glass blur */}
          <button
            type="button"
            aria-label="Close profile menu"
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-xl transition-opacity duration-500"
            style={{
              transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
            }}
            onClick={() => setShowSidebar(false)}
          />

          <aside
            ref={profileDrawerRef}
            id="mobile-profile-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-profile-title"
            aria-describedby="mobile-profile-subtitle"
            className={`liquid-bottom-sheet absolute inset-y-0 left-0 flex h-[100dvh] w-[calc(100%-0.75rem)] max-w-[440px] transform flex-col overflow-hidden rounded-r-[2.5rem] border-r border-white/10 bg-[#0a0a0a]/80 backdrop-blur-3xl shadow-[20px_0_40px_rgba(0,0,0,0.5)] transition-transform duration-500 ${
              showSidebar ? "translate-x-0" : "-translate-x-full"
            }`}
            style={{
              transitionTimingFunction: "cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            {/* Ambient glow */}
            <div className="absolute -top-20 -left-20 w-[400px] h-[400px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            {/* Header */}
            <header className="relative shrink-0 overflow-hidden border-b border-white/[0.06] px-6 pb-5 pt-[calc(1.25rem+env(safe-area-inset-top))] z-10">
              <div className="relative flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.25em] text-primary">
                    Account
                  </p>
                  <h2
                    id="mobile-profile-title"
                    className="mt-1 text-[1.75rem] font-bold leading-none text-white drop-shadow-md"
                  >
                    My Profile
                  </h2>
                  <p
                    id="mobile-profile-subtitle"
                    className="mt-2 text-[11px] font-semibold text-white/40"
                  >
                    Your Al-Arab customer services
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSidebar(false)}
                  aria-label="Close profile menu"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/70 hover:bg-white/10 hover:text-white transition active:scale-95"
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Customer Summary Card */}
            <section
              aria-label="Customer summary"
              className="shrink-0 border-b border-white/[0.06] px-5 py-5 z-10"
            >
              <Link
                href={customerSummary ? "/profile" : "/login"}
                onClick={() => setShowSidebar(false)}
                aria-label={
                  customerSummary
                    ? `View profile for ${customerSummary.name}`
                    : "Sign in to your customer account"
                }
                className="group block transition active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <div className="liquid-panel flex min-h-[76px] items-center gap-4 rounded-[1.25rem] p-3.5 bg-white/[0.03] border border-white/10 backdrop-blur-md shadow-lg group-hover:bg-white/[0.06] group-hover:border-primary/30 transition-all duration-300">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary shadow-inner">
                    <User size={22} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white sm:text-base">
                      {customerSummary?.name ?? "Guest customer"}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] font-semibold text-white/50">
                      {customerSummary?.phone ||
                        customerSummary?.email ||
                        "Sign in to save addresses & orders"}
                    </p>
                  </div>
                  <span className="profile-summary-cta rounded-full px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wide shadow-md transition">
                    {customerSummary ? "Open profile" : "Sign in"}
                  </span>
                </div>
              </Link>
            </section>

            {/* Navigation */}
            <nav
              aria-label="Profile and support"
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 scrollbar-none z-10"
            >
              <p className="mb-4 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                Quick access
              </p>
              <div className="grid grid-cols-1 gap-2.5 min-[380px]:grid-cols-2">
                {profileLinks.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setShowSidebar(false)}
                    className="liquid-control group flex min-h-[64px] items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 text-white/80 transition-all hover:bg-white/[0.06] hover:border-white/10 hover:text-white"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-black/40 text-primary transition group-hover:bg-primary/10 group-hover:border-primary/30">
                      <item.icon size={17} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 text-xs font-bold leading-tight">
                      {item.label}
                    </span>
                    <ChevronRight
                      size={14}
                      aria-hidden="true"
                      className="shrink-0 text-white/25 transition group-hover:translate-x-0.5 group-hover:text-primary"
                    />
                  </Link>
                ))}
              </div>

              <div className="mt-8 border-t border-white/[0.06] pt-6">
                <p className="mb-4 px-1 text-[10px] font-black uppercase tracking-[0.2em] text-white/30">
                  Help & information
                </p>
                <div className="grid grid-cols-1 gap-0.5">
                  {supportLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setShowSidebar(false)}
                      className="liquid-control group flex items-center gap-3 rounded-xl border border-transparent px-3 py-3.5 text-white/60 transition hover:bg-white/[0.03] hover:text-white active:scale-[0.98]"
                    >
                      <span className="flex items-center justify-center text-white/30 transition group-hover:text-primary">
                        <item.icon size={17} aria-hidden="true" />
                      </span>
                      <span className="text-xs font-semibold leading-tight">
                        {item.label}
                      </span>
                      <ChevronRight
                        size={12}
                        className="ml-auto shrink-0 text-white/20 opacity-0 transition group-hover:opacity-100 group-hover:text-white/40"
                      />
                    </Link>
                  ))}
                </div>
              </div>
            </nav>

            {/* Footer */}
            <footer className="shrink-0 border-t border-white/[0.06] bg-black/40 px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur-2xl z-10">
              <a
                href={`tel:${compactPhone(restaurant.phone)}`}
                className="mb-5 block active:scale-[0.98] transition group"
              >
                <div className="profile-help-call liquid-control flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 transition-all duration-300">
                  <span className="profile-help-call-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                    <PhoneCall size={17} aria-hidden="true" fill="currentColor" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="profile-help-call-label block text-[10px] font-bold uppercase tracking-wider">
                      Help line
                    </span>
                    <span className="profile-help-call-number block truncate text-[13px] font-black">
                      Call {restaurant.phone}
                    </span>
                  </span>
                  <span className="profile-help-call-action rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-wide">
                    Tap
                  </span>
                </div>
              </a>

              <div className="flex items-center justify-between gap-3 px-2">
                <div className="flex items-center gap-2.5">
                  <Image
                    src="/images/logo-watermark.png"
                    alt=""
                    width={32}
                    height={32}
                    className="h-7 w-auto object-contain opacity-70"
                  />
                  <div>
                    <p className="font-logo text-[10px] font-black tracking-[0.2em] text-white">
                      AL-ARAB
                    </p>
                    <p className="text-[7px] font-black uppercase tracking-[0.18em] text-white/30">
                      Restaurant
                    </p>
                  </div>
                </div>
                <p className="text-[9px] font-bold text-white/25 uppercase tracking-widest">
                  Premium dining
                </p>
              </div>
            </footer>
          </aside>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          iOS LIQUID GLASS — STICKY HEADER
          ═══════════════════════════════════════════════ */}
      <header className="liquid-mobile-header sticky top-0 z-40 w-full border-b border-white/5 bg-black/50 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/40">
        <div className="mobile-header-inner grid w-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-1 px-3 pb-2 pt-[calc(0.5rem+env(safe-area-inset-top))] min-[390px]:gap-2 min-[390px]:px-4">
          <div className="flex min-w-0 justify-start">
            <button
              ref={profileMenuButtonRef}
              type="button"
              aria-label="Open profile menu"
              aria-controls="mobile-profile-drawer"
              aria-expanded={showSidebar}
              onClick={() => setShowSidebar(true)}
              className="liquid-icon-button flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95"
            >
              <Menu size={22} strokeWidth={2.5} aria-hidden="true" />
            </button>
          </div>

          <div className="mobile-header-brand pointer-events-none flex min-w-0 flex-col items-center justify-center">
            <Image
              src="/images/logo-watermark.png"
              alt="Al-Arab"
              width={44}
              height={44}
              className="h-7 w-auto object-contain drop-shadow-lg min-[390px]:h-8"
            />
            <p className="mt-0.5 whitespace-nowrap font-logo text-[8px] font-bold leading-none tracking-[0.18em] text-primary min-[390px]:text-[9px]">
              AL-ARAB
            </p>
          </div>

          <div className="flex min-w-0 justify-end gap-0.5 min-[390px]:gap-1">
            <button
              type="button"
              aria-label="Search menu"
              aria-expanded={showSearch}
              onClick={() => setShowSearch(true)}
              className="liquid-icon-button relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95"
            >
              <Search size={19} strokeWidth={2.5} aria-hidden="true" />
              {searchTerm.trim() && (
                <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-[#D84315]" />
              )}
            </button>
            <NotificationCenter
              scope="customer"
              enabled={Boolean(customerSummary)}
              className="!h-9 !w-9 !shrink-0"
            />
            <button
              type="button"
              aria-label="Open cart"
              onClick={() => setShowCart(true)}
              className="liquid-icon-button relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:bg-white/10 hover:text-white active:scale-95"
            >
              <ShoppingCart size={22} strokeWidth={2.5} />
              {items.length > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#D84315] px-1 text-[9px] font-black text-[#fffaf5] shadow-lg shadow-[#D84315]/30">
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      {showSearch && (
        <MenuSearchOverlay
          searchTerm={searchTerm}
          results={searchResults}
          popularItems={popularSearchItems}
          onSearchTermChange={(value) => {
            setSearchTerm(value);
            if (value.trim()) setSelectedCategory("All");
          }}
          onClose={() => setShowSearch(false)}
          onSelect={openSearchResult}
        />
      )}

      {/* Table Status */}
      {(tableError || isTableLoading) && (
        <div
          role={tableError ? "alert" : "status"}
          aria-live="polite"
          className={`liquid-notice mx-5 mt-4 rounded-2xl border px-4 py-3.5 text-sm font-bold ${
            tableError
              ? "border-red-500/20 bg-red-500/10 text-red-300"
              : "border-primary/20 bg-primary/10 text-primary"
          }`}
        >
          {tableError || "Verifying your table QR code..."}
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          iOS SEGMENTED CONTROL — Order Type
          ═══════════════════════════════════════════════ */}
      {!isTableLoading && (
        <section aria-label="Choose order type" className="mx-3 mb-2 mt-3 min-[390px]:mx-4 min-[390px]:mt-4">
          <div className="liquid-segmented rounded-[18px] border border-white/10 bg-white/[0.03] backdrop-blur-md p-1 shadow-sm">
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                aria-pressed={!tableSession}
                onClick={switchToDelivery}
                className={`liquid-segment mobile-order-type-button flex min-h-[56px] min-w-0 items-center gap-2 rounded-[14px] px-2.5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-[390px]:gap-2.5 min-[390px]:px-3 ${
                  !tableSession
                    ? "border border-primary/30 bg-primary/20 backdrop-blur-xl text-primary shadow-[0_4px_16px_rgba(234,179,8,0.2)]"
                    : "border border-transparent text-white/50 hover:bg-white/[0.03] hover:text-white/70"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition min-[390px]:h-9 min-[390px]:w-9 ${
                    !tableSession
                      ? "bg-primary/20 text-primary"
                      : "bg-white/5 text-white/60"
                  }`}
                >
                  <Bike size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-nowrap text-[12px] font-black leading-none min-[390px]:text-[13px]">
                    Delivery
                  </span>
                  <span
                    className={`mt-1 block truncate text-[9px] font-bold leading-none ${
                      !tableSession ? "text-primary/70" : "text-white/30"
                    }`}
                  >
                    Order to your door
                  </span>
                </span>
              </button>

              <button
                type="button"
                aria-pressed={Boolean(tableSession)}
                onClick={() => setShowDineInScanner(true)}
                className={`liquid-segment mobile-order-type-button flex min-h-[56px] min-w-0 items-center gap-2 rounded-[14px] px-2.5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 min-[390px]:gap-2.5 min-[390px]:px-3 ${
                  tableSession
                    ? "border border-primary/30 bg-primary/20 backdrop-blur-xl text-primary shadow-[0_4px_16px_rgba(234,179,8,0.2)]"
                    : "border border-transparent text-white/50 hover:bg-white/[0.03] hover:text-white/70"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition min-[390px]:h-9 min-[390px]:w-9 ${
                    tableSession
                      ? "bg-primary/20 text-primary"
                      : "bg-white/5 text-white/60"
                  }`}
                >
                  <QrCode size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block whitespace-nowrap text-[12px] font-black leading-none min-[390px]:text-[13px]">
                    Dine-in
                  </span>
                  <span
                    className={`mt-1 block truncate text-[9px] font-bold leading-none ${
                      tableSession ? "text-primary/70" : "text-white/30"
                    }`}
                  >
                    {tableSession?.label ?? "Scan table QR"}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════════════
          iOS HERO — LIQUID GLASS COUPON
          ═══════════════════════════════════════════════ */}
      <section className="liquid-hero relative h-[clamp(19rem,82vw,21rem)] w-full overflow-hidden sm:h-[280px]">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#050505] z-10 pointer-events-none" />
        <Image
          src="/images/al-arab-hero.png"
          alt="Hero"
          fill
          sizes="100vw"
          className="object-cover object-[68%_center] opacity-50"
          priority
        />
        <div className="absolute inset-0 z-20 flex min-w-0 flex-col justify-end px-4 pb-5 pt-4 min-[390px]:px-5 min-[390px]:pb-6">
          <h1
            className="max-w-full font-heading text-[clamp(2rem,10vw,2.55rem)] font-bold uppercase leading-[0.88] text-[#fff7df] drop-shadow-lg"
            style={{ letterSpacing: "0.015em" }}
          >
            AL-ARAB
            <br />
            RESTAURANT
          </h1>
          <p className="mt-2 max-w-[280px] text-[clamp(0.75rem,3.4vw,0.875rem)] font-medium leading-snug text-white/85 drop-shadow-md">
            Premium mandi, grills, and shawarma.
          </p>

          <TiltCard intensity={8} className="mt-4 w-full max-w-sm cursor-pointer">
            <LiquidGlass
              refraction={12}
              className="liquid-coupon-card w-full rounded-2xl !bg-black/30 !border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
            >
              <div className="mobile-offer-row grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-3.5 py-3.5 min-[390px]:gap-4 min-[390px]:px-5 min-[390px]:py-4">
                <div className="min-w-0">
                  <span className="text-[10px] font-bold text-white/50 uppercase tracking-wider">
                    Use Code
                  </span>
                  <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5 min-[390px]:gap-2.5">
                    <span className="whitespace-nowrap text-base font-black tracking-wide text-primary min-[390px]:text-lg">
                      ALARAB10
                    </span>
                    <GlassBadge variant="primary">10% OFF</GlassBadge>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleCopyCoupon();
                  }}
                  className="liquid-control flex min-h-11 min-w-16 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 px-3.5 py-2.5 text-xs font-black text-white shadow-lg backdrop-blur-md transition-all hover:bg-white/20 active:scale-95 min-[390px]:min-w-20 min-[390px]:px-5"
                >
                  COPY
                </button>
              </div>
            </LiquidGlass>
          </TiltCard>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          iOS CATEGORY PILLS
          ═══════════════════════════════════════════════ */}
      <section
        aria-label="Menu categories"
        className="liquid-category-rail sticky z-30 mt-3 w-full border-y border-white/5 bg-black/50 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/40 sm:mt-4"
      >
        <div
          ref={scrollRef}
          className="mobile-category-scroller mx-auto flex h-[62px] w-full max-w-4xl snap-x snap-proximity items-center gap-2 overflow-x-auto overscroll-x-contain scroll-smooth px-3 py-2.5 [-ms-overflow-style:none] [scrollbar-width:none] min-[390px]:h-[66px] min-[390px]:gap-2.5 min-[390px]:px-4 sm:justify-center sm:gap-3 sm:px-6 [&::-webkit-scrollbar]:hidden"
        >
          {["All", "Mains", "Appetizers", "Desserts", "Beverages"].map(
            (category) => {
              const isSelected = selectedCategory === category;
              return (
                <button
                  key={category}
                  type="button"
                  data-active={isSelected ? "true" : "false"}
                  aria-pressed={isSelected}
                  onClick={(event) => {
                    setSelectedCategory(category);
                    triggerHaptic("light");
                    event.currentTarget.scrollIntoView({
                      behavior: "smooth",
                      block: "nearest",
                      inline: "center"
                    });
                  }}
                  className={`liquid-pill h-10 min-w-[84px] shrink-0 snap-center whitespace-nowrap rounded-full px-4 text-[12px] font-black transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background min-[390px]:min-w-[92px] min-[390px]:px-5 sm:min-w-[112px] sm:px-6 sm:text-[13px] ${
                    isSelected
                      ? "scale-[1.02] border border-primary/40 bg-primary/20 text-primary shadow-[0_6px_18px_rgba(62,39,35,0.18)]"
                      : "border border-white/10 bg-white/[0.03] text-white/50 hover:-translate-y-0.5 hover:border-white/15 hover:bg-white/[0.06] hover:text-white/70"
                  }`}
                >
                  {category}
                </button>
              );
            }
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          iOS LIQUID GLASS — MENU CARDS
          ═══════════════════════════════════════════════ */}
      <section id="menu-results" className="w-full scroll-mt-24 px-3 pb-36 pt-5 min-[390px]:px-5 min-[390px]:pt-7">
        {searchTerm.trim() && (
          <p
            role="status"
            aria-live="polite"
            className="mb-5 text-xs font-bold text-white/40"
          >
            {isLoading
              ? "Searching menu..."
              : `${visibleItems.length} ${visibleItems.length === 1 ? "result" : "results"} for "${searchTerm.trim()}"`}
          </p>
        )}

        <div className="space-y-5 relative perspective-[1000px]">
          {visibleItems.map((item, index) => {
            const sizeOptions = getSizeOptions(item);
            const hasMultipleSizes = sizeOptions.length > 1;
            const itemCartLines = items.filter(
              (cart) => cart.item.id === item.id
            );
            const itemQuantity = itemCartLines.reduce(
              (sum, line) => sum + line.quantity,
              0
            );
            const singleSizeCartItem = itemCartLines.find(
              (cart) => cart.customization.size === sizeOptions[0]?.name
            );

            return (
              <TiltCard
                key={item.id}
                id={`menu-item-${item.id}`}
                data-customer-reveal
                intensity={6}
                className="w-full"
                style={{
                  transitionDelay: `${Math.min(index, 6) * 60}ms`,
                }}
              >
                <LiquidGlass
                  refraction={10}
                  className="liquid-menu-card w-full rounded-[1.25rem] !bg-[#111111]/40 !border-white/5 hover:!border-primary/30 transition-all duration-300"
                >
                  <div className="mobile-menu-card-layout flex w-full min-w-0 flex-row items-stretch gap-3 p-3 sm:gap-4 sm:p-4">
                    {/* Image Section */}
                    <div
                      className="liquid-image-frame mobile-menu-card-image relative min-h-[148px] w-[clamp(6.25rem,30vw,7.5rem)] shrink-0 self-stretch overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl sm:min-h-32 sm:w-32"
                      style={{ transform: "translateZ(20px)" }}
                    >
                      <Image
                        src={item.image || "/images/placeholder.jpg"}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-110 transition-transform duration-700 ease-out"
                      />
                      {!item.available && (
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex items-center justify-center">
                          <GlassBadge variant="danger">Out of Stock</GlassBadge>
                        </div>
                      )}
                      {item.bestSeller && item.available && (
                        <div className="absolute top-2 left-2">
                          <GlassBadge variant="primary">
                            <Flame size={9} strokeWidth={3} /> BESTSELLER
                          </GlassBadge>
                        </div>
                      )}
                    </div>

                    {/* Content Section */}
                    <div
                      className="mobile-menu-card-content flex min-h-[148px] min-w-0 flex-1 flex-col justify-between"
                      style={{ transform: "translateZ(30px)" }}
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                           <h3 className="line-clamp-2 min-w-0 text-sm font-bold leading-tight text-white drop-shadow-md sm:text-base">
                            {item.name}
                          </h3>
                          <button
                            type="button"
                            aria-label={
                              wishlistItems.some(
                                (wishlistItem) => wishlistItem.id === item.id
                              )
                                ? `Remove ${item.name} from wishlist`
                                : `Add ${item.name} to wishlist`
                            }
                            onClick={(e) => {
                              e.stopPropagation();
                              triggerHaptic("light");
                              if (
                                wishlistItems.some(
                                  (wishlistItem) => wishlistItem.id === item.id
                                )
                              ) {
                                removeFromWishlist(item.id);
                              } else {
                                addToWishlist(item);
                              }
                            }}
                            className="liquid-icon-button p-1 -mr-1 -mt-1 shrink-0 active:scale-75 transition-transform duration-150"
                          >
                            <Heart
                              size={16}
                              fill={
                                wishlistItems.find((w) => w.id === item.id)
                                  ? "#D84315"
                                  : "none"
                              }
                              className={
                                wishlistItems.find((w) => w.id === item.id)
                                  ? "text-[#D84315] drop-shadow-md"
                                  : "text-white/25 hover:text-white/60 transition-colors"
                              }
                            />
                          </button>
                        </div>

                        <p className="mt-1 text-lg sm:text-xl font-black text-white drop-shadow-md">
                          ₹{item.price}
                        </p>
                         <p className="mobile-menu-description mt-1 line-clamp-2 min-h-[2.5rem] text-[10px] leading-relaxed text-white/50 mix-blend-overlay sm:text-xs">
                          {item.description}
                        </p>
                      </div>

                      {/* Bottom Row */}
                       <div className="mobile-menu-card-actions mt-2 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            void openDishReviews(item);
                          }}
                           className="flex min-h-11 min-w-0 items-center gap-1 overflow-hidden text-[10px] font-bold text-white/35 mix-blend-overlay transition hover:text-white/70 sm:text-[11px]"
                          aria-label={`Read verified reviews for ${item.name}`}
                        >
                          <Star
                            size={11}
                            className={`text-primary mix-blend-normal ${item.reviews > 0 ? "fill-primary" : ""}`}
                          />
                           <span className="truncate">
                             {item.reviews > 0
                               ? `${item.rating} (${item.reviews})`
                               : "New"}
                           </span>
                        </button>

                        {item.available &&
                          (() => {
                            if (hasMultipleSizes) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic("medium");
                                    setPortionPickerItem(item);
                                  }}
                                  className="liquid-action liquid-action-gold relative flex min-h-11 min-w-24 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-primary/40 bg-primary/20 px-3 text-[9px] font-black text-primary shadow-[0_4px_12px_rgba(234,179,8,0.15)] backdrop-blur-xl transition-all hover:bg-primary/30 active:scale-95 sm:min-w-28 sm:text-[10px]"
                                >
                                  {itemQuantity > 0
                                    ? `${itemQuantity} IN CART`
                                    : "CHOOSE SIZE"}
                                </button>
                              );
                            }

                            if (!singleSizeCartItem) {
                              return (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    triggerHaptic("medium");
                                    handleAddItem(item);
                                  }}
                                  className="liquid-action relative flex min-h-11 min-w-20 shrink-0 items-center justify-center whitespace-nowrap rounded-xl border border-white/30 bg-white/10 px-3 text-[10px] font-black text-white shadow-[0_4px_16px_rgba(0,0,0,0.3)] backdrop-blur-xl transition-all hover:border-white/50 hover:bg-white/20 active:scale-95 sm:min-w-24 sm:px-4 sm:text-xs"
                                >
                                  ADD <Plus size={12} className="ml-1 inline" />
                                </button>
                              );
                            }

                            return (
                              <div
                                className="liquid-stepper flex min-h-11 shrink-0 items-center rounded-xl border border-primary/40 bg-primary/20 shadow-[0_4px_12px_rgba(234,179,8,0.15)] backdrop-blur-xl"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuantity(
                                      singleSizeCartItem.lineId,
                                      singleSizeCartItem.quantity - 1
                                    )
                                  }
                                  className="flex min-h-11 w-10 items-center justify-center rounded-l-xl text-primary transition hover:bg-primary/30 active:scale-90 sm:w-11"
                                >
                                  <Minus size={12} strokeWidth={3} />
                                </button>
                                <span className="w-5 text-center text-xs font-black text-white drop-shadow-md sm:w-6 sm:text-sm">
                                  {singleSizeCartItem.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setQuantity(
                                      singleSizeCartItem.lineId,
                                      singleSizeCartItem.quantity + 1
                                    )
                                  }
                                  className="flex min-h-11 w-10 items-center justify-center rounded-r-xl text-primary transition hover:bg-primary/30 active:scale-90 sm:w-11"
                                >
                                  <Plus size={12} strokeWidth={3} />
                                </button>
                              </div>
                            );
                          })()}
                      </div>
                    </div>
                  </div>
                </LiquidGlass>
              </TiltCard>
            );
          })}

          {/* Empty State */}
          {!isLoading && visibleItems.length === 0 && (
            <div className="liquid-panel rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl px-6 py-12 text-center shadow-2xl animate-in zoom-in duration-300">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
                <Search size={26} aria-hidden="true" />
              </span>
              <h2 className="mt-6 text-lg font-black text-white">
                No dishes found
              </h2>
              <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-white/50">
                Try a dish name, ingredient, or category such as mandi, kebab,
                or desserts.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedCategory("All");
                }}
                className="liquid-action liquid-action-gold mt-6 min-h-11 rounded-xl border border-primary/40 bg-primary/20 backdrop-blur-xl px-6 py-2.5 text-sm font-black text-primary shadow-[0_4px_16px_rgba(234,179,8,0.2)] transition hover:bg-primary/30 active:scale-95"
              >
                Show all dishes
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════
          iOS TOAST NOTIFICATION
          ═══════════════════════════════════════════════ */}
      {cartNotice && (
        <GlassToast
          key={cartNotice.id}
          message={cartNotice.message}
          onDone={() => setCartNotice(null)}
        />
      )}

      {/* ═══════════════════════════════════════════════
          iOS FLOATING CART BAR
          ═══════════════════════════════════════════════ */}
      {items.length > 0 && (
        <div className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 right-3 z-40 animate-in slide-in-from-bottom-10 min-[390px]:left-4 min-[390px]:right-4">
          <LiquidGlass
            refraction={10}
            className="liquid-floating-cart w-full rounded-[1.25rem] !bg-black/60 !border-white/20 hover:!border-primary/50 transition-colors shadow-[0_10px_40px_rgba(0,0,0,0.5)] cursor-pointer"
            onClick={() => {
              triggerHaptic("light");
              setShowCart(true);
            }}
          >
            <div className="flex flex-row items-center justify-between w-full px-5 py-4">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-black text-[10px] font-black shadow-lg shadow-primary/30">
                  {items.reduce((sum, item) => sum + item.quantity, 0)}
                </span>
                <div>
                  <p className="text-sm font-black text-white">
                    {items.reduce((sum, item) => sum + item.quantity, 0)}{" "}
                    {items.reduce((sum, item) => sum + item.quantity, 0) === 1
                      ? "Item"
                      : "Items"}{" "}
                    Added
                  </p>
                  <p className="text-[11px] font-bold text-white/60 mt-0.5">
                    Total:{" "}
                    <span className="text-primary font-black text-sm ml-1">
                      ₹{Math.round(animatedTotal)}
                    </span>
                  </p>
                </div>
              </div>
              <div className="liquid-control flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 backdrop-blur-md px-4 py-2.5 text-xs font-black text-white hover:bg-white/20 transition active:scale-95">
                <ShoppingCart size={16} /> View Cart
              </div>
            </div>
          </LiquidGlass>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          iOS BOTTOM SHEET — PORTION PICKER
          ═══════════════════════════════════════════════ */}
      {reviewsItem && (
        <div className="fixed inset-0 z-[115] flex flex-col justify-end">
          <button
            type="button"
            aria-label="Close dish reviews"
            className="absolute inset-0 bg-black/75 backdrop-blur-xl"
            onClick={() => setReviewsItem(null)}
          />
          <section className="liquid-bottom-sheet relative flex max-h-[82vh] flex-col rounded-t-[2rem] border-t border-white/10 bg-[#111111]/95 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Verified reviews
                </p>
                <h2 className="mt-1 text-xl font-black text-white">
                  {reviewsItem.name}
                </h2>
                <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-white/55">
                  <Star
                    size={15}
                    className={reviewsItem.reviews > 0 ? "fill-primary text-primary" : "text-primary"}
                  />
                  {reviewsItem.reviews > 0
                    ? `${reviewsItem.rating} from ${reviewsItem.reviews} verified review${reviewsItem.reviews === 1 ? "" : "s"}`
                    : "No verified reviews yet"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewsItem(null)}
                aria-label="Close reviews"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 hover:bg-white/10 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-6 pb-safe">
              {isReviewsLoading ? (
                <p className="py-8 text-center text-sm font-semibold text-white/45">
                  Loading verified reviews...
                </p>
              ) : reviewsError ? (
                <p role="alert" className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-semibold text-red-300">
                  {reviewsError}
                </p>
              ) : menuReviews.length === 0 ? (
                <p className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-sm font-semibold text-white/50">
                  Be the first verified customer to review this dish after delivery.
                </p>
              ) : (
                menuReviews.map((review) => (
                  <article key={review.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-white">
                        {review.customerName}
                      </p>
                      <span className="flex items-center gap-1 text-xs font-black text-primary">
                        <Star size={13} className="fill-current" />
                        {review.rating}
                      </span>
                    </div>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">
                      Verified order
                    </p>
                    {review.comment && (
                      <p className="mt-3 text-sm leading-relaxed text-white/65">
                        {review.comment}
                      </p>
                    )}
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {portionPickerItem && (
        <div className="fixed inset-0 z-[110] flex flex-col justify-end">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close portion picker"
            className="absolute inset-0 bg-black/70 backdrop-blur-xl transition-opacity duration-300 animate-in fade-in"
            onClick={() => setPortionPickerItem(null)}
          />

          {/* Sheet */}
          <div className="liquid-bottom-sheet relative rounded-t-[2.5rem] border-t border-white/10 bg-[#111111]/90 backdrop-blur-3xl p-6 pb-safe shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300">
            {/* Drag handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20" />

            <div className="mb-7 mt-2 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-primary">
                  Choose Portion
                </p>
                <h2 className="mt-1 text-2xl font-black text-white drop-shadow-md">
                  {portionPickerItem.name}
                </h2>
              </div>
              <button
                onClick={() => setPortionPickerItem(null)}
                className="liquid-icon-button flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              {getSizeOptions(portionPickerItem).map((size) => {
                const cartLine = items.find(
                  (line) =>
                    line.item.id === portionPickerItem.id &&
                    line.customization.size === size.name
                );
                const sizePrice = getSizePrice(portionPickerItem, size);

                return (
                  <div
                    key={size.name}
                    className="liquid-row rounded-2xl border border-white/10 bg-white/[0.03] p-4 flex items-center justify-between gap-4 transition hover:bg-white/[0.06]"
                  >
                    <div>
                      <p className="font-black text-white text-lg drop-shadow-md">
                        {size.name}
                      </p>
                      <p className="mt-0.5 text-sm font-bold text-white/50">
                        ₹{sizePrice}
                      </p>
                    </div>

                    {cartLine ? (
                      <div className="liquid-stepper flex min-h-12 items-center rounded-xl border border-primary/40 bg-primary/20 backdrop-blur-xl shadow-[0_4px_16px_rgba(234,179,8,0.15)]">
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setQuantity(cartLine.lineId, cartLine.quantity - 1);
                          }}
                          className="flex h-12 w-12 items-center justify-center rounded-l-xl text-primary transition hover:bg-primary/30 active:scale-90"
                        >
                          <Minus size={14} strokeWidth={3} />
                        </button>
                        <span className="w-8 text-center text-base font-black text-white drop-shadow-md">
                          {cartLine.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            triggerHaptic("light");
                            setQuantity(cartLine.lineId, cartLine.quantity + 1);
                          }}
                          className="flex h-12 w-12 items-center justify-center rounded-r-xl text-primary transition hover:bg-primary/30 active:scale-90"
                        >
                          <Plus size={14} strokeWidth={3} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic("medium");
                          addItemWithSize(portionPickerItem, size.name);
                          setPortionPickerItem(null);
                        }}
                        className="liquid-action liquid-action-gold min-h-12 rounded-xl border border-primary/40 bg-primary/20 backdrop-blur-xl px-6 py-2 text-sm font-black text-primary shadow-[0_4px_16px_rgba(234,179,8,0.2)] transition hover:bg-primary/30 active:scale-95"
                      >
                        Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════
          iOS BOTTOM SHEET — CART MODAL
          ═══════════════════════════════════════════════ */}
      {showCart && (
        <div className="fixed inset-0 z-[100] flex justify-end flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-xl transition-opacity duration-300 animate-in fade-in"
            onClick={() => setShowCart(false)}
          />

          {/* Sheet */}
          <div className="liquid-bottom-sheet relative flex max-h-[88vh] flex-col rounded-t-[2.5rem] border-t border-white/10 bg-[#0a0a0a]/90 backdrop-blur-3xl shadow-[0_-10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom duration-300">
            {/* Drag handle */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/20" />

            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 pb-4 pt-6 sm:px-6 sm:pb-5 sm:pt-7">
              <h2 className="flex items-center gap-2.5 text-lg font-black text-white drop-shadow-md">
                <span className="rounded-xl border border-primary/30 bg-primary/20 p-2 text-primary shadow-[0_0_15px_rgba(234,179,8,0.15)]">
                  <ShoppingCart size={18} />
                </span>
                Your Cart
              </h2>

              <button
                onClick={() => setShowCart(false)}
                className="liquid-icon-button flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 scrollbar-none sm:p-6">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-white/30">
                  <ShoppingCart size={72} className="mb-5 opacity-20" />
                  <p className="text-base font-bold text-white/50">
                    Your cart is empty
                  </p>
                  <p className="mt-1.5 text-xs text-white/30">
                    Add some delicious items!
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {items.map((cartItem, idx) => (
                    <div
                      key={cartItem.lineId}
                      className="liquid-row rounded-2xl border border-white/10 bg-white/[0.03] p-3.5 transition hover:bg-white/[0.05] animate-in fade-in slide-in-from-bottom-4 sm:p-4"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white drop-shadow-md sm:text-base">
                            {cartItem.item.name}
                          </p>
                          <p className="text-xs font-medium text-white/50 mt-1.5">
                            {cartItem.customization.size !== "Regular" &&
                              `${cartItem.customization.size} Portion • `}
                            ₹{cartItem.unitPrice} each
                          </p>
                        </div>
                        <p className="shrink-0 text-base font-black text-primary drop-shadow-md sm:text-lg">
                          ₹{cartItem.unitPrice * cartItem.quantity}
                        </p>
                      </div>

                      <div className="mt-4 flex items-center justify-between">
                        <div className="liquid-stepper flex items-center rounded-xl p-1 border border-white/10 bg-black/50 backdrop-blur-md">
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic("light");
                              setQuantity(cartItem.lineId, cartItem.quantity - 1);
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white/70 hover:bg-white/10 hover:text-white transition active:scale-90"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-9 text-center font-black text-sm text-white drop-shadow-md">
                            {cartItem.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic("light");
                              setQuantity(cartItem.lineId, cartItem.quantity + 1);
                            }}
                            className="flex h-10 w-10 items-center justify-center rounded-lg font-bold text-white/70 hover:bg-white/10 hover:text-white transition active:scale-90"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <button
                          onClick={() => {
                            triggerHaptic("medium");
                            removeItem(cartItem.lineId);
                          }}
                          className="liquid-action text-[11px] font-black uppercase tracking-wider text-red-400 border border-red-500/20 bg-red-500/10 hover:bg-red-500/20 backdrop-blur-md px-4 py-2.5 rounded-xl transition active:scale-95"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}

                  {/* Smart Upsell */}
                  {(() => {
                    const recommendation = getUpsellRecommendation(items, data);
                    if (!recommendation) return null;

                    return (
                      <div className="mt-8 animate-in fade-in slide-in-from-bottom-8" style={{ animationDelay: "200ms" }}>
                        <LiquidGlass
                          refraction={10}
                          className="liquid-panel w-full rounded-2xl !border-primary/30 !bg-primary/[0.05]"
                        >
                          <div className="flex flex-col w-full p-4">
                            <p className="mb-4 text-[10px] font-black uppercase tracking-wider text-primary flex items-center gap-1.5">
                              <Star size={12} className="fill-primary" /> Complete your meal
                            </p>

                            <div className="flex flex-row items-center gap-4">
                              <div className="h-[60px] w-[60px] shrink-0 overflow-hidden rounded-xl border border-white/[0.08] shadow-lg">
                                <Image
                                  src={recommendation.image || "/images/placeholder.jpg"}
                                  width={60}
                                  height={60}
                                  alt={recommendation.name}
                                  className="h-full w-full object-cover"
                                />
                              </div>

                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-bold text-white drop-shadow-md sm:text-base">
                                  {recommendation.name}
                                </p>
                                <p className="text-xs font-semibold text-white/60 sm:text-sm">
                                  ₹{recommendation.price}
                                </p>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  triggerHaptic("success");
                                  addItem(recommendation, {
                                    size: "Regular",
                                    spiceLevel: getDefaultSpiceLevel(recommendation),
                                    addOns: [],
                                  });
                                }}
                                className="liquid-action liquid-action-gold rounded-xl border border-primary/40 bg-primary/20 backdrop-blur-xl px-5 py-2.5 text-xs font-black text-primary shadow-[0_4px_16px_rgba(234,179,8,0.2)] transition hover:bg-primary/30 active:scale-95"
                              >
                                ADD
                              </button>
                            </div>
                          </div>
                        </LiquidGlass>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>

            {items.length > 0 && (
              <div className="liquid-cart-footer border-t border-white/[0.06] bg-black/40 p-4 pb-safe backdrop-blur-md sm:p-6">
                <div className="mb-4 flex items-end justify-between gap-4">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
                      Subtotal
                    </span>
                    <p className="mt-0.5 text-[11px] font-medium leading-4 text-white/60 sm:text-xs">
                      Extra charges calculated at checkout
                    </p>
                  </div>
                  <span className="shrink-0 text-2xl font-black text-primary drop-shadow-md sm:text-[1.75rem]">
                    ₹{Math.round(animatedTotal)}
                  </span>
                </div>
                <button
                  onClick={() => void proceedToCheckout()}
                  disabled={isCheckoutAuthLoading}
                  className="liquid-action liquid-action-gold min-h-12 w-full rounded-2xl border border-primary/40 bg-primary/20 px-4 py-3 text-sm font-black text-primary shadow-[0_8px_32px_rgba(234,179,8,0.2)] backdrop-blur-2xl transition-all hover:bg-primary/30 active:scale-[0.98] sm:text-base"
                >
                  {isCheckoutAuthLoading ? "Checking account..." : "Proceed to Checkout"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
