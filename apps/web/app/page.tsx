"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { DineInScanner } from "@/components/DineInScanner";
import {
  RestaurantOfflineScreen,
  RestaurantStatusLoadingScreen
} from "@/components/RestaurantAvailabilityScreen";
import {
  DeliveryLocationSearch,
  type DeliveryLocationSearchResult
} from "@/components/DeliveryLocationSearch";
import { fetchMenu, fetchPublicRestaurantSettings, fetchWithTimeout } from "@/lib/api";
import { menuItems, restaurant } from "@/lib/data";
import { clearTableSession } from "@/lib/table-session";
import { useCartStore } from "@/store/cart-store";
import {
  DELIVERY_RADIUS_KM,
  OUTSIDE_DELIVERY_MESSAGE,
  evaluateDeliveryLocation
} from "@/lib/delivery-zone";
import {
  persistSessionDeliveryLocation,
  readSessionDeliveryLocation
} from "@/lib/delivery-location-session";
import { getPreciseCurrentPosition } from "@/lib/precise-geolocation";
import { persistCustomerOrderType } from "@/lib/order-type-session";
import {
  AlertTriangle,
  ArrowRight,
  BadgePercent,
  Bike,
  CheckCircle2,
  CircleHelp,
  Clock3,
  FileText,
  HeadphonesIcon,
  Heart,
  Home as HomeIcon,
  Info,
  LoaderCircle,
  MapPin,
  MapPinned,
  Menu,
  PhoneCall,
  Package,
  QrCode,
  Search,
  ShieldCheck,
  ShoppingCart,
  Star,
  UtensilsCrossed,
  UserCircle,
  X
} from "lucide-react";

type WelcomeLocationState = {
  status: "idle" | "locating" | "eligible" | "outside" | "error";
  label: string;
  distanceKm?: number;
};

const profileLinks = [
  { label: "Help & Support", href: "/support", icon: HeadphonesIcon },
  { label: "FAQs", href: "/faqs", icon: CircleHelp },
  { label: "About Al-Arab", href: "/about", icon: Info },
  { label: "Terms & Conditions", href: "/terms", icon: FileText },
  { label: "Privacy Policy", href: "/privacy", icon: ShieldCheck }
];

const mobileNavigation = [
  { label: "Home", description: "Return to welcome", href: "/", icon: HomeIcon },
  { label: "Our Menu", description: "Explore every dish", href: "/mobile", icon: UtensilsCrossed },
  { label: "Offers", description: "Today's best value", href: "/offers", icon: BadgePercent },
  { label: "Wishlist", description: "Saved favorites", href: "/wishlist", icon: Heart },
  { label: "Track Order", description: "Follow your feast", href: "/orders/track", icon: MapPinned },
  { label: "My Profile", description: "Account and details", href: "/profile", icon: UserCircle }
];

const showcaseImages = [
  {
    label: "Chicken Mandi",
    alt: "Al-Arab chicken mandi with saffron rice",
    src: menuItems.find((item) => item.id === "chicken-mandi")?.image ?? "/images/al-arab-hero.png",
    className: "editorial-showcase-card editorial-showcase-wide",
    imageClassName: "object-[50%_52%]"
  },
  {
    label: "Arabic Grill",
    alt: "Al-Arab mixed Arabic grill platter",
    src: menuItems.find((item) => item.id === "mixed-grill")?.image ?? "/images/al-arab-hero.png",
    className: "editorial-showcase-card editorial-showcase-pill",
    imageClassName: "object-[52%_50%]"
  },
  {
    label: "Shawarma",
    alt: "Al-Arab loaded chicken shawarma",
    src: menuItems.find((item) => item.id === "shawarma")?.image ?? "/images/al-arab-hero.png",
    className: "editorial-showcase-card editorial-showcase-circle",
    imageClassName: "object-[50%_50%]"
  },
  {
    label: "Cream Kunafa",
    alt: "Al-Arab cream kunafa dessert",
    src: menuItems.find((item) => item.id === "kunafa")?.image ?? "/images/al-arab-hero.png",
    className: "editorial-showcase-card editorial-showcase-banner",
    imageClassName: "object-[50%_58%]"
  }
];

