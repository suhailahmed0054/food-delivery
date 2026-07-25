"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { FormEvent, Suspense, useMemo, useState, useEffect, useCallback, useRef } from "react";
import {
  ArrowLeft,
  Home,
  Minus,
  Plus,
  Receipt,
  ShoppingBag,
  Trash2,
  Wallet,
  MapPin,
  X,
  Crosshair,
  Briefcase,
  UtensilsCrossed,
  AlertTriangle,
  CheckCircle2,
  Bike,
  QrCode,
  ShoppingCart,
  User
} from "lucide-react";
import LiquidGlass from "@/components/LiquidGlass";
import { TableSessionTracker } from "@/components/TableSessionTracker";
import { DineInScanner } from "@/components/DineInScanner";
import {
  addCustomerAddress,
  createOrder,
  fetchCustomerAccount,
  fetchPublicRestaurantSettings,
  quoteOrder,
  type OrderQuoteData
} from "@/lib/api";
import { clearTableSession, readStoredTableSession, type TableSession } from "@/lib/table-session";
import { persistSessionDeliveryAddress, readSessionDeliveryAddress } from "@/lib/delivery-session";
import { parseSavedOrders, type SavedOrder } from "@/lib/saved-orders";
import { useCartStore } from "@/store/cart-store";
import {
  OUTSIDE_DELIVERY_MESSAGE,
  RESTAURANT_BRANCH,
  evaluateDeliveryLocation
} from "@/lib/delivery-zone";
import { readSessionDeliveryLocation } from "@/lib/delivery-location-session";
import { getPreciseCurrentPosition } from "@/lib/precise-geolocation";
import { getCheckoutLoginPath } from "@/lib/auth-navigation";

const LocationPicker = dynamic(
  () => import("@/components/LocationPicker"),
  { ssr: false }
);

const CHECKOUT_IDEMPOTENCY_STORAGE_KEY =
  "al-arab-checkout-idempotency-key";

function createCheckoutIdempotencyKey() {
  if (typeof window === "undefined") return "";

  const stored = window.sessionStorage.getItem(
    CHECKOUT_IDEMPOTENCY_STORAGE_KEY
  );
  if (stored && /^[A-Za-z0-9._~-]{16,128}$/.test(stored)) return stored;

  const key =
    typeof window.crypto.randomUUID === "function"
      ? window.crypto.randomUUID()
      : Array.from(window.crypto.getRandomValues(new Uint8Array(24)), (byte) =>
          byte.toString(16).padStart(2, "0")
        ).join("");
  window.sessionStorage.setItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY, key);
  return key;
}

interface SavedAddress {
  id: string;
  type: "Home" | "Work" | "Other";
  street: string;
  city: string;
  zip: string;
  phone: string;
  latitude?: number;
  longitude?: number;
  deliveryDistanceKm?: number;
}

type DeliveryLocationCheck = {
  status: "unchecked" | "checking" | "eligible" | "outside" | "error";
  distanceKm?: number;
  message?: string;
};

type CheckoutAuthStatus = "checking" | "authenticated" | "redirecting";

const defaultAddresses: SavedAddress[] = [];

const addressTypes: Array<{
  id: SavedAddress["type"];
  icon: typeof Home;
}> = [
  { id: "Home", icon: Home },
  { id: "Work", icon: Briefcase },
  { id: "Other", icon: MapPin }
];

