"use client";

import { type TouchEvent, useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgePercent,
  ChevronDown,
  Heart,
  Home,
  MapPinned,
  Menu,
  ShoppingCart,
  UserCircle,
  UtensilsCrossed,
  X
} from "lucide-react";

const navigationItems = [
  { label: "Welcome", description: "Return to the 3D home", href: "/", icon: Home },
  { label: "Our Menu", description: "Explore every dish", href: "/mobile", icon: UtensilsCrossed },
  { label: "Offers", description: "Today’s best value", href: "/offers", icon: BadgePercent },
  { label: "Wishlist", description: "Saved favorites", href: "/wishlist", icon: Heart },
  { label: "My Orders", description: "Track your feast", href: "/orders/track", icon: MapPinned },
  { label: "My Profile", description: "Account and details", href: "/profile", icon: UserCircle }
];

type Customer3DNavProps = {
  cartCount?: number;
  onCartClick?: () => void;
};

export function Customer3DNav({ cartCount = 0, onCartClick }: Customer3DNavProps) {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const sheetRef = useRef<HTMLElement>(null);
  const gestureStartY = useRef<number | null>(null);
  const dragFrame = useRef(0);

  const handleGestureStart = (event: TouchEvent<HTMLElement>) => {
    gestureStartY.current = event.touches[0]?.clientY ?? null;
  };

  const handleGestureMove = (event: TouchEvent<HTMLElement>) => {
    if (!isOpen || gestureStartY.current === null || !sheetRef.current) return;

    const currentY = event.touches[0]?.clientY ?? gestureStartY.current;
    const dragDistance = Math.max(0, currentY - gestureStartY.current);

    cancelAnimationFrame(dragFrame.current);
    dragFrame.current = requestAnimationFrame(() => {
      sheetRef.current?.style.setProperty("--sheet-drag-y", `${Math.min(dragDistance, 140)}px`);
    });
  };

  const handleGestureEnd = (event: TouchEvent<HTMLElement>) => {
    if (gestureStartY.current === null) return;

    const endY = event.changedTouches[0]?.clientY ?? gestureStartY.current;
    const distance = endY - gestureStartY.current;
    sheetRef.current?.style.removeProperty("--sheet-drag-y");

    if (isOpen && distance > 64) setIsOpen(false);
    if (!isOpen && distance < -44) setIsOpen(true);
    gestureStartY.current = null;
  };

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      cancelAnimationFrame(dragFrame.current);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const cartControl = onCartClick ? (
    <button
      type="button"
      className="mobile-dock-link"
      aria-label={`Cart with ${cartCount} items`}
      onClick={onCartClick}
    >
      <span className="relative">
        <ShoppingCart size={21} strokeWidth={1.9} />
        {cartCount > 0 && <span className="mobile-dock-count">{cartCount}</span>}
      </span>
      <span>Cart</span>
    </button>
  ) : (
    <Link href="/mobile" className="mobile-dock-link" aria-label="Open menu and cart">
      <ShoppingCart size={21} strokeWidth={1.9} />
      <span>Order</span>
    </Link>
  );

  return (
    <>
      <div className={`mobile-menu-layer md:hidden ${isOpen ? "is-open" : ""}`} aria-hidden={!isOpen}>
        <button
          type="button"
          tabIndex={isOpen ? 0 : -1}
          aria-label="Close navigation"
          className="mobile-menu-backdrop"
          onClick={() => setIsOpen(false)}
        />

        <aside
          ref={sheetRef}
          id="customer-3d-navigation"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-3d-navigation-title"
          inert={!isOpen}
          className="mobile-menu-sheet"
          onTouchStart={handleGestureStart}
          onTouchMove={handleGestureMove}
          onTouchEnd={handleGestureEnd}
        >
          <div className="mobile-menu-grab" aria-hidden="true" />
          <div className="mobile-menu-heading">
            <div className="flex items-center gap-3">
              <span className="mobile-menu-logo">
                <Image src="/images/logo-watermark.png" alt="" width={42} height={42} className="h-9 w-auto object-contain" />
              </span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.26em] text-primary">Al-Arab</p>
                <h2 id="customer-3d-navigation-title" className="mt-0.5 font-heading text-2xl font-semibold text-[#fff7df]">
                  Where would you like to go?
                </h2>
              </div>
            </div>
            <button type="button" aria-label="Close navigation" className="mobile-menu-close" onClick={() => setIsOpen(false)}>
              <X size={20} />
            </button>
          </div>

          <nav className="mobile-menu-grid" aria-label="Customer pages">
            {navigationItems.map((item, index) => {
              const isActive = pathname === item.href || (item.href === "/orders/track" && pathname.startsWith("/orders"));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  tabIndex={isOpen ? 0 : -1}
                  aria-current={isActive ? "page" : undefined}
                  onClick={() => setIsOpen(false)}
                  className={`mobile-menu-item ${isActive ? "is-active" : ""}`}
                  style={{ transitionDelay: isOpen ? `${90 + index * 48}ms` : "0ms" }}
                >
                  <span className="mobile-menu-item-icon">
                    <item.icon size={21} strokeWidth={1.8} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold text-[#fff7df]">{item.label}</span>
                    <span className="mobile-menu-item-description mt-1 block truncate text-[11px] font-medium text-[#bcb39f]">
                      {item.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </nav>

          <div className="mobile-menu-swipe-hint">
            <ChevronDown size={15} aria-hidden="true" />
            Swipe down to close
          </div>
        </aside>
      </div>

      <nav
        className={`mobile-bottom-dock customer-page-dock md:hidden ${isOpen ? "is-expanded" : ""}`}
        aria-label="Primary mobile navigation"
        onTouchStart={handleGestureStart}
        onTouchEnd={handleGestureEnd}
      >
        <Link href="/" className="mobile-dock-link" aria-label="Welcome page">
          <Home size={21} strokeWidth={1.9} />
          <span>Home</span>
        </Link>

        <div className="mobile-menu-trigger-slot">
          <button
            type="button"
            aria-expanded={isOpen}
            aria-controls="customer-3d-navigation"
            aria-label={isOpen ? "Close menu" : "Open menu"}
            className="mobile-menu-trigger"
            onClick={() => setIsOpen((open) => !open)}
          >
            <span className="mobile-menu-trigger-glow" aria-hidden="true" />
            <span className="mobile-menu-trigger-ring" aria-hidden="true" />
            <span className="mobile-menu-trigger-face">
              <span className="mobile-menu-trigger-icon" aria-hidden="true">
                {isOpen ? <X size={23} strokeWidth={2} /> : <Menu size={24} strokeWidth={2} />}
              </span>
            </span>
          </button>
          <span className="mobile-menu-trigger-label">
            <span className="mobile-menu-trigger-label-dot" aria-hidden="true" />
            {isOpen ? "Close" : "Menu"}
          </span>
        </div>

        {cartControl}
      </nav>
    </>
  );
}