function compactPhone(phone: string) {
  return phone.replace(/\s+/g, "");
}

function EchoStack({ text }: { text: string }) {
  return (
    <span className="echo-stack" aria-label={text}>
      <span aria-hidden="true" className="echo-layer echo-layer-4">{text}</span>
      <span aria-hidden="true" className="echo-layer echo-layer-3">{text}</span>
      <span aria-hidden="true" className="echo-layer echo-layer-2">{text}</span>
      <span aria-hidden="true" className="echo-layer echo-layer-1">{text}</span>
      <span className="echo-front">{text}</span>
    </span>
  );
}

export default function Home() {
  const router = useRouter();
  const {
    data: restaurantSettings,
    isLoading: isRestaurantSettingsLoading,
    isError: isRestaurantSettingsError
  } = useQuery({
    queryKey: ["restaurant-settings", "public"],
    queryFn: fetchPublicRestaurantSettings,
    refetchInterval: 5000,
    refetchOnWindowFocus: "always",
    staleTime: 2000
  });
  const { data: liveMenu = [] } = useQuery({
    queryKey: ["menu"],
    queryFn: fetchMenu
  });
  const featuredItems = (
    liveMenu.length > 0
      ? liveMenu
      : menuItems.map((item) => ({ ...item, rating: 0, reviews: 0 }))
  )
    .filter((item) => item.featured ?? item.available)
    .slice(0, 4);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showDineInScanner, setShowDineInScanner] = useState(false);
  const [isLocationSearchOpen, setIsLocationSearchOpen] = useState(false);
  const [deliveryLocation, setDeliveryLocation] = useState<WelcomeLocationState>({
    status: "idle",
    label: "Set your delivery location"
  });
  const { items } = useCartStore();
  const cartCount = items.reduce((sum, item) => sum + item.quantity, 0);
  const phoneHref = `tel:${compactPhone(restaurant.phone)}`;

  const chooseDelivery = useCallback(() => {
    if (deliveryLocation.status === "outside") return;
    clearTableSession();
    persistCustomerOrderType("delivery");
    router.push("/mobile");
  }, [deliveryLocation.status, router]);

  const handleTableResolved = useCallback(() => {
    persistCustomerOrderType("dine_in");
    router.push("/mobile");
  }, [router]);

  const chooseTakeaway = useCallback(() => {
    clearTableSession();
    persistCustomerOrderType("takeaway");
    router.push("/mobile");
  }, [router]);

  const detectDeliveryLocation = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setDeliveryLocation({
        status: "error",
        label: "Location is not supported on this device"
      });
      return;
    }

    setDeliveryLocation({
      status: "locating",
      label: "Finding your current location..."
    });

    void getPreciseCurrentPosition()
      .then(async (position) => {
        const latitude = position.coords.latitude;
        const longitude = position.coords.longitude;
        const zone = evaluateDeliveryLocation({ lat: latitude, lng: longitude });
        let displayName = "Current location";

        try {
          const response = await fetchWithTimeout(
            `/api/reverse-geocode?lat=${encodeURIComponent(latitude)}&lng=${encodeURIComponent(longitude)}`,
            {},
            10_000
          );
          if (response.ok) {
            const location = (await response.json()) as { displayName?: string };
            displayName = location.displayName?.trim() || "Current location";
          }
        } catch {
          // Coordinates remain valid even when reverse geocoding fails.
        }

        persistSessionDeliveryLocation({ latitude, longitude, displayName });
        setDeliveryLocation({
          status: zone.isWithinDeliveryZone ? "eligible" : "outside",
          label: zone.isWithinDeliveryZone ? displayName : OUTSIDE_DELIVERY_MESSAGE,
          distanceKm: zone.distanceKm
        });
      })
      .catch((error: GeolocationPositionError | Error) => {
        const permissionDenied =
          "code" in error && error.code === 1;
        setDeliveryLocation({
          status: "error",
          label: permissionDenied
            ? "Allow location permission and try again"
            : "Unable to detect location. Check GPS and retry"
        });
      });
  }, []);

  const selectSearchedLocation = useCallback((location: DeliveryLocationSearchResult) => {
    const displayName = [location.name, location.subtitle].filter(Boolean).join(", ");
    persistSessionDeliveryLocation({
      latitude: location.latitude,
      longitude: location.longitude,
      displayName
    });
    setDeliveryLocation({
      status: location.isWithinDeliveryZone ? "eligible" : "outside",
      label: location.isWithinDeliveryZone ? displayName : OUTSIDE_DELIVERY_MESSAGE,
      distanceKm: location.distanceKm
    });
    setIsLocationSearchOpen(false);
  }, []);

  useEffect(() => {
    const storedLocation = readSessionDeliveryLocation();
    if (!storedLocation) return;

    const zone = evaluateDeliveryLocation({
      lat: storedLocation.latitude,
      lng: storedLocation.longitude
    });
    setDeliveryLocation({
      status: zone.isWithinDeliveryZone ? "eligible" : "outside",
      label: zone.isWithinDeliveryZone
        ? storedLocation.displayName
        : OUTSIDE_DELIVERY_MESSAGE,
      distanceKm: zone.distanceKm
    });
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMobileMenuOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleEscape);
    };
  }, [isMobileMenuOpen]);

  if (isRestaurantSettingsLoading && !isRestaurantSettingsError) {
    return <RestaurantStatusLoadingScreen />;
  }

  if (restaurantSettings && !restaurantSettings.restaurantOpen) {
    return <RestaurantOfflineScreen settings={restaurantSettings} />;
  }

  const locationTone =
    deliveryLocation.status === "eligible"
      ? "is-eligible"
      : deliveryLocation.status === "outside"
        ? "is-outside"
        : deliveryLocation.status === "error"
          ? "is-error"
          : "";

  return (
    <main className="editorial-welcome min-h-screen overflow-x-clip">
      <DineInScanner
        open={showDineInScanner}
        onClose={() => setShowDineInScanner(false)}
        onTableResolved={handleTableResolved}
      />
      <DeliveryLocationSearch
        open={isLocationSearchOpen}
        isLocating={deliveryLocation.status === "locating"}
        onClose={() => setIsLocationSearchOpen(false)}
        onUseCurrentLocation={() => {
          setIsLocationSearchOpen(false);
          detectDeliveryLocation();
        }}
        onSelect={selectSearchedLocation}
      />

      <header className="editorial-header">
        <Link href="/" className="editorial-brand" aria-label="Al-Arab home">
          <span className="editorial-brand-mark">AA</span>
          <span>
            <span className="editorial-brand-name">Al-Arab</span>
            <span className="editorial-brand-subtitle">Restaurant</span>
          </span>
        </Link>

        <nav className="editorial-nav" aria-label="Homepage navigation">
          <Link href="/mobile">Menu</Link>
          <Link href="/checkout">Checkout</Link>
          <Link href="/orders/track">Tracking</Link>
        </nav>

        <div className="editorial-header-actions">
          <a href={phoneHref} className="editorial-contact">
            <PhoneCall size={17} aria-hidden="true" />
            <span>{restaurant.phone}</span>
          </a>
          <Link href="/checkout" className="editorial-cart" aria-label={`Cart with ${cartCount} items`}>
            <ShoppingCart size={18} aria-hidden="true" />
            <span>Cart</span>
            {cartCount > 0 && <b>{cartCount}</b>}
          </Link>
          <Link href="/login" className="editorial-login">Sign In</Link>
          <button
            type="button"
            className="editorial-profile"
            onClick={() => setIsProfileOpen(true)}
            aria-label="Open profile"
          >
            <UserCircle size={20} aria-hidden="true" />
            <span>Profile</span>
          </button>
          <button
            type="button"
            className="editorial-menu-button"
            onClick={() => setIsMobileMenuOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} aria-hidden="true" />
          </button>
        </div>
      </header>

      {isMobileMenuOpen && (
        <div className="editorial-menu-overlay" role="dialog" aria-modal="true" aria-labelledby="editorial-menu-title">
          <button
            type="button"
            aria-label="Close menu"
            className="editorial-menu-backdrop"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <aside className="editorial-menu-panel">
            <div className="editorial-menu-top">
              <h2 id="editorial-menu-title">Navigate</h2>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} aria-label="Close menu">
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Mobile navigation">
              {mobileNavigation.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setIsMobileMenuOpen(false)}>
                  <item.icon size={18} aria-hidden="true" />
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      {isProfileOpen && (
        <div className="editorial-menu-overlay" role="dialog" aria-modal="true" aria-labelledby="profile-title">
          <button
            type="button"
            aria-label="Close profile menu"
            className="editorial-menu-backdrop"
            onClick={() => setIsProfileOpen(false)}
          />
          <aside className="editorial-menu-panel">
            <div className="editorial-menu-top">
              <h2 id="profile-title">My Profile</h2>
              <button type="button" onClick={() => setIsProfileOpen(false)} aria-label="Close profile menu">
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <nav aria-label="Profile links">
              {profileLinks.map((item) => (
                <Link key={item.href} href={item.href} onClick={() => setIsProfileOpen(false)}>
                  <item.icon size={18} aria-hidden="true" />
                  <span>
                    <strong>{item.label}</strong>
                    <small>Al-Arab customer care</small>
                  </span>
                </Link>
              ))}
            </nav>
          </aside>
        </div>
      )}

      <section className="editorial-hero" aria-labelledby="welcome-heading">
        <div className="editorial-hero-inner">
          <p className="editorial-kicker">A feast for every sense</p>
          <h1 id="welcome-heading" className="editorial-hero-title">
            <span>Welcome to</span>
            <EchoStack text="Al-Arab" />
          </h1>
          <p className="editorial-hero-copy">
            Fire-kissed grills, fragrant mandi, and recipes carried through generations.
          </p>

          <div className="editorial-order-panel" aria-label="Ordering actions">
            <button
              type="button"
              onClick={() => setIsLocationSearchOpen(true)}
              className={`editorial-location ${locationTone}`}
            >
              <span>
                {deliveryLocation.status === "locating" ? (
                  <LoaderCircle size={18} className="animate-spin" />
                ) : deliveryLocation.status === "eligible" ? (
                  <CheckCircle2 size={18} />
                ) : deliveryLocation.status === "outside" || deliveryLocation.status === "error" ? (
                  <AlertTriangle size={18} />
                ) : (
                  <MapPin size={18} />
                )}
              </span>
              <strong>
                {deliveryLocation.status === "eligible"
                  ? `Delivery available - ${deliveryLocation.distanceKm?.toFixed(1)} km`
                  : deliveryLocation.status === "outside"
                    ? "Outside delivery area"
                    : `Delivery within ${DELIVERY_RADIUS_KM} km`}
              </strong>
              <small>{deliveryLocation.label}</small>
            </button>

            <div className="editorial-order-actions">
              <button
                type="button"
                onClick={chooseDelivery}
                disabled={deliveryLocation.status === "outside"}
              >
                <Bike size={18} aria-hidden="true" />
                Delivery
              </button>
              <button type="button" onClick={() => setShowDineInScanner(true)}>
                <QrCode size={18} aria-hidden="true" />
                Dine-in
              </button>
              <button type="button" onClick={chooseTakeaway}>
                <Package size={18} aria-hidden="true" />
                Takeaway
              </button>
              <Link href="/mobile">
                <Search size={18} aria-hidden="true" />
                Menu
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section id="philosophy" className="editorial-section editorial-philosophy">
        <div className="editorial-hairline" aria-hidden="true" />
        <p className="editorial-kicker">Philosophy</p>
        <h2>
          Food should feel <em>precise</em>, generous, and unmistakably memorable.
        </h2>
        <div className="editorial-principles">
          <article>
            <h3>01. Fire</h3>
            <p>Grills, shawarma, and mandi prepared for depth rather than noise.</p>
          </article>
          <article>
            <h3>02. Timing</h3>
            <p>Fast ordering paths for delivery, dine-in, tracking, and support.</p>
          </article>
          <article>
            <h3>03. Warmth</h3>
            <p>A modern customer flow wrapped around traditional Arabic hospitality.</p>
          </article>
        </div>
      </section>

      <section id="showcase" className="editorial-section editorial-showcase">
        <div className="editorial-section-heading">
          <p className="editorial-kicker">Showcase</p>
          <h2>Earthy structure. Fire where it matters.</h2>
        </div>
        <div className="editorial-showcase-grid">
          {showcaseImages.map((image) => (
            <figure key={image.label} className={image.className}>
              <Image
                src={image.src}
                alt={image.alt}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className={image.imageClassName}
              />
              <figcaption>{image.label}</figcaption>
            </figure>
          ))}
        </div>
      </section>

      <section id="services" className="editorial-section editorial-services">
        <div className="editorial-section-heading">
          <p className="editorial-kicker">Services</p>
          <h2>Everything important, without visual clutter.</h2>
        </div>
        <div className="editorial-service-grid">
          <article>
            <span className="editorial-geo-icon">01</span>
            <h3>Delivery</h3>
            <p>Set your location, confirm the delivery radius, and enter the menu.</p>
            <button type="button" onClick={() => setIsLocationSearchOpen(true)}>
              Set location <ArrowRight size={16} />
            </button>
          </article>
          <article>
            <span className="editorial-geo-icon">02</span>
            <h3>Dine-in QR</h3>
            <p>Scan a table QR and continue ordering from the customer menu.</p>
            <button type="button" onClick={() => setShowDineInScanner(true)}>
              Scan table <ArrowRight size={16} />
            </button>
          </article>
          <article>
            <span className="editorial-geo-icon">03</span>
            <h3>Customer Care</h3>
            <p>Support, FAQs, order tracking, and profile links stay one tap away.</p>
            <Link href="/support">
              Get support <ArrowRight size={16} />
            </Link>
          </article>
        </div>
      </section>

      <section className="editorial-section editorial-featured">
        <div className="editorial-section-heading">
          <p className="editorial-kicker">Featured</p>
          <h2>The table favorites.</h2>
        </div>
        <div className="editorial-featured-grid">
          {featuredItems.map((item) => (
            <Link key={item.id} href="/mobile" className="editorial-dish">
              <span>{item.name}</span>
              <small>Rs {item.price}</small>
              <b>
                <Star size={13} className={item.reviews > 0 ? "fill-current" : ""} />
                {item.reviews > 0
                  ? `${item.rating} (${item.reviews})`
                  : "New"}
              </b>
            </Link>
          ))}
        </div>
      </section>

      <footer className="editorial-footer">
        <div>
          <h2>Al-Arab</h2>
          <p>Premium Arabic food delivery, dine-in ordering, and customer support.</p>
        </div>
        <nav aria-label="Footer navigation">
          <h3>Navigate</h3>
          <Link href="/mobile">Menu</Link>
          <Link href="/checkout">Checkout</Link>
          <Link href="/orders/track">Track Order</Link>
        </nav>
        <nav aria-label="Company links">
          <h3>Company</h3>
          <Link href="/about">About</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/privacy">Privacy</Link>
        </nav>
        <address>
          <h3>Contact</h3>
          <a href={phoneHref}><PhoneCall size={16} /> {restaurant.phone}</a>
          <span><Clock3 size={16} /> Lunch to late evening</span>
          <span><MapPin size={16} /> Bengaluru service area</span>
        </address>
      </footer>
    </main>
  );
}