function money(value: number) {
  return `₹${value.toLocaleString("en-IN")}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const {
    items,
    promoCode,
    removeItem,
    setQuantity,
    applyPromo,
    clearCart
  } = useCartStore();

  // Base State
  const [customer, setCustomer] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerAccountId, setCustomerAccountId] = useState<string | null>(null);
  const [deliveryTime, setDeliveryTime] = useState("ASAP");
  const [instructions, setInstructions] = useState("");
  const [promo, setPromo] = useState(promoCode);
  const [appliedCoupon, setAppliedCoupon] = useState(promoCode);
  const [serverQuote, setServerQuote] = useState<OrderQuoteData | null>(null);
  const [isQuoteLoading, setIsQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const [notice, setNotice] = useState("");
  const [isPlacing, setIsPlacing] = useState(false);
  const checkoutIdempotencyKeyRef = useRef<string | null>(null);
  const [isSessionVerifying, setIsSessionVerifying] = useState(false);
  const [authStatus, setAuthStatus] = useState<CheckoutAuthStatus>("checking");
  const [tableSession, setTableSession] = useState<TableSession | null>(null);
  const [tableError, setTableError] = useState("");
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [showDineInScanner, setShowDineInScanner] = useState(false);

  // Address List State
  const [addresses, setAddresses] = useState<SavedAddress[]>(defaultAddresses);
  const [selectedAddressId, setSelectedAddressId] = useState<string>(defaultAddresses[0]?.id || "");

  // --- Real Geolocation & Map State ---
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [isSavingAddress, setIsSavingAddress] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number }>({
    lat: RESTAURANT_BRANCH.latitude,
    lng: RESTAURANT_BRANCH.longitude
  });
  const [locationSub, setLocationSub] = useState<string>(RESTAURANT_BRANCH.plusCode);
  const [locationCheck, setLocationCheck] = useState<DeliveryLocationCheck>({ status: "unchecked" });
  const [addressFormError, setAddressFormError] = useState("");
  const locationLookupIdRef = useRef(0);

  const [newAddressForm, setNewAddressForm] = useState({
    doorNo: "",
    area: "",
    landmark: "",
    phone: ""
  });
  const [newAddressType, setNewAddressType] = useState<"Home" | "Work" | "Other">("Home");

  const clientSubtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
    [items]
  );
  const tableNumber = tableSession?.tableNumber ?? null;
  const isDineIn = Boolean(tableSession);
  const subtotal = serverQuote?.subtotal ?? clientSubtotal;
  const discountAmount = serverQuote?.discount ?? 0;
  const tax = serverQuote?.tax ?? 0;
  const deliveryFee = serverQuote?.deliveryFee ?? 0;
  const total = serverQuote?.total ?? clientSubtotal;
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const selectedAddress = useMemo(
    () => addresses.find((address) => address.id === selectedAddressId),
    [addresses, selectedAddressId]
  );

  const selectedDeliveryZone = useMemo(() => {
    if (
      selectedAddress?.latitude === undefined ||
      selectedAddress.longitude === undefined
    ) {
      return null;
    }

    return evaluateDeliveryLocation({
      lat: selectedAddress.latitude,
      lng: selectedAddress.longitude
    });
  }, [selectedAddress]);

  // MISSING FUNCTIONS ADDED HERE:
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

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    if (items.length === 0) {
      setServerQuote(null);
      setQuoteError("");
      setIsQuoteLoading(false);
      return;
    }

    let cancelled = false;
    const timer = window.setTimeout(() => {
      setIsQuoteLoading(true);
      setQuoteError("");
      void quoteOrder({
        items: items.map((line) => ({
          menuItem: line.item.id,
          name: line.item.name,
          quantity: line.quantity,
          customization: {
            ...line.customization,
            addOns: [...line.customization.addOns]
          }
        })),
        orderType: isDineIn ? "dine_in" : "delivery",
        couponCode: appliedCoupon || undefined,
        phone: selectedAddress?.phone
      })
        .then((quote) => {
          if (!cancelled) setServerQuote(quote);
        })
        .catch((error) => {
          if (cancelled) return;
          setServerQuote(null);
          setQuoteError(
            error instanceof Error
              ? error.message
              : "Unable to verify current prices"
          );
        })
        .finally(() => {
          if (!cancelled) setIsQuoteLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [appliedCoupon, authStatus, isDineIn, items, selectedAddress?.phone]);

  useEffect(() => {
    if (promoCode && !promo && !appliedCoupon) {
      setPromo(promoCode);
      setAppliedCoupon(promoCode);
    }
  }, [appliedCoupon, promo, promoCode]);

  useEffect(() => {
    if (authStatus !== "authenticated") return;

    setTableSession(readStoredTableSession());
    try {
      const storedProfile = window.localStorage.getItem("al-arab-profile");
      const storedUser = window.localStorage.getItem("al-arab-user");
      const profile = storedProfile
        ? (JSON.parse(storedProfile) as { email?: unknown })
        : null;
      const user = storedUser
        ? (JSON.parse(storedUser) as { name?: unknown; email?: unknown })
        : null;
      const savedEmail = profile?.email ?? user?.email;
      if (typeof user?.name === "string") {
        setCustomer(user.name);
      }
      if (typeof savedEmail === "string") {
        setCustomerEmail(savedEmail);
      }
    } catch {
      // Checkout remains usable when an old local profile cannot be parsed.
    }

    const storedLocation = readSessionDeliveryLocation();
    if (storedLocation) {
      const deliveryZone = evaluateDeliveryLocation({
        lat: storedLocation.latitude,
        lng: storedLocation.longitude
      });
      setCoords({
        lat: storedLocation.latitude,
        lng: storedLocation.longitude
      });
      setLocationSub(storedLocation.displayName);
      setLocationCheck({
        status: deliveryZone.isWithinDeliveryZone
          ? "eligible"
          : "outside",
        distanceKm: deliveryZone.distanceKm,
        message: deliveryZone.isWithinDeliveryZone
          ? `Delivery is available at your location, ${deliveryZone.formattedDistance} from our branch.`
          : OUTSIDE_DELIVERY_MESSAGE
      });
    }

    const storedAddress = readSessionDeliveryAddress();
    if (storedAddress) {
      const addressType: SavedAddress["type"] =
        storedAddress.label === "Home" || storedAddress.label === "Work"
          ? storedAddress.label
          : "Other";
      const sessionAddress: SavedAddress = {
        id: "addr_session",
        type: addressType,
        street: storedAddress.address,
        city: "",
        zip: "",
        phone: storedAddress.phone ?? "",
        latitude: storedAddress.latitude,
        longitude: storedAddress.longitude
      };
      setAddresses((currentAddresses) => [
        sessionAddress,
        ...currentAddresses.filter((address) => address.id !== sessionAddress.id)
      ]);
      setSelectedAddressId(sessionAddress.id);
    }
  }, [authStatus]);

  useEffect(() => {
    let cancelled = false;

    void fetchCustomerAccount()
      .then((account) => {
        if (cancelled) return;

        setCustomerAccountId(account.id);
        setCustomer(account.name);
        setCustomerEmail(account.email);
        window.localStorage.setItem(
          "al-arab-user",
          JSON.stringify({
            id: account.id,
            name: account.name,
            email: account.email,
            role: "customer"
          })
        );

        const accountAddresses = account.addresses.map((address): SavedAddress => ({
          id: address.id,
          type:
            address.label === "Home" || address.label === "Work"
              ? address.label
              : "Other",
          street: address.address,
          city: "",
          zip: "",
          phone: address.phone ?? account.phone,
          latitude: address.latitude,
          longitude: address.longitude
        }));
        const defaultAddressId =
          account.addresses.find((address) => address.isDefault)?.id ??
          accountAddresses[0]?.id;

        setAddresses((current) => {
          const sessionAddress = current.find(
            (address) => address.id === "addr_session"
          );
          const next = [
            ...(sessionAddress ? [sessionAddress] : []),
            ...accountAddresses.filter(
              (address) => address.id !== sessionAddress?.id
            )
          ];
          setSelectedAddressId((currentId) =>
            currentId || sessionAddress?.id || defaultAddressId || ""
          );
          return next;
        });
        setAuthStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;

        setAuthStatus("redirecting");
        const currentPath = `${window.location.pathname}${window.location.search}`;
        router.replace(getCheckoutLoginPath(currentPath));
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  function updateQuantity(lineId: string, quantity: number) {
    if (quantity < 1) {
      removeItem(lineId);
      return;
    }
    setQuantity(lineId, quantity);
  }

  function handleApplyPromo() {
    const normalized = promo.trim().toUpperCase();
    setPromo(normalized);
    setAppliedCoupon(normalized);
    applyPromo(normalized);
  }

  function goBack() {
    if (window.history.length > 1) {
      router.back();
      return;
    }
    router.push("/mobile");
  }

  const verifyPinnedLocation = useCallback(async (lat: number, lng: number) => {
    const lookupId = ++locationLookupIdRef.current;
    setCoords({ lat, lng });
    setAddressFormError("");
    setLocationCheck({ status: "checking" });

    const deliveryZone = evaluateDeliveryLocation({ lat, lng });
    let displayName = "Pinned location";

    try {
      const response = await fetch(
        `/api/reverse-geocode?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
      );
      if (!response.ok) throw new Error("Reverse geocoding failed");
      const data = await response.json() as { displayName?: string };
      displayName = data.displayName?.trim() || displayName;
    } catch (error) {
      console.error("Error fetching address details", error);
    }

    if (lookupId !== locationLookupIdRef.current) return;

    setLocationSub(displayName);
    setLocationCheck({
      status: deliveryZone.isWithinDeliveryZone ? "eligible" : "outside",
      distanceKm: deliveryZone.distanceKm,
      message: deliveryZone.isWithinDeliveryZone
        ? `Delivery is available at this pin, ${deliveryZone.formattedDistance} from our branch.`
        : OUTSIDE_DELIVERY_MESSAGE
    });
  }, []);

  const handleLocateMe = () => {
    setIsLocating(true);
    setAddressFormError("");
    setLocationCheck({ status: "checking" });

    if ("geolocation" in navigator) {
      void getPreciseCurrentPosition()
        .then(async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          await verifyPinnedLocation(lat, lng);
          setIsLocating(false);
        })
        .catch((error: GeolocationPositionError | Error) => {
          const permissionDenied =
            "code" in error && error.code === 1;
          setLocationCheck({
            status: "error",
            message: permissionDenied
              ? "Location permission is blocked. Allow location access in your browser settings and try again."
              : "We could not detect your location. Check GPS and try again."
          });
          setIsLocating(false);
        });
    } else {
      setLocationCheck({
        status: "error",
        message: "Geolocation is not supported by your device or browser."
      });
      setIsLocating(false);
    }
  };

  const handleMapPositionChange = useCallback((lat: number, lng: number) => {
    void verifyPinnedLocation(lat, lng);
  }, [verifyPinnedLocation]);

  const handleSaveNewAddress = async () => {
    setAddressFormError("");
    if (locationCheck.status !== "eligible") {
      setLocationCheck((current) => ({
        ...current,
        status: current.status === "outside" ? "outside" : "error",
        message:
          current.status === "outside"
            ? OUTSIDE_DELIVERY_MESSAGE
            : "Use your current location before saving this delivery address."
      }));
      return;
    }

    if (
      !newAddressForm.doorNo.trim() ||
      !newAddressForm.area.trim() ||
      !newAddressForm.phone.trim()
    ) {
      setAddressFormError(
        "Enter your door number, area and phone number."
      );
      return;
    }

    let newAddr: SavedAddress = {
      id: `addr_${Date.now()}`,
      type: newAddressType,
      street: `${newAddressForm.doorNo}, ${newAddressForm.area} ${newAddressForm.landmark ? `(Opp. ${newAddressForm.landmark})` : ''}`,
      city: locationSub,
      zip: "560000",
      phone: newAddressForm.phone.trim(),
      latitude: coords.lat,
      longitude: coords.lng,
      deliveryDistanceKm: locationCheck.distanceKm
    };

    if (customerAccountId) {
      setIsSavingAddress(true);
      try {
        const savedAddress = await addCustomerAddress({
          label: newAddr.type,
          address: [newAddr.street, newAddr.city].filter(Boolean).join(", "),
          phone: newAddr.phone,
          latitude: newAddr.latitude,
          longitude: newAddr.longitude
        });
        newAddr = {
          ...newAddr,
          id: savedAddress.id
        };
      } catch (error) {
        setAddressFormError(
          error instanceof Error
            ? error.message
            : "Unable to save this address to your account."
        );
        return;
      } finally {
        setIsSavingAddress(false);
      }
    }

    setAddresses([newAddr, ...addresses]);
    setSelectedAddressId(newAddr.id);
    persistSessionDeliveryAddress({
      label: newAddr.type,
      address: [newAddr.street, newAddr.city].filter(Boolean).join(", "),
      phone: newAddr.phone,
      latitude: newAddr.latitude,
      longitude: newAddr.longitude
    });
    setShowAddressModal(false);
    setNewAddressForm({ doorNo: "", area: "", landmark: "", phone: "" });
    setNewAddressType("Home");
  };

  async function placeOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSessionVerifying || isPlacing) return;

    setIsSessionVerifying(true);
    try {
      await fetchCustomerAccount();
    } catch {
      setAuthStatus("redirecting");
      const currentPath = `${window.location.pathname}${window.location.search}`;
      router.replace(getCheckoutLoginPath(currentPath));
      return;
    } finally {
      setIsSessionVerifying(false);
    }

    if (!items.length) {
      setNotice("Add items to your cart before checkout.");
      return;
    }

    if (tableError || isTableLoading) {
      setNotice(tableError || "Please wait while we verify your table QR code.");
      return;
    }

    if (!customer.trim() || (!isDineIn && !selectedAddress)) {
      setNotice(isDineIn ? "Enter your name before placing the order." : "Enter your name and select a delivery address.");
      return;
    }

    if (!isDineIn && !selectedDeliveryZone?.isWithinDeliveryZone) {
      setNotice(
        selectedDeliveryZone
          ? OUTSIDE_DELIVERY_MESSAGE
          : "Please use your current location so we can confirm that you are within our delivery area."
      );
      return;
    }

    if (isQuoteLoading) {
      setNotice("Please wait while we verify current prices.");
      return;
    }
    if (!serverQuote || quoteError) {
      setNotice(
        quoteError || "Current prices could not be verified. Please retry."
      );
      return;
    }
    if (!serverQuote.canOrder) {
      setNotice(
        `Minimum delivery order is ₹${serverQuote.minimumOrder}. Add ₹${serverQuote.amountToMinimum} more.`
      );
      return;
    }
    if (serverQuote.coupon && !serverQuote.coupon.applied) {
      setNotice(serverQuote.coupon.message);
      return;
    }

    setIsPlacing(true);
    setNotice("");

    try {
      const latestSettings = await fetchPublicRestaurantSettings();
      if (!latestSettings.restaurantOpen) {
        setNotice(
          "Restaurant is not live and is not accepting orders right now."
        );
        return;
      }
      if (!latestSettings.cashEnabled) {
        setNotice("Cash payments are currently unavailable.");
        return;
      }

      checkoutIdempotencyKeyRef.current ??= createCheckoutIdempotencyKey();
      const apiOrder = await createOrder(
        {
          items: items.map((line) => ({
            menuItem: line.item.id,
            name: line.item.name,
            quantity: line.quantity,
            customization: {
              ...line.customization,
              addOns: [...line.customization.addOns]
            }
          })),
          couponCode: appliedCoupon || undefined,
          paymentMethod: "cash_on_delivery",
          paymentStatus: "pending",
          orderType: isDineIn ? "dine_in" : "delivery",
          tableToken: tableSession?.token,
          customerName: customer.trim(),
          phone: isDineIn ? undefined : selectedAddress?.phone,
          email: customerEmail.trim() || undefined,
          address: isDineIn
            ? undefined
            : [selectedAddress?.street, selectedAddress?.city]
                .filter(Boolean)
                .join(", "),
          deliveryLatitude: isDineIn
            ? undefined
            : selectedAddress?.latitude,
          deliveryLongitude: isDineIn
            ? undefined
            : selectedAddress?.longitude,
          deliveryTime,
          specialInstructions: instructions.trim() || undefined
        },
        checkoutIdempotencyKeyRef.current
      );
      const orderId = apiOrder.orderNumber;
      const formattedAddress = isDineIn
        ? ""
        : [selectedAddress?.street, selectedAddress?.city].filter(Boolean).join(", ");

      const order: SavedOrder = {
        id: orderId,
        customer: customer.trim(),
        phone: selectedAddress?.phone ?? "",
        email: customerEmail.trim() || undefined,
        address: formattedAddress,
        deliveryLatitude: isDineIn ? undefined : selectedAddress?.latitude,
        deliveryLongitude: isDineIn ? undefined : selectedAddress?.longitude,
        deliveryDistanceKm: isDineIn
          ? undefined
          : selectedDeliveryZone?.distanceKm,
        deliveryTime,
        instructions: instructions.trim(),
        paymentMethod: "cash_on_delivery",
        paymentStatus: apiOrder.paymentStatus ?? "pending",
        orderType: isDineIn ? "dine_in" : "delivery",
        tableNumber: tableNumber ? String(tableNumber) : undefined,
        status: apiOrder.status || (isDineIn ? "pending" : "placed"),
        trackingToken: apiOrder.trackingToken,
        estimatedDeliveryAt: apiOrder.estimatedDeliveryAt,
        updatedAt: apiOrder.updatedAt,
        statusHistory: apiOrder.statusHistory,
        deliveryAgent: apiOrder.deliveryAgent,
        items: apiOrder.items.map((line, index) => ({
          itemId: line.menuItem || items[index]?.item.id,
          name: line.name,
          quantity: line.quantity,
          unitPrice: line.price,
          total: line.price * line.quantity,
          customization:
            line.customization ?? items[index]?.customization
        })),
        subtotal: apiOrder.subtotal ?? serverQuote.subtotal,
        discount: apiOrder.discount ?? serverQuote.discount,
        couponCode: apiOrder.couponCode,
        tax: apiOrder.tax ?? serverQuote.tax,
        deliveryFee: apiOrder.deliveryFee ?? serverQuote.deliveryFee,
        total: apiOrder.total,
        createdAt: apiOrder.createdAt ?? new Date().toISOString()
      };

      const stored = window.localStorage.getItem("al-arab-orders");
      const orders = parseSavedOrders(stored);
      window.localStorage.setItem(
        "al-arab-orders",
        JSON.stringify([
          order,
          ...orders.filter((savedOrder) => savedOrder.id !== order.id)
        ])
      );

      clearCart();
      checkoutIdempotencyKeyRef.current = null;
      window.sessionStorage.removeItem(CHECKOUT_IDEMPOTENCY_STORAGE_KEY);
      router.replace(`/orders?placed=${orderId}`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Unable to place order. Please try again.");
    } finally {
      setIsPlacing(false);
    }
  }

  if (authStatus !== "authenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] px-6 text-white">
        <div role="status" className="flex flex-col items-center gap-4 text-center">
          <span
            aria-hidden="true"
            className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-yellow-500"
          />
          <p className="text-sm font-bold text-white/75">
            {authStatus === "redirecting"
              ? "Taking you to sign in..."
              : "Checking your account..."}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="customer-checkout-page min-h-screen bg-[#080808] text-white relative selection:bg-yellow-500/30">
      {/* Background Ambient Glow */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[10%] -left-[10%] w-[50%] h-[50%] rounded-full bg-yellow-500/5 blur-[120px]" />
        <div className="absolute top-[40%] -right-[10%] w-[40%] h-[60%] rounded-full bg-primary/5 blur-[100px]" />
      </div>

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

      {/* --- ADDRESS MODAL (FROSTED GLASS) --- */}
      {showAddressModal && (
        <div className="checkout-address-overlay fixed inset-0 z-50 flex h-[100dvh] items-end justify-center overflow-hidden bg-black/60 p-0 backdrop-blur-md sm:items-center sm:p-4">
          <LiquidGlass
            refraction={12}
            className="checkout-address-sheet flex h-[96dvh] min-h-0 w-full max-w-md flex-col overflow-hidden !bg-[#0a0a0a]/80 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] sm:h-auto sm:max-h-[92dvh] sm:rounded-3xl"
          >
            <header className="checkout-address-header flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
              <div>
                <h3 className="font-heading text-lg font-bold text-white sm:text-xl">Add Delivery Address</h3>
                <p className="mt-1 text-xs text-white/50">Pinpoint your location for faster delivery.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowAddressModal(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                <X size={19} />
              </button>
            </header>

            <form onSubmit={(e) => { e.preventDefault(); void handleSaveNewAddress(); }} className="checkout-address-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain">

              {/* Maps Area */}
              <div className="checkout-address-map relative h-64 w-full shrink-0 border-b border-white/10 bg-[#e9e4db]">
                <LocationPicker
                  latitude={coords.lat}
                  longitude={coords.lng}
                  onPositionChange={handleMapPositionChange}
                />
                <button
                  type="button"
                  onClick={handleLocateMe}
                  disabled={isLocating}
                  className="location-current-button absolute bottom-4 left-4 z-[1000] flex items-center gap-2 rounded-full border border-white/25 bg-[#3E2723] px-4 py-2.5 text-xs font-black text-white shadow-lg transition hover:bg-[#542f28] disabled:opacity-60"
                >
                  <Crosshair size={14} className={isLocating ? "animate-spin text-yellow-500" : "text-yellow-500"} />
                  {isLocating ? "Locating..." : "Use Current Location"}
                </button>
              </div>

              <div className="space-y-5 p-5 sm:p-6">
                {/* Location Status */}
                {locationCheck.status !== "unchecked" && (
                  <div className={`rounded-xl border p-4 text-xs font-bold ${
                    locationCheck.status === "eligible"
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : locationCheck.status === "checking"
                        ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400 animate-pulse"
                        : "border-red-500/30 bg-red-500/10 text-red-400"
                  }`}>
                    {locationCheck.status === "checking" ? "Verifying your location..." : locationCheck.message}
                  </div>
                )}

                {/* Form Inputs */}
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-white/50">Flat / Door No.</span>
                  <input
                    required
                    value={newAddressForm.doorNo}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, doorNo: e.target.value })}
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none backdrop-blur-md transition-all placeholder:text-white/30 focus:border-yellow-500/50 focus:bg-white/[0.05]"
                    placeholder="e.g. 101, Prestige Apartments"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-white/50">Street / Area</span>
                  <input
                    required
                    value={newAddressForm.area}
                    onChange={(e) => setNewAddressForm({ ...newAddressForm, area: e.target.value })}
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none backdrop-blur-md transition-all placeholder:text-white/30 focus:border-yellow-500/50 focus:bg-white/[0.05]"
                    placeholder="e.g. 5th Phase, JP Nagar"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-white/50">Landmark</span>
                    <input
                      value={newAddressForm.landmark}
                      onChange={(e) => setNewAddressForm({ ...newAddressForm, landmark: e.target.value })}
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none backdrop-blur-md transition-all placeholder:text-white/30 focus:border-yellow-500/50 focus:bg-white/[0.05]"
                      placeholder="Optional"
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-white/50">Phone Number</span>
                    <input
                      required
                      type="tel"
                      value={newAddressForm.phone}
                      onChange={(e) => setNewAddressForm({ ...newAddressForm, phone: e.target.value })}
                      className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none backdrop-blur-md transition-all placeholder:text-white/30 focus:border-yellow-500/50 focus:bg-white/[0.05]"
                      placeholder="Delivery contact"
                    />
                  </label>
                </div>

                {/* Address Type Selection */}
                <div className="pt-2">
                  <span className="mb-2.5 block text-[10px] font-black uppercase tracking-wider text-white/50">Save As</span>
                  <div className="flex gap-2">
                    {addressTypes.map((type) => (
                      <button
                        key={type.id}
                        type="button"
                        onClick={() => setNewAddressType(type.id)}
                        className={`flex flex-1 items-center justify-center gap-2 rounded-xl border py-2.5 text-xs font-bold transition-all ${
                          newAddressType === type.id
                            ? "border-yellow-500/50 bg-yellow-500/20 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                            : "border-white/10 bg-white/[0.03] text-white/60 hover:bg-white/[0.08] hover:text-white"
                        }`}
                      >
                        <type.icon size={14} />
                        {type.id}
                      </button>
                    ))}
                  </div>
                </div>

                {addressFormError && (
                  <p role="alert" className="text-xs font-semibold text-red-400">
                    {addressFormError}
                  </p>
                )}
              </div>

              <footer className="sticky bottom-0 z-20 shrink-0 border-t border-white/10 bg-[#0a0a0a]/90 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] backdrop-blur-xl sm:p-6">
                <button
                  type="submit"
                  disabled={isSavingAddress || locationCheck.status !== "eligible"}
                  className="relative w-full h-14 rounded-2xl bg-yellow-500 text-black font-black text-base shadow-[0_0_30px_rgba(234,179,8,0.2)] hover:scale-[1.02] active:scale-[0.98] transition-all overflow-hidden group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    {isSavingAddress ? "Saving..." : "Save Address & Continue"}
                  </span>
                </button>
              </footer>
            </form>
          </LiquidGlass>
        </div>
      )}
      {/* -------------------------------------- */}

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/50 px-4 py-4 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>

          <div className="text-center">
            <p className="text-[9px] font-black uppercase tracking-widest text-yellow-500 sm:text-[10px]">Checkout</p>
            <h1 className="text-lg font-bold sm:text-xl">Complete Your Order</h1>
          </div>

          <Link
            href="/mobile"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
            aria-label="Menu"
          >
            <Home size={20} />
          </Link>
        </div>
      </header>

      <form onSubmit={placeOrder} className="relative z-10 mx-auto grid max-w-6xl gap-4 px-4 py-5 pb-28 lg:grid-cols-[1fr_390px]">
        <section className="space-y-4">
          {(tableError || isTableLoading) && (
            <div
              role={tableError ? "alert" : "status"}
              aria-live="polite"
              className={`rounded-2xl border p-4 text-sm font-bold ${
                tableError
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-yellow-500/30 bg-yellow-500/10 text-yellow-100"
              }`}
            >
              {tableError || "Verifying your table QR code..."}
            </div>
          )}
          <LiquidGlass refraction={8} className="checkout-card w-full p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3 sm:mb-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-yellow-500/10 text-yellow-500 border border-yellow-500/20">
                <MapPin size={18} />
              </span>
              <div>
                <h2 className="text-base font-bold text-white sm:text-lg">Order Details</h2>
                <p className="text-[11px] text-white/50 sm:text-xs">Delivery or Dine-in</p>
              </div>
            </div>

            {!isTableLoading && (
              <div className="checkout-mode-grid grid grid-cols-2 gap-3 mb-6">
                <button
                  type="button"
                  onClick={switchToDelivery}
                  aria-pressed={!tableSession}
                  className={`checkout-choice-button flex flex-col items-center justify-center gap-1.5 rounded-full border p-3 transition-all duration-300 sm:p-4 ${!tableSession ? "is-selected" : ""}`}
                >
                  <Bike size={24} />
                  <span className="text-xs font-black sm:text-sm">Delivery</span>
                  <small>Order to your door</small>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDineInScanner(true)}
                  aria-pressed={Boolean(tableSession)}
                  className={`checkout-choice-button flex flex-col items-center justify-center gap-1.5 rounded-full border p-3 transition-all duration-300 sm:p-4 ${tableSession ? "is-selected" : ""}`}
                >
                  <QrCode size={24} />
                  <span className="text-xs font-black sm:text-sm">Dine-In</span>
                  <small>Scan table QR</small>
                </button>
              </div>
            )}

            {/* Delivery Address Selection */}
            {!isDineIn && (
              <div className="space-y-4 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/50">Delivery Address</p>
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(true)}
                    className="text-xs font-bold uppercase tracking-wide text-[#D84315] transition hover:text-[#3E2723]"
                  >
                    + Add New
                  </button>
                </div>

                {addresses.length === 0 ? (
                  <button
                    type="button"
                    onClick={() => setShowAddressModal(true)}
                    className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[#3E2723]/15 bg-[#EFEBE9] py-8 text-sm font-bold text-[#7D6A61] transition hover:border-[#3E2723]/40 hover:text-[#3E2723]"
                  >
                    <Plus size={18} /> Add your delivery address
                  </button>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {addresses.map((address) => {
                      const Icon = addressTypes.find((t) => t.id === address.type)?.icon || MapPin;
                      const isSelected = selectedAddressId === address.id;

                      return (
                        <button
                          key={address.id}
                          type="button"
                          onClick={() => setSelectedAddressId(address.id)}
                          className={`flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-all ${
                            isSelected
                              ? "border-[#3E2723] bg-[#fffaf5] shadow-none"
                              : "border-[#3E2723]/10 bg-[#EFEBE9]/70 hover:border-[#3E2723]/30"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span className={`flex h-6 w-6 items-center justify-center rounded-full ${isSelected ? "bg-[#3E2723] text-[#fffaf5]" : "bg-[#EFEBE9] text-[#7D6A61]"}`}>
                              <Icon size={12} />
                            </span>
                            <span className={`text-xs font-black uppercase tracking-wider ${isSelected ? "text-[#3E2723]" : "text-[#7D6A61]"}`}>
                              {address.type}
                            </span>
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-bold leading-relaxed text-[#3E2723] sm:text-sm">
                            {address.street}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </LiquidGlass>

          {/* 2. CUSTOMER DETAILS */}
          <LiquidGlass refraction={8} className="checkout-card w-full p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3 sm:mb-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                <User size={18} />
              </span>
              <div>
                <h2 className="text-base font-bold text-white sm:text-lg">Contact Info</h2>
                <p className="text-[11px] text-white/50 sm:text-xs">For order updates</p>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/50">Full Name</span>
                <input
                  required
                  value={customer}
                  onChange={(e) => setCustomer(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none backdrop-blur-md transition-all placeholder:text-white/30 focus:border-yellow-500/50 focus:bg-white/[0.05]"
                  placeholder="John Doe"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/50">Email <span className="normal-case opacity-50">(Optional)</span></span>
                <input
                  type="email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none backdrop-blur-md transition-all placeholder:text-white/30 focus:border-yellow-500/50 focus:bg-white/[0.05]"
                  placeholder="john@example.com"
                />
              </label>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 pt-5 border-t border-white/10">
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/50">{isDineIn ? "Preparation time" : "Delivery time"}</span>
                <select
                  value={deliveryTime}
                  onChange={(event) => setDeliveryTime(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-black px-4 text-sm text-white outline-none focus:border-yellow-500/50 transition"
                >
                  <option>ASAP</option>
                  <option>Today 7:30 PM</option>
                  <option>Today 8:30 PM</option>
                  <option>Tomorrow 1:00 PM</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-white/50">Any Special Instructions?</span>
                <input
                  value={instructions}
                  onChange={(event) => setInstructions(event.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none backdrop-blur-md transition-all placeholder:text-white/30 focus:border-yellow-500/50 focus:bg-white/[0.05]"
                  placeholder="E.g. Extra spicy, less oil..."
                />
              </label>
            </div>
          </LiquidGlass>

          {/* 3. PAYMENT METHOD */}
          <LiquidGlass refraction={8} className="checkout-card w-full p-4 sm:p-6">
            <div className="mb-4 flex items-center gap-3 sm:mb-5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wallet size={18} />
              </span>
              <div>
                <h2 className="text-base font-bold text-white sm:text-lg">Payment Method</h2>
                <p className="text-[11px] text-white/50 sm:text-xs">Pay when your order arrives</p>
              </div>
            </div>

            <div className="grid gap-3">
              <div className="checkout-choice-button is-selected relative flex min-h-14 items-center justify-center gap-2.5 overflow-hidden rounded-full border px-3 text-xs font-black sm:px-4 sm:text-sm">
                <Wallet size={18} />
                <span className="relative z-10">
                  {isDineIn ? "Pay at Table" : "Cash on Delivery"}
                </span>
              </div>
            </div>
          </LiquidGlass>
        </section>


        {/* RIGHT COLUMN: ORDER SUMMARY (STICKY) */}
        <aside className="lg:sticky lg:top-24 w-full">
          <LiquidGlass refraction={12} className="checkout-card checkout-summary-card w-full p-4 sm:p-6">
            <div className="mb-5 flex items-center justify-between gap-3 border-b border-white/10 pb-4 sm:mb-6 sm:pb-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
                  <ShoppingBag size={18} />
                </span>
                <h2 className="text-base font-bold text-white sm:text-lg">Order Summary</h2>
              </div>
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#D84315] text-xs font-black text-[#fffaf5]">
                {itemCount}
              </span>
            </div>

            <div
              className={`mb-5 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-xs font-bold transition-colors ${
                quoteError
                  ? "border-red-500/30 bg-red-500/10 text-red-200"
                  : "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
              }`}
            >
              <span className="flex items-center gap-2">
                {quoteError ? <AlertTriangle size={14} /> : <CheckCircle2 size={14} />}
                {quoteError
                  ? "Price verification failed"
                  : isQuoteLoading
                    ? "Checking current prices..."
                    : serverQuote
                      ? "Prices verified by restaurant"
                      : "Waiting to verify prices"}
              </span>
              {isQuoteLoading && (
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
              )}
            </div>

            {tableSession && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm font-bold text-yellow-500">
                <UtensilsCrossed size={16} className="text-yellow-500" />
                Dine-in · {tableSession.label}
              </div>
            )}

            {items.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-black/40 p-5 text-center text-sm text-white/50">
                <ShoppingCart className="mx-auto mb-2 opacity-20" size={32} />
                Your cart is empty.
                <Link href="/mobile" className="mt-3 block font-bold text-yellow-500 hover:text-yellow-400 transition">
                  Browse menu
                </Link>
              </div>
            ) : (
              <div className="max-h-[300px] space-y-4 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                {items.map((line, index) => (
                  <div key={line.lineId} className="flex flex-col gap-2 rounded-xl border border-white/5 bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-white">{line.item.name}</p>
                        <p className="mt-0.5 text-[10px] text-white/50 uppercase tracking-wider">
                          {line.customization.size}, {line.customization.spiceLevel}
                        </p>
                        {line.customization.addOns.length > 0 && (
                          <p className="mt-0.5 text-[10px] text-white/50">{line.customization.addOns.join(", ")}</p>
                        )}
                      </div>
                      <p className="shrink-0 text-sm font-black text-yellow-500">
                        {money(
                          serverQuote?.items[index]?.lineTotal ??
                            line.unitPrice * line.quantity
                        )}
                      </p>
                    </div>

                    <div className="flex items-center justify-between gap-3 mt-1">
                      <div className="flex items-center gap-1 bg-black/40 rounded-lg p-0.5 border border-white/10">
                        <button
                          type="button"
                          onClick={() => updateQuantity(line.lineId, line.quantity - 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent hover:bg-white/10 text-white/70 transition"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="w-5 text-center text-xs font-bold text-white">{line.quantity}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(line.lineId, line.quantity + 1)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-transparent hover:bg-white/10 text-white/70 transition"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(line.lineId)}
                        className="flex h-7 w-7 items-center justify-center rounded-md text-red-400/70 hover:bg-red-500/20 hover:text-red-400 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 flex gap-2">
              <input
                value={promo}
                onChange={(event) => setPromo(event.target.value)}
                className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.03] px-4 text-sm text-white outline-none focus:border-yellow-500 transition backdrop-blur-sm placeholder:text-white/30 uppercase"
                placeholder="HAVE A PROMO CODE?"
              />
              <button
                type="button"
                onClick={handleApplyPromo}
                disabled={isQuoteLoading || items.length === 0 || !promo.trim()}
                className="h-12 rounded-xl bg-white/10 px-5 text-xs font-black text-white transition hover:bg-white/20 disabled:cursor-not-allowed disabled:opacity-50 border border-white/10"
              >
                {isQuoteLoading ? "..." : "APPLY"}
              </button>
            </div>

            {serverQuote?.coupon && (
              <p
                role={serverQuote.coupon.applied ? "status" : "alert"}
                className={`mt-3 rounded-lg border p-3 text-xs font-semibold text-center ${
                  serverQuote.coupon.applied
                    ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/30 bg-red-500/10 text-red-300"
                }`}
              >
                {serverQuote.coupon.message}
              </p>
            )}

            {quoteError && (
              <p role="alert" className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-300 text-center">
                {quoteError}
              </p>
            )}

            {serverQuote && !serverQuote.canOrder && (
              <p role="alert" className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3 text-xs font-semibold text-yellow-300 text-center">
                Minimum delivery order is {money(serverQuote.minimumOrder)}. Add{" "}
                {money(serverQuote.amountToMinimum)} more.
              </p>
            )}

            <div className="mt-6 space-y-3 border-t border-white/10 pt-5 text-sm">
              <div className="flex justify-between gap-3 text-white/70">
                <span>Subtotal</span>
                <span className="font-semibold text-white">{money(subtotal)}</span>
              </div>
              {discountAmount > 0 && (
                <div className="flex justify-between gap-3 text-emerald-400">
                  <span>Discount</span>
                  <span className="font-bold">- {money(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between gap-3 text-white/70">
                <span>
                  GST{" "}
                  {serverQuote
                    ? `${Number((serverQuote.taxRate * 100).toFixed(2))}%`
                    : ""}
                </span>
                <span className="font-semibold text-white">{money(tax)}</span>
              </div>
              <div className="flex justify-between gap-3 text-white/70">
                <span>{isDineIn ? "Service fee" : "Delivery fee"}</span>
                <span className="font-semibold text-white">{money(deliveryFee)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
                <span className="text-sm font-bold text-white sm:text-base">Grand Total</span>
                <span className="text-xl font-black text-yellow-500 drop-shadow-md sm:text-2xl">{money(total)}</span>
              </div>
            </div>

            {notice && (
              <p className="mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm font-bold text-yellow-500 text-center">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={
                !items.length ||
                isPlacing ||
                isSessionVerifying ||
                isQuoteLoading ||
                !serverQuote ||
                Boolean(quoteError) ||
                !serverQuote?.canOrder ||
                Boolean(serverQuote?.coupon && !serverQuote.coupon.applied) ||
                isTableLoading ||
                Boolean(tableError) ||
                (!isDineIn &&
                  !selectedDeliveryZone?.isWithinDeliveryZone)
              }
              className="checkout-confirm-button relative mt-6 flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-full border font-black transition-all hover:scale-[1.02] active:scale-[0.98] disabled:cursor-not-allowed disabled:hover:scale-100"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-in-out" />
              <Receipt size={18} className="relative z-10" />
              <span className="relative z-10 text-sm sm:text-base">
                {isSessionVerifying
                  ? "Checking Account..."
                  : isPlacing
                    ? "Placing Order..."
                  : isQuoteLoading
                    ? "Checking Prices..."
                    : quoteError
                      ? "Prices Unavailable"
                      : serverQuote && !serverQuote.canOrder
                        ? `Add ${money(serverQuote.amountToMinimum)} more`
                  : !isDineIn &&
                    !selectedDeliveryZone?.isWithinDeliveryZone
                  ? "Check Location to Order"
                  : "Confirm & Pay"}
              </span>
            </button>
          </LiquidGlass>
        </aside>
      </form>
    </main>
  );
}
