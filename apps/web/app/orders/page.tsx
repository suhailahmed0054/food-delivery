"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Bike,
  CheckCircle2,
  ChevronRight,
  Clock,
  MapPinned,
  PackageCheck,
  PhoneCall,
  Radio,
  RefreshCw,
  ShoppingBag,
  UtensilsCrossed,
  AlertTriangle,
  HelpCircle,
  XCircle,
  Camera,
  X,
  MessageCircle,
  Star
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import {
  fetchCustomerOrders,
  fetchMenu,
  fetchOrderTracking,
  getApiSocketUrl,
  cancelOrder,
  reportOrderIssue,
  fetchCustomerIssues,
  fetchOrderReviews,
  submitOrderReviews,
  type ApiOrder,
  type ApiOrderTracking,
  type CustomerReview,
  type SupportIssue
} from "@/lib/api";
import { buildReorderCartItems } from "@/lib/reorder";
import {
  parseSavedOrders,
  serializeSavedOrders,
  type SavedOrder
} from "@/lib/saved-orders";
import { useCustomer3DReveal } from "@/lib/use-customer-3d-reveal";
import { useCartStore } from "@/store/cart-store";

function money(value: number) {
  return `Rs ${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function normalizeStatus(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Pending",
    placed: "Placed",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    ready_for_pickup: "Ready",
    out_for_delivery: "Out for Delivery",
    served: "Served",
    collected: "Collected",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled"
  };
  const normalized = normalizeStatus(status);
  return labels[normalized] ?? status;
}

function isActiveStatus(status: string) {
  return !["delivered", "completed", "cancelled"].includes(
    normalizeStatus(status)
  );
}

function isCancelledStatus(status: string) {
  return normalizeStatus(status) === "cancelled";
}

function formatTrackingTime(value?: string) {
  if (!value) return "Calculating";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Calculating";

  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit"
  }).format(date);
}

function getTrackingSteps(order: SavedOrder) {
  const steps = order.orderType === "dine_in"
    ? ["Placed", "Accepted", "Preparing", "Ready", "Served"]
    : order.orderType === "takeaway"
      ? ["Placed", "Accepted", "Preparing", "Ready", "Collected"]
      : ["Placed", "Accepted", "Preparing", "Ready", "On the way"];
  const indexes: Record<string, number> = {
    pending: 0,
    placed: 0,
    accepted: 1,
    preparing: 2,
    ready: 3,
    ready_for_pickup: 3,
    out_for_delivery: 4,
    served: 4,
    collected: 4,
    delivered: 4,
    completed: 4,
    cancelled: -1
  };

  return {
    steps,
    activeIndex: indexes[normalizeStatus(order.status)] ?? 0
  };
}

function latestTrackingUpdate(order: SavedOrder) {
  return (
    order.updatedAt ??
    order.statusHistory?.at(-1)?.at ??
    order.createdAt
  );
}

function toSavedAccountOrder(
  order: ApiOrder,
  existing?: SavedOrder
): SavedOrder {
  return {
    id: order.orderNumber,
    customer: order.customerName ?? existing?.customer ?? "Customer",
    phone: order.phone ?? existing?.phone ?? "",
    email: order.email ?? existing?.email,
    address: order.address ?? existing?.address ?? "",
    deliveryLatitude:
      order.deliveryLatitude ?? existing?.deliveryLatitude,
    deliveryLongitude:
      order.deliveryLongitude ?? existing?.deliveryLongitude,
    deliveryDistanceKm:
      order.deliveryDistanceKm ?? existing?.deliveryDistanceKm,
    deliveryTime: order.deliveryTime ?? existing?.deliveryTime ?? "ASAP",
    instructions:
      order.specialInstructions ?? existing?.instructions ?? "",
    paymentMethod:
      order.paymentMethod ?? existing?.paymentMethod ?? "cash_on_delivery",
    paymentStatus:
      order.paymentStatus ?? existing?.paymentStatus ?? "pending",
    orderType: order.orderType,
    tableNumber: order.tableNumber ?? existing?.tableNumber,
    status: order.status,
    trackingToken: existing?.trackingToken,
    estimatedDeliveryAt:
      order.estimatedDeliveryAt ?? existing?.estimatedDeliveryAt,
    updatedAt: order.updatedAt ?? existing?.updatedAt,
    completedAt: order.completedAt ?? existing?.completedAt,
    statusHistory: order.statusHistory ?? existing?.statusHistory,
    deliveryAgent: order.deliveryAgent
      ? {
          name: order.deliveryAgent.name,
          phone: order.deliveryAgent.phone,
          location: existing?.deliveryAgent?.location
        }
      : existing?.deliveryAgent,
    items: order.items.map((item) => ({
      itemId: item.menuItem,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      total: item.price * item.quantity,
      customization: item.customization
    })),
    subtotal:
      order.subtotal ??
      order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      ),
    discount: order.discount ?? 0,
    couponCode: order.couponCode,
    tax: order.tax ?? 0,
    deliveryFee: order.deliveryFee ?? 0,
    total: order.total,
    createdAt: order.createdAt
  };
}

export default function OrdersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const addItems = useCartStore((state) => state.addItems);
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [placedOrderId, setPlacedOrderId] = useState("");
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState("");
  const [trackingConnection, setTrackingConnection] = useState<
    "idle" | "connecting" | "live" | "polling" | "error"
  >("idle");
  const accountOnlyOrderIds = useRef(new Set<string>());

  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [cancellingOrder, setCancellingOrder] = useState<SavedOrder | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [isSubmittingCancel, setIsSubmittingCancel] = useState(false);
  const [cancelSubmitError, setCancelSubmitError] = useState("");

  const [reportingIssueOrder, setReportingIssueOrder] = useState<SavedOrder | null>(null);
  const [issueCategory, setIssueCategory] = useState("missing_items");
  const [issueDescription, setIssueDescription] = useState("");
  const [issueResolution, setIssueResolution] = useState("refund");
  const [isSubmittingIssue, setIsSubmittingIssue] = useState(false);
  const [issueSubmitError, setIssueSubmitError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [issueImages, setIssueImages] = useState<string[]>([]);
  const [reviewingOrder, setReviewingOrder] = useState<SavedOrder | null>(null);
  const [reviewDrafts, setReviewDrafts] = useState<
    Record<string, { name: string; rating: number; comment: string }>
  >({});
  const [isReviewLoading, setIsReviewLoading] = useState(false);
  const [isReviewSubmitting, setIsReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Reset selected images whenever a new order is being reported
  useEffect(() => {
    if (reportingIssueOrder) {
      setIssueImages([]);
    }
  }, [reportingIssueOrder]);

  const handleIssueImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setIssueSubmitError("");
    const newImages = [...issueImages];

    if (newImages.length + files.length > 4) {
      setIssueSubmitError("Maximum of 4 images allowed per support ticket.");
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setIssueSubmitError("Invalid image type. Only JPG, PNG, and WEBP are allowed.");
        return;
      }

      if (file.size > 2 * 1024 * 1024) {
        setIssueSubmitError("Image is too large. Maximum size is 2MB per image.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setIssueImages(prev => {
            if (prev.length >= 4) return prev;
            return [...prev, reader.result as string];
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeIssueImage = (index: number) => {
    setIssueImages(prev => prev.filter((_, i) => i !== index));
  };

  const loadIssues = useCallback(async (loadedOrders: SavedOrder[]) => {
    try {
      let fetchedIssues: SupportIssue[] = [];
      try {
        fetchedIssues = await fetchCustomerIssues();
      } catch {
        // Ignore auth error
      }

      const guestOrders = loadedOrders.filter(
        (order): order is SavedOrder & { trackingToken: string } =>
          Boolean(order.trackingToken)
      );
      for (const order of guestOrders) {
        try {
          const guestIssues = await fetchCustomerIssues({
            orderNumber: order.id,
            trackingToken: order.trackingToken
          });
          fetchedIssues = [
            ...fetchedIssues,
            ...guestIssues.filter(gi => !fetchedIssues.some(fi => fi.id === gi.id))
          ];
        } catch {
          // Ignore
        }
      }
      setIssues(fetchedIssues);
    } catch {
      // Ignore
    }
  }, []);

  useEffect(() => {
    const loadOrders = async () => {
      let localOrders: SavedOrder[] = [];
      try {
        const stored = window.localStorage.getItem("al-arab-orders");
        localOrders = parseSavedOrders(stored);
        setOrders(localOrders);
        void loadIssues(localOrders);
      } catch {
        setOrders([]);
      }

      try {
        const accountOrders = await fetchCustomerOrders();
        const localById = new Map(
          localOrders.map((order) => [order.id, order])
        );
        accountOnlyOrderIds.current = new Set(
          accountOrders
            .filter((order) => !localById.has(order.orderNumber))
            .map((order) => order.orderNumber)
        );
        const accountOrderIds = new Set(
          accountOrders.map((order) => order.orderNumber)
        );
        const merged = [
          ...accountOrders.map((order) =>
            toSavedAccountOrder(order, localById.get(order.orderNumber))
          ),
          ...localOrders.filter((order) => !accountOrderIds.has(order.id))
        ].sort(
          (first, second) =>
            new Date(second.createdAt).getTime() -
            new Date(first.createdAt).getTime()
        );
        setOrders(merged);
        void loadIssues(merged);
      } catch {
        accountOnlyOrderIds.current.clear();
      }
    };

    setPlacedOrderId(new URLSearchParams(window.location.search).get("placed") ?? "");
    void loadOrders();
    const handleStorage = () => void loadOrders();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [loadIssues]);

  const mergeTrackingUpdate = useCallback(
    (tracking: ApiOrderTracking, trackingToken?: string) => {
      setOrders((current) => {
        const next = current.map((order) =>
          order.id === tracking.orderNumber
            ? {
                ...order,
                status: tracking.status,
                paymentStatus:
                  tracking.paymentStatus ?? order.paymentStatus,
                tableNumber: tracking.tableNumber ?? order.tableNumber,
                deliveryTime: tracking.deliveryTime ?? order.deliveryTime,
                trackingToken: trackingToken ?? order.trackingToken,
                estimatedDeliveryAt: tracking.estimatedDeliveryAt,
                deliveryAgent: tracking.deliveryAgent,
                statusHistory: tracking.statusHistory,
                completedAt: tracking.completedAt,
                updatedAt: tracking.updatedAt
              }
            : order
        );
        window.localStorage.setItem(
          "al-arab-orders",
          serializeSavedOrders(
            next.filter((order) => !accountOnlyOrderIds.current.has(order.id))
          )
        );
        return next;
      });
    },
    []
  );

  const activeOrders = orders.filter((order) => isActiveStatus(order.status));
  const pastOrders = orders.filter((order) => !isActiveStatus(order.status));
  const trackingCredentialsKey = useMemo(
    () =>
      JSON.stringify(
        activeOrders
          .filter((order) => order.trackingToken)
          .map((order) => ({
            orderNumber: order.id,
            trackingToken: order.trackingToken as string
          }))
          .sort((first, second) =>
            first.orderNumber.localeCompare(second.orderNumber)
          )
      ),
    [activeOrders]
  );

  useEffect(() => {
    const credentials = JSON.parse(trackingCredentialsKey) as Array<{
      orderNumber: string;
      trackingToken: string;
    }>;
    if (credentials.length === 0) {
      setTrackingConnection("idle");
      return;
    }

    let stopped = false;
    const socket = io(getApiSocketUrl(), {
      transports: ["websocket", "polling"],
      reconnection: true
    });

    const refreshTracking = async () => {
      const results = await Promise.allSettled(
        credentials.map(({ orderNumber, trackingToken }) =>
          fetchOrderTracking(orderNumber, trackingToken)
        )
      );
      if (stopped) return;

      let refreshed = false;
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          refreshed = true;
          mergeTrackingUpdate(result.value);
        }
      });
      if (!socket.connected) {
        setTrackingConnection(refreshed ? "polling" : "error");
      }
    };

    setTrackingConnection("connecting");
    socket.on("connect", () => {
      credentials.forEach((credential) => {
        socket.emit(
          "order:track",
          credential,
          (result: {
            ok: boolean;
            order?: ApiOrderTracking;
          }) => {
            if (stopped) return;
            if (result.ok && result.order) {
              mergeTrackingUpdate(result.order);
              setTrackingConnection("live");
            }
          }
        );
      });
    });
    socket.on("connect_error", () => setTrackingConnection("polling"));
    socket.on("disconnect", () => {
      if (!stopped) setTrackingConnection("polling");
    });
    socket.on("order:status", mergeTrackingUpdate);
    socket.on("order:assigned", mergeTrackingUpdate);
    socket.on("order_cancelled", (cancelled: ApiOrderTracking) => {
      mergeTrackingUpdate(cancelled);
    });

    void refreshTracking();
    const pollTimer = window.setInterval(
      () => void refreshTracking(),
      15_000
    );

    return () => {
      stopped = true;
      window.clearInterval(pollTimer);
      socket.disconnect();
    };
  }, [mergeTrackingUpdate, trackingCredentialsKey]);

  useCustomer3DReveal(orders.length);

  const handleReorder = async (order: SavedOrder) => {
    setReorderingOrderId(order.id);
    setReorderError("");

    try {
      const menu = await fetchMenu();
      const { cartItems, unavailableQuantity } = buildReorderCartItems(menu, order.items);

      if (cartItems.length === 0) {
        setReorderError("The dishes from this order are no longer available.");
        return;
      }

      addItems(cartItems);
      const addedQuantity = cartItems.reduce((sum, item) => sum + item.quantity, 0);
      const query = new URLSearchParams({
        cart: "1",
        reordered: String(addedQuantity)
      });
      if (unavailableQuantity > 0) {
        query.set("unavailable", String(unavailableQuantity));
      }
      router.push(`/mobile?${query.toString()}`);
    } catch {
      setReorderError("Unable to rebuild this order right now. Please try again.");
    } finally {
      setReorderingOrderId(null);
    }
  };

  const handleCancelOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancellingOrder) return;

    setIsSubmittingCancel(true);
    setCancelSubmitError("");
    try {
      const updated = await cancelOrder(cancellingOrder.id, cancelReason, cancellingOrder.trackingToken);

      setOrders(current => {
        const next = current.map(o => o.id === cancellingOrder.id ? {
          ...o,
          status: "cancelled",
          paymentStatus: updated.paymentStatus ?? o.paymentStatus,
          refundStatus: updated.refundStatus ?? o.refundStatus,
          refundAmount: updated.refundAmount ?? o.refundAmount,
          statusHistory: updated.statusHistory ?? o.statusHistory,
          completedAt: updated.completedAt ?? o.completedAt
        } : o);
        window.localStorage.setItem(
          "al-arab-orders",
          serializeSavedOrders(
            next.filter((order) => !accountOnlyOrderIds.current.has(order.id))
          )
        );
        return next;
      });

      let msg = `Order #${cancellingOrder.id} cancelled successfully.`;
      if (updated.refundStatus === "processed") {
        msg += " Razorpay has processed the refund.";
      } else if (updated.refundStatus === "pending") {
        msg += " The refund was initiated and is awaiting Razorpay confirmation.";
      }
      setSuccessMessage(msg);
      setTimeout(() => setSuccessMessage(""), 6000);

      setCancellingOrder(null);
      setCancelReason("");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to cancel order.";
      setCancelSubmitError(msg);
    } finally {
      setIsSubmittingCancel(false);
    }
  };

  const handleReportIssueSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportingIssueOrder) return;

    if (!issueDescription.trim()) {
      setIssueSubmitError("Please write a detailed description of the issue.");
      return;
    }

    setIsSubmittingIssue(true);
    setIssueSubmitError("");
    try {
      const newIssue = await reportOrderIssue({
        orderNumber: reportingIssueOrder.id,
        category: issueCategory,
        description: issueDescription,
        desiredResolution: issueResolution,
        trackingToken: reportingIssueOrder.trackingToken,
        images: issueImages
      });

      setIssues(prev => [newIssue, ...prev]);

      // Redirect to support chat
      const newIssueId = newIssue.id || newIssue._id;
      if (newIssueId && reportingIssueOrder.trackingToken) {
        window.sessionStorage.setItem(
          `al-arab-support-token:${newIssueId}`,
          reportingIssueOrder.trackingToken
        );
      }
      const chatUrl = `/support/chat/${newIssueId}`;
      setReportingIssueOrder(null);
      setIssueDescription("");
      setIssueCategory("missing_items");
      setIssueResolution("refund");
      setIssueImages([]);
      router.push(chatUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to report issue. Please try again.";
      setIssueSubmitError(msg);
    } finally {
      setIsSubmittingIssue(false);
    }
  };

  const openReviewModal = async (order: SavedOrder) => {
    const reviewableItems = order.items.filter(
      (item): item is typeof item & { itemId: string } => Boolean(item.itemId)
    );
    const initialDrafts = Object.fromEntries(
      reviewableItems.map((item) => [
        item.itemId,
        { name: item.name, rating: 0, comment: "" }
      ])
    );

    setReviewingOrder(order);
    setReviewDrafts(initialDrafts);
    setReviewError("");
    setIsReviewLoading(true);
    try {
      const existing = await fetchOrderReviews(order.id, order.trackingToken);
      setReviewDrafts((current) => {
        const next = { ...current };
        existing.forEach((review: CustomerReview) => {
          if (next[review.menuItem]) {
            next[review.menuItem] = {
              ...next[review.menuItem],
              rating: review.rating,
              comment: review.comment
            };
          }
        });
        return next;
      });
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Unable to load your reviews"
      );
    } finally {
      setIsReviewLoading(false);
    }
  };

  const handleReviewSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!reviewingOrder) return;

    const items = Object.entries(reviewDrafts).map(
      ([menuItem, draft]) => ({
        menuItem,
        rating: draft.rating,
        comment: draft.comment.trim()
      })
    );
    if (items.length === 0 || items.some((item) => item.rating < 1)) {
      setReviewError("Choose a star rating for every dish.");
      return;
    }

    setIsReviewSubmitting(true);
    setReviewError("");
    try {
      await submitOrderReviews({
        orderNumber: reviewingOrder.id,
        trackingToken: reviewingOrder.trackingToken,
        items
      });
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
      setReviewingOrder(null);
      setSuccessMessage("Thank you. Your verified review is now live.");
      window.setTimeout(() => setSuccessMessage(""), 6000);
    } catch (error) {
      setReviewError(
        error instanceof Error ? error.message : "Unable to save your review"
      );
    } finally {
      setIsReviewSubmitting(false);
    }
  };

  const renderOrderCard = (order: SavedOrder, isActive: boolean) => {
    const { steps, activeIndex } = getTrackingSteps(order);
    const riderLocation = order.deliveryAgent?.location;
    const orderIssue = issues.find(issue => issue.orderNumber === order.id);

    return (
      <article
        key={order.id}
        data-customer-reveal
        className={`customer-order-card customer-order-card-mobile customer-reveal relative overflow-hidden rounded-2xl border p-4 min-[360px]:p-5 ${
          isActive
            ? "is-active border-yellow-500/40 bg-gradient-to-b from-yellow-500/5 to-[#111111]"
            : "border-white/5 bg-[#111111]"
        }`}
      >
        <div className="flex flex-col items-stretch gap-3 border-b border-white/10 pb-4 min-[360px]:flex-row min-[360px]:items-start min-[360px]:justify-between">
          <div className="w-full min-w-0 flex-1">
            <h2 className="flex min-w-0 items-center gap-2 font-heading text-lg font-semibold text-white">
              <span className="min-w-0 break-words">Al-Arab Restaurant</span>
              <ChevronRight size={16} className="shrink-0 text-white/40" />
            </h2>
            <p className="mt-1 flex min-w-0 items-start gap-1.5 text-xs leading-relaxed text-white/50">
              <Clock size={12} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words">
                {formatDate(order.createdAt)} · Order #{order.id}
              </span>
            </p>
            {order.orderType === "dine_in" && order.tableNumber && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-yellow-500/25 bg-yellow-500/10 px-2 py-1 text-xs font-black text-yellow-500">
                <UtensilsCrossed size={12} />
                Dine-in · Table {order.tableNumber}
              </p>
            )}
            {order.orderType === "takeaway" && (
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-yellow-500/25 bg-yellow-500/10 px-2 py-1 text-xs font-black text-yellow-500">
                Takeaway · Restaurant pickup
              </p>
            )}
          </div>

          {isActive ? (
            <span className="customer-status-badge inline-flex w-full max-w-full shrink-0 items-center justify-center self-start whitespace-normal break-words rounded-md border border-yellow-500/30 px-2.5 py-1 text-center text-xs font-black leading-tight min-[360px]:w-auto min-[360px]:max-w-[45%]">
              {statusLabel(order.status)}
            </span>
          ) : (
            <span className={`flex shrink-0 items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-bold ${
              isCancelledStatus(order.status)
                ? "border-red-500/20 bg-red-500/10 text-red-400"
                : "border-green-500/20 bg-green-500/10 text-green-500"
            }`}>
              <CheckCircle2 size={14} /> {statusLabel(order.status)}
            </span>
          )}
        </div>

        <div className="mt-4 space-y-1.5 text-sm text-white/70">
          {order.items.map((item, index) => (
            <p key={`${item.name}-${index}`}>
              <span className="mr-2 font-bold text-white">{item.quantity} ×</span>
              {item.name}
            </p>
          ))}
        </div>

        {isActive && (
          <div className="mt-6 space-y-3">
            <div className="grid min-w-0 gap-3 sm:grid-cols-2">
              <div className="min-w-0 rounded-xl border border-yellow-500/20 bg-yellow-500/[0.07] p-4">
                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-yellow-500">
                  <Clock size={14} />
                  {order.orderType === "delivery"
                    ? "Estimated arrival"
                    : order.orderType === "takeaway"
                      ? "Estimated pickup time"
                      : "Estimated ready time"}
                </p>
                <p className="mt-2 font-heading text-2xl font-semibold text-white">
                  {formatTrackingTime(order.estimatedDeliveryAt)}
                </p>
                <p className="mt-1 text-xs text-white/45">
                  Updated as the restaurant moves your order forward.
                </p>
              </div>

              {order.orderType === "delivery" && order.deliveryAgent?.name ? (
                <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.04] p-4">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                    <Bike size={14} className="text-yellow-500" />
                    Delivery partner
                  </p>
                  <p className="mt-2 break-words font-bold text-white">
                    {order.deliveryAgent.name}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {order.deliveryAgent.phone && (
                      <a
                        href={`tel:${order.deliveryAgent.phone.replace(/\s+/g, "")}`}
                        className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-yellow-500 px-3 text-xs font-black text-black"
                      >
                        <PhoneCall size={14} />
                        Call rider
                      </a>
                    )}
                    {typeof riderLocation?.lat === "number" &&
                      typeof riderLocation.lng === "number" && (
                        <a
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${riderLocation.lat},${riderLocation.lng}`)}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-white/10 px-3 text-xs font-black text-white"
                        >
                          <MapPinned size={14} />
                          View location
                        </a>
                      )}
                  </div>
                </div>
              ) : (
                <div className="min-w-0 rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-white/45">
                    <Bike size={14} className="text-yellow-500" />
                    Delivery partner
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-white/70">
                    {order.orderType === "dine_in"
                      ? "Your table order is with the restaurant team."
                      : order.orderType === "takeaway"
                        ? "The restaurant team will prepare this order for pickup."
                        : "A rider will appear here after assignment."}
                  </p>
                </div>
              )}
            </div>

            <div className="customer-track-rail min-w-0 rounded-xl border border-white/5 bg-black/50 p-3 min-[390px]:p-4">
              <div className="flex min-w-0 items-start text-[8px] font-bold uppercase tracking-wide text-white/45 min-[390px]:text-[9px]">
                {steps.map((step, index) => {
                  const reached = activeIndex >= index;
                  return (
                    <div
                      key={step}
                      className={`flex min-w-0 items-start ${
                        index < steps.length - 1 ? "flex-1" : ""
                      }`}
                    >
                      <div className="flex w-10 shrink-0 flex-col items-center gap-2 text-center min-[390px]:w-12">
                        <span
                          className={`h-3 w-3 rounded-full ${
                            reached
                              ? "bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.5)]"
                              : "bg-white/10"
                          }`}
                        />
                        <span className={`max-w-full leading-[1.15] [overflow-wrap:anywhere] ${reached ? "text-yellow-500" : ""}`}>
                          {step}
                        </span>
                      </div>
                      {index < steps.length - 1 && (
                        <span
                          className={`mt-[5px] h-0.5 min-w-0 flex-1 rounded ${
                            activeIndex > index
                              ? "bg-yellow-500"
                              : "bg-white/10"
                          }`}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 border-t border-white/5 pt-3 text-[10px] text-white/40">
                <span className="min-w-0">
                  Last update {formatTrackingTime(latestTrackingUpdate(order))}
                </span>
                <span className="ml-auto shrink-0 text-right font-black uppercase tracking-wider text-yellow-500/80">
                  {order.trackingToken ? "Secure tracking" : "Local status"}
                </span>
              </div>
            </div>
          </div>
        )}

        {orderIssue && (
          <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-xs font-bold text-yellow-500">
                <AlertTriangle size={14} />
                Issue Reported ({orderIssue.category.replace("_", " ")})
              </p>
              <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                orderIssue.status === "refunded"
                  ? "bg-green-500/20 text-green-400 border border-green-500/30 animate-pulse"
                  : orderIssue.status === "resolved"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : orderIssue.status === "investigating"
                      ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 animate-pulse"
                      : "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 animate-pulse"
              }`}>
                {orderIssue.status}
              </span>
            </div>
            <p className="mt-2 text-xs text-white/70 italic">&ldquo;{orderIssue.description}&rdquo;</p>
            {orderIssue.images && orderIssue.images.length > 0 && (
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                {orderIssue.images.map((img, idx) => (
                  <div key={idx} className="relative h-12 w-12 rounded-lg overflow-hidden border border-white/10 bg-white/5 shrink-0">
                    <Image src={img} alt="Attached issue" fill unoptimized className="object-cover" />
                  </div>
                ))}
              </div>
            )}
            {orderIssue.resolutionDetails && (
              <div className="mt-2 border-t border-white/5 pt-2">
                <p className="text-[10px] font-bold text-white/50 uppercase tracking-wide">Resolution Details</p>
                <p className="mt-0.5 text-xs text-white/80">{orderIssue.resolutionDetails}</p>
              </div>
            )}
            {orderIssue.status === "refunded" && orderIssue.refundAmount > 0 && (
              <p className="mt-1.5 text-xs font-bold text-emerald-400">
                Razorpay processed a refund of {money(orderIssue.refundAmount)}.
              </p>
            )}
            {orderIssue.refundStatus === "pending" && orderIssue.refundAmount > 0 && (
              <p className="mt-1.5 text-xs font-bold text-amber-400">
                Refund of {money(orderIssue.refundAmount)} is awaiting Razorpay confirmation.
              </p>
            )}
            {orderIssue.refundStatus === "failed" && (
              <p className="mt-1.5 text-xs font-bold text-red-400">
                Razorpay could not process this refund. Support will review it.
              </p>
            )}
            <button
              type="button"
              onClick={() => {
                const issueId = orderIssue.id || orderIssue._id;
                if (issueId && order.trackingToken) {
                  window.sessionStorage.setItem(
                    `al-arab-support-token:${issueId}`,
                    order.trackingToken
                  );
                }
                router.push(`/support/chat/${issueId}`);
              }}
              className="mt-2 inline-flex items-center gap-1.5 text-[10px] font-bold text-yellow-500 hover:text-yellow-400 transition"
            >
              <MessageCircle size={12} />
              Open Support Chat
            </button>
          </div>
        )}

        {order.paymentStatus === "refunded" && (
          <div className="mt-3 rounded-lg bg-emerald-500/10 border border-emerald-500/25 p-3 text-xs text-emerald-300 font-semibold">
            Razorpay processed your prepaid refund of {money(order.refundAmount ?? order.total)}.
          </div>
        )}
        {order.refundStatus === "pending" && (
          <div className="mt-3 rounded-lg bg-amber-500/10 border border-amber-500/25 p-3 text-xs text-amber-300 font-semibold">
            Your refund of {money(order.refundAmount ?? order.total)} is awaiting Razorpay confirmation.
          </div>
        )}
        {order.refundStatus === "failed" && (
          <div className="mt-3 rounded-lg bg-red-500/10 border border-red-500/25 p-3 text-xs text-red-300 font-semibold">
            Razorpay could not process this refund. Please contact support.
          </div>
        )}

        <div className="mt-5 flex flex-col items-stretch gap-3 border-t border-white/10 pt-4 min-[360px]:flex-row min-[360px]:items-center min-[360px]:justify-between">
          <div>
            <p className="mb-0.5 text-xs text-white/50">Total Paid</p>
            <p className="text-lg font-black text-yellow-500">{money(order.total)}</p>
          </div>

          {isActive && ["pending", "placed"].includes(normalizeStatus(order.status)) && (
            <button
              type="button"
              onClick={() => {
                setCancellingOrder(order);
                setCancelSubmitError("");
              }}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-5 py-2.5 text-xs font-black text-red-400 transition hover:bg-red-500/20 hover:scale-[1.02] active:scale-[0.98] min-[360px]:w-auto"
            >
              <XCircle size={15} />
              Cancel Order
            </button>
          )}

          {!isActive && (
            <div className="flex w-full flex-wrap justify-start gap-2 min-[360px]:w-auto min-[360px]:justify-end">
              {!isCancelledStatus(order.status) &&
                order.items.some((item) => item.itemId) && (
                  <button
                    type="button"
                    onClick={() => void openReviewModal(order)}
                    className="flex min-h-11 items-center gap-2 rounded-lg border border-amber-400/30 bg-amber-400/10 px-4 py-2.5 text-xs font-black text-amber-300 transition hover:bg-amber-400/20 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <Star size={15} />
                    Rate dishes
                  </button>
                )}
              <button
                type="button"
                onClick={() => {
                  setReportingIssueOrder(order);
                  setIssueSubmitError("");
                }}
                className="flex min-h-11 items-center gap-2 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-4 py-2.5 text-xs font-black text-yellow-500 transition hover:bg-yellow-500/20 hover:scale-[1.02] active:scale-[0.98]"
              >
                <HelpCircle size={15} />
                Report Issue
              </button>
              <button
                type="button"
                onClick={() => void handleReorder(order)}
                disabled={reorderingOrderId === order.id}
                className="customer-3d-primary flex min-h-11 items-center gap-2 rounded-lg bg-yellow-500 px-6 py-2.5 text-sm font-black text-black disabled:cursor-wait disabled:opacity-60"
              >
                <RefreshCw size={15} />
                {reorderingOrderId === order.id ? "Adding..." : "Order again"}
              </button>
            </div>
          )}
        </div>
      </article>
    );
  };

  return (
    <main className="customer-3d-page customer-orders-page min-h-screen overflow-x-clip bg-[#080808] text-white pb-32">
      <div className="customer-ambient customer-ambient--one" aria-hidden="true" />
      <div className="customer-ambient customer-ambient--two" aria-hidden="true" />

      <header className="customer-3d-header sticky top-0 z-40 border-b border-white/10 bg-black/90 px-4 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="customer-icon-button flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#111111]"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-primary">Your dining journey</p>
            <h1 className="font-heading text-2xl font-semibold">My Orders</h1>
          </div>
          {activeOrders.length > 0 && (
            <span
              role="status"
              className={`ml-auto inline-flex min-h-9 items-center gap-2 rounded-full border px-3 text-[10px] font-black uppercase tracking-wider ${
                trackingConnection === "live"
                  ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                  : trackingConnection === "error"
                    ? "border-red-400/30 bg-red-400/10 text-red-300"
                    : "border-yellow-500/25 bg-yellow-500/10 text-yellow-400"
              }`}
            >
              <Radio
                size={13}
                className={trackingConnection === "live" ? "animate-pulse" : ""}
              />
              {trackingConnection === "live"
                ? "Live"
                : trackingConnection === "polling"
                  ? "Refreshing"
                  : trackingConnection === "error"
                    ? "Offline"
                    : trackingConnection === "connecting"
                      ? "Connecting"
                      : "Local"}
            </span>
          )}
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-3xl space-y-8 p-4 pb-32">
        {reorderError && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-semibold text-red-200 animate-pulse">
            {reorderError}
          </p>
        )}

        {placedOrderId && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-100 animate-in fade-in slide-in-from-top-4">
            <PackageCheck className="shrink-0 text-yellow-500" size={22} />
            <p className="text-sm font-semibold">Order {placedOrderId} placed successfully.</p>
          </div>
        )}

        {successMessage && (
          <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100 animate-in fade-in slide-in-from-top-4">
            <CheckCircle2 className="shrink-0 text-emerald-500 animate-bounce" size={22} />
            <p className="text-sm font-semibold">{successMessage}</p>
          </div>
        )}

        {orders.length === 0 ? (
          <section data-customer-reveal className="customer-empty-card customer-reveal rounded-3xl border border-white/10 bg-[#111111] p-10 text-center">
            <ShoppingBag className="mx-auto mb-4 text-white/20" size={48} />
            <h2 className="font-heading text-2xl font-semibold text-white/90">No orders yet</h2>
            <p className="mt-2 text-sm text-white/50">Looks like you haven&apos;t made your first order.</p>
            <Link href="/mobile" className="customer-3d-primary mt-6 inline-flex h-12 items-center justify-center rounded-xl bg-yellow-500 px-8 font-black text-black">
              Browse Menu
            </Link>
          </section>
        ) : (
          <div className="space-y-10">
            <section>
              <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-yellow-500">Active Orders</h2>
              {activeOrders.length === 0 ? (
                <p data-customer-reveal className="customer-glass-panel customer-reveal rounded-xl border border-white/5 bg-[#111111] p-4 text-sm font-semibold italic text-white/40">
                  No active orders right now.
                </p>
              ) : (
                <div className="space-y-4">{activeOrders.map((order) => renderOrderCard(order, true))}</div>
              )}
            </section>

            {pastOrders.length > 0 && (
              <section>
                <h2 className="mb-4 text-xs font-black uppercase tracking-widest text-white/40">Past Orders</h2>
                <div className="space-y-4">{pastOrders.map((order) => renderOrderCard(order, false))}</div>
              </section>
            )}
          </div>
        )}
      </div>

      {/* Cancellation Modal */}
      {reviewingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-yellow-500">
                  Verified purchase
                </p>
                <h3 className="mt-1 font-heading text-xl font-semibold text-white">
                  Rate your dishes
                </h3>
                <p className="mt-1 text-xs text-white/50">
                  Order #{reviewingOrder.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReviewingOrder(null)}
                aria-label="Close reviews"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 text-white/60 hover:bg-white/5 hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleReviewSubmit} className="mt-5 space-y-4">
              {Object.entries(reviewDrafts).map(([menuItem, draft]) => (
                <fieldset
                  key={menuItem}
                  disabled={isReviewLoading || isReviewSubmitting}
                  className="rounded-xl border border-white/10 bg-black/30 p-4"
                >
                  <legend className="px-1 text-sm font-black text-white">
                    {draft.name}
                  </legend>
                  <div className="mt-2 flex gap-1" aria-label={`Rate ${draft.name}`}>
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() =>
                          setReviewDrafts((current) => ({
                            ...current,
                            [menuItem]: { ...current[menuItem], rating }
                          }))
                        }
                        aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                        aria-pressed={draft.rating === rating}
                        className="flex h-10 w-10 items-center justify-center rounded-lg text-amber-300 transition hover:bg-amber-400/10"
                      >
                        <Star
                          size={24}
                          className={rating <= draft.rating ? "fill-current" : "opacity-35"}
                        />
                      </button>
                    ))}
                  </div>
                  <label className="mt-3 block text-[10px] font-black uppercase tracking-wider text-white/45">
                    Comment (optional)
                    <textarea
                      rows={2}
                      maxLength={1000}
                      value={draft.comment}
                      onChange={(event) =>
                        setReviewDrafts((current) => ({
                          ...current,
                          [menuItem]: {
                            ...current[menuItem],
                            comment: event.target.value
                          }
                        }))
                      }
                      placeholder="What did you enjoy?"
                      className="mt-2 w-full resize-none rounded-lg border border-white/10 bg-black/40 p-3 text-sm font-medium normal-case tracking-normal text-white outline-none focus:border-yellow-500/60"
                    />
                  </label>
                </fieldset>
              ))}

              {reviewError && (
                <p role="alert" className="text-sm font-semibold text-red-400">
                  {reviewError}
                </p>
              )}

              <button
                type="submit"
                disabled={
                  isReviewLoading ||
                  isReviewSubmitting ||
                  Object.keys(reviewDrafts).length === 0
                }
                className="min-h-12 w-full rounded-xl bg-yellow-500 px-5 text-sm font-black text-black transition hover:bg-yellow-400 disabled:cursor-wait disabled:opacity-50"
              >
                {isReviewLoading
                  ? "Loading reviews..."
                  : isReviewSubmitting
                    ? "Saving review..."
                    : "Publish verified review"}
              </button>
            </form>
          </div>
        </div>
      )}

      {cancellingOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="font-heading text-xl font-semibold text-white">Cancel Order #{cancellingOrder.id}</h3>
            <p className="mt-2 text-sm text-white/60">
              Are you sure you want to cancel this order? Please state your reason below.
            </p>

            <form onSubmit={handleCancelOrderSubmit} className="mt-4 space-y-4">
              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider">
                Reason for cancellation
                <input
                  required
                  type="text"
                  placeholder="e.g. Ordered by mistake, wrong delivery address..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none focus:border-red-500/60 focus:ring-2 focus:ring-red-500/20 transition-all"
                />
              </label>

              {cancelSubmitError && (
                <p role="alert" className="text-xs font-semibold text-red-400">{cancelSubmitError}</p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setCancellingOrder(null)}
                  className="min-h-10 rounded-lg px-4 text-xs font-bold text-white/70 hover:bg-white/5"
                >
                  Go Back
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingCancel}
                  className="min-h-10 rounded-lg bg-red-500 px-5 text-xs font-black text-white hover:bg-red-600 disabled:opacity-50 transition-all duration-150"
                >
                  {isSubmittingCancel ? "Processing..." : "Cancel Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Issue Modal */}
      {reportingIssueOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#111111] p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-start">
              <h3 className="font-heading text-xl font-semibold text-white">Report Issue (Order #{reportingIssueOrder.id})</h3>
              <button
                type="button"
                onClick={() => setReportingIssueOrder(null)}
                className="text-white/40 hover:text-white"
              >
                <XCircle size={20} />
              </button>
            </div>

            <form onSubmit={handleReportIssueSubmit} className="mt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider">
                  Category
                  <select
                    value={issueCategory}
                    onChange={(e) => setIssueCategory(e.target.value)}
                    className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-3 text-sm text-white outline-none focus:border-yellow-500/60"
                  >
                    <option value="missing_items">Missing Items</option>
                    <option value="wrong_items">Wrong Items</option>
                    <option value="poor_quality">Food Quality Issue</option>
                    <option value="delivery_delay">Late Delivery</option>
                    <option value="other">Other issue</option>
                  </select>
                </label>

                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider">
                  Desired Resolution
                  <select
                    value={issueResolution}
                    onChange={(e) => setIssueResolution(e.target.value)}
                    className="mt-2 h-12 w-full rounded-xl border border-white/10 bg-[#1e1e1e] px-3 text-sm text-white outline-none focus:border-yellow-500/60"
                  >
                    <option value="refund">Refund Request</option>
                    <option value="redelivery">Redelivery of Item</option>
                    <option value="feedback">Feedback Only</option>
                  </select>
                </label>
              </div>

              <label className="block text-xs font-bold text-white/50 uppercase tracking-wider">
                Explanation & Details
                <textarea
                  required
                  rows={4}
                  placeholder="Explain the issue with item names if missing or wrong..."
                  value={issueDescription}
                  onChange={(e) => setIssueDescription(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-white/10 bg-black/35 p-4 text-sm text-white outline-none resize-none focus:border-yellow-500/60 focus:ring-2 focus:ring-yellow-500/20"
                />
              </label>

              <div className="space-y-2">
                <span className="block text-[10px] font-bold text-white/50 uppercase tracking-wider">
                  Attach Photos (Optional, Max 4 - 2MB each)
                </span>
                <div className="grid grid-cols-4 gap-3">
                  {issueImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5 group">
                      <Image src={img} alt={`Attached preview ${idx + 1}`} fill unoptimized className="object-cover" />
                      <button
                        type="button"
                        onClick={() => removeIssueImage(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-600 flex items-center justify-center text-white opacity-85 hover:opacity-100 hover:scale-105 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {issueImages.length < 4 && (
                    <label className="relative aspect-square flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 hover:border-yellow-500/40 hover:bg-white/5 cursor-pointer group transition-all">
                      <Camera size={20} className="text-white/40 group-hover:text-yellow-500/80 transition-colors" />
                      <span className="text-[9px] font-bold text-white/40 mt-1 uppercase">Add Photo</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleIssueImagesChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {issueSubmitError && (
                <p role="alert" className="text-xs font-semibold text-red-400">{issueSubmitError}</p>
              )}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setReportingIssueOrder(null)}
                  className="min-h-10 rounded-lg px-4 text-xs font-bold text-white/70 hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingIssue}
                  className="min-h-10 rounded-lg bg-yellow-500 px-5 text-xs font-black text-black hover:bg-yellow-600 disabled:opacity-50 transition-all duration-150"
                >
                  {isSubmittingIssue ? "Submitting..." : "Submit Ticket"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
