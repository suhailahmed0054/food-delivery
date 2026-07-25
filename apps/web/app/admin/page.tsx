"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { type Category, type MenuItem } from "@/lib/data";
import { buildDeliveryWhatsAppMessage } from "@/lib/delivery-whatsapp";
import { NotificationCenter } from "@/components/NotificationCenter";
import {
  assignOrderDelivery,
  fetchCurrentAdmin,
  fetchCustomer,
  fetchCustomers,
  fetchAdminIssues,
  fetchAdminReviews,
  fetchReportSummary,
  fetchRestaurantSettings,
  createDeliveryPerson,
  createMenuItem,
  createRestaurantTable,
  deleteDeliveryPerson,
  deleteMenuItem,
  fetchDeliveryPeople,
  fetchMenu,
  fetchOrders,
  fetchRestaurantTables,
  logoutAdmin,
  regenerateRestaurantTableQr,
  setRestaurantTableActive,
  updateDeliveryPerson,
  updateCustomerNotes,
  updateOrderStatus as updateOrderStatusApi,
  updateRestaurantSettings,
  updateMenuItem,
  uploadMenuImage,
  setCustomerBlocked,
  assignIssueAgent,
  decideIssueResolution,
  type AdminReviewPage,
  type AdminCustomer,
  type AdminCustomerDetail,
  type ApiOrder,
  type DeliveryPerson,
  type DeliveryPersonPayload,
  type DeliveryPersonStatus,
  type RestaurantTable,
  type MenuItemPayload,
  type ReportSummary,
  type RestaurantSettingsData,
  type SupportIssuePage
} from "@/lib/api";
import {
  LayoutDashboard,
  ShoppingBag,
  UtensilsCrossed,
  Users,
  UserCircle,
  BarChart3,
  Settings,
  Star,
  Plus,
  Edit2,
  Trash2,
  X,
  CheckCircle2,
  MapPin,
  Phone,
  Clock,
  XCircle,
  User,
  QrCode,
  Copy,
  RefreshCw,
  Power,
  Bike,
  MessageCircle,
  Send,
  Search,
  Ban,
  Unlock,
  LogOut,
  CalendarDays,
  Download,
  Save,
  Store,
  Wallet,
  TrendingUp,
  UserCheck,
  UserX,
  ReceiptText,
  Volume2,
  VolumeX,
  UploadCloud,
  Menu
} from "lucide-react";

const FALLBACK_MENU_IMAGE =
  "https://images.unsplash.com/photo-1541518763669-27fef04b14ea?auto=format&fit=crop&w=800&q=80";
const ORDER_ALERTS_STORAGE_KEY = "al-arab-admin-order-alerts";
const ORDER_ALERT_AUDIO_SRC = "/sounds/order-alert.mp3";
const ORDER_ALERT_PLAYBACK_SECONDS = 2;

type OrderAlertPlayer = {
  audio: HTMLAudioElement | null;
  monitorTimer: number | null;
};

function getOrderAlertAudio(player: OrderAlertPlayer) {
  if (!player.audio) {
    player.audio = new Audio(ORDER_ALERT_AUDIO_SRC);
    player.audio.preload = "auto";
    player.audio.addEventListener("timeupdate", () => {
      if (
        player.audio &&
        player.audio.currentTime >= ORDER_ALERT_PLAYBACK_SECONDS
      ) {
        stopOrderAlertSound(player);
      }
    });
  }

  return player.audio;
}

function stopOrderAlertSound(player: OrderAlertPlayer) {
  if (player.monitorTimer !== null) {
    window.clearInterval(player.monitorTimer);
    player.monitorTimer = null;
  }

  if (player.audio) {
    player.audio.pause();
    player.audio.currentTime = 0;
  }
}

async function playOrderAlertSound(player: OrderAlertPlayer) {
  stopOrderAlertSound(player);
  const audio = getOrderAlertAudio(player);
  audio.currentTime = 0;
  audio.volume = 1;
  await audio.play();
  player.monitorTimer = window.setInterval(() => {
    if (audio.currentTime >= ORDER_ALERT_PLAYBACK_SECONDS) {
      stopOrderAlertSound(player);
    }
  }, 40);
}

async function unlockOrderAlertAudio(player: OrderAlertPlayer) {
  const audio = getOrderAlertAudio(player);
  const previousVolume = audio.volume;
  audio.volume = 0;

  try {
    await audio.play();
  } finally {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = previousVolume;
  }
}

type MenuFormData = {
  id: string;
  name: string;
  description: string;
  category: Category;
  image: string;
  available: boolean;
  sizes: string[];
  preserveExistingSizes: boolean;
  prices: {
    Half: number;
    Full: number;
    Standard: number;
  };
};

type DeliveryPersonFormData = DeliveryPersonPayload;

function createEmptyDeliveryPersonFormData(): DeliveryPersonFormData {
  return {
    name: "",
    phone: "",
    status: "available"
  };
}

function createEmptyMenuFormData(): MenuFormData {
  return {
    id: "",
    name: "",
    description: "",
    category: "Mains",
    image: "",
    available: true,
    sizes: [],
    preserveExistingSizes: false,
    prices: { Half: 0, Full: 0, Standard: 0 }
  };
}

type AdminOrderItem = {
  name?: unknown;
  quantity?: unknown;
  total?: unknown;
  item?: { name?: unknown };
};

type AdminOrder = {
  id: string;
  _id?: string;
  orderNumber?: string;
  customer?: unknown;
  customerName?: unknown;
  phone?: unknown;
  address?: unknown;
  deliveryLatitude?: unknown;
  deliveryLongitude?: unknown;
  deliveryTime?: unknown;
  instructions?: unknown;
  specialInstructions?: unknown;
  paymentMethod?: unknown;
  paymentStatus?: unknown;
  orderType?: unknown;
  tableNumber?: unknown;
  table?: unknown;
  status: string;
  cancelledBy?: "customer" | "admin";
  items?: AdminOrderItem[] | string;
  deliveryAgent?: {
    staffId?: string;
    name?: string;
    phone?: string;
  };
  total: number;
  completedAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

function formatOrderStatus(status: string) {
  const statusLabels: Record<string, string> = {
    pending: "Pending",
    placed: "Placed",
    accepted: "Accepted",
    preparing: "Preparing",
    ready: "Ready",
    ready_for_pickup: "Ready",
    out_for_delivery: "Out for Delivery",
    served: "Served",
    delivered: "Delivered",
    cancelled: "Cancelled"
  };
  return statusLabels[status] ?? status;
}

function toApiOrderStatus(status: string) {
  return status.trim().toLowerCase().replace(/\s+/g, "_");
}

function normalizeApiOrder(order: ApiOrder): AdminOrder {
  return {
    id: order.orderNumber || order.id || order._id || "Order",
    _id: order._id,
    orderNumber: order.orderNumber,
    customer: order.customerName ?? order.customer,
    customerName: order.customerName,
    phone: order.phone,
    address: order.address,
    deliveryLatitude: order.deliveryLatitude,
    deliveryLongitude: order.deliveryLongitude,
    deliveryTime: order.deliveryTime,
    instructions: order.specialInstructions,
    specialInstructions: order.specialInstructions,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    orderType: order.orderType,
    tableNumber: order.tableNumber,
    status: formatOrderStatus(order.status),
    cancelledBy: order.cancelledBy,
    items: order.items.map((item) => ({
      name: item.name,
      quantity: item.quantity,
      total: item.price * item.quantity
    })),
    deliveryAgent: order.deliveryAgent,
    total: order.total,
    completedAt: order.completedAt,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };
}

function getMenuItemId(item: MenuItem) {
  return item.id || (item as MenuItem & { _id?: string })._id || "";
}

function getApiSizeOptions(item: Partial<MenuItem>) {
  const sizes = (item.customization?.sizes ?? []) as Array<
    string | { name?: string; priceDelta?: number }
  >;

  return sizes
    .map((size) => {
      if (typeof size === "string") return { name: size, priceDelta: 0 };
      return { name: size.name ?? "", priceDelta: Number(size.priceDelta) || 0 };
    })
    .filter((size) => size.name);
}

function getEditableSizeNames(item: Partial<MenuItem>) {
  return getApiSizeOptions(item)
    .map((size) => size.name)
    .filter((name) => name === "Half" || name === "Full");
}

function getItemPriceBySize(item: Partial<MenuItem>, sizeName: "Half" | "Full") {
  const basePrice = Number(item.price) || 0;
  const matchingSize = getApiSizeOptions(item).find((size) => size.name === sizeName);
  return matchingSize ? basePrice + matchingSize.priceDelta : 0;
}

function getFormPrice(formData: MenuFormData) {
  if (formData.sizes.includes("Half") && formData.prices.Half > 0) return formData.prices.Half;
  if (formData.sizes.includes("Full") && formData.prices.Full > 0) return formData.prices.Full;
  return formData.prices.Standard;
}

function buildMenuPayload(formData: MenuFormData, existingItem?: MenuItem): MenuItemPayload {
  const existingSizes = existingItem ? getApiSizeOptions(existingItem) : [];
  const preserveExistingSizes =
    Boolean(existingItem) && formData.preserveExistingSizes && existingSizes.length > 0;
  const price = preserveExistingSizes ? existingItem!.price : getFormPrice(formData);
  const sizes =
    preserveExistingSizes
      ? existingSizes
      : formData.sizes.length > 0
      ? formData.sizes.map((sizeName) => {
          const sizePrice = sizeName === "Half" ? formData.prices.Half : formData.prices.Full;
          return {
            name: sizeName,
            priceDelta: Math.max(0, sizePrice - price)
          };
        })
      : [{ name: "Regular", priceDelta: 0 }];

  return {
    name: formData.name.trim(),
    category: formData.category,
    price,
    available: formData.available,
    rating: existingItem?.rating ?? 4.5,
    reviews: existingItem?.reviews ?? 0,
    image: formData.image || existingItem?.image || FALLBACK_MENU_IMAGE,
    description: formData.description.trim(),
    ingredients: existingItem?.ingredients ?? [],
    allergens: existingItem?.allergens ?? [],
    customization: {
      sizes,
      spiceLevels: existingItem?.customization?.spiceLevels?.length
        ? existingItem.customization.spiceLevels
        : ["Regular"],
      addOns: existingItem?.customization?.addOns ?? []
    }
  };
}

function buildMenuPayloadFromItem(item: MenuItem, overrides: Partial<MenuItemPayload> = {}): MenuItemPayload {
  const sizeOptions = getApiSizeOptions(item);

  return {
    name: item.name,
    category: item.category,
    price: item.price,
    available: item.available,
    rating: item.rating ?? 4.5,
    reviews: item.reviews ?? 0,
    image: item.image || FALLBACK_MENU_IMAGE,
    description: item.description,
    ingredients: item.ingredients ?? [],
    allergens: item.allergens ?? [],
    customization: {
      sizes: sizeOptions.length > 0 ? sizeOptions : [{ name: "Regular", priceDelta: 0 }],
      spiceLevels: item.customization?.spiceLevels?.length ? item.customization.spiceLevels : ["Regular"],
      addOns: item.customization?.addOns ?? []
    },
    ...overrides
  };
}

function getOrderTableNumber(order: AdminOrder) {
  const tableNumber = order?.tableNumber ?? order?.table;
  if (tableNumber === undefined || tableNumber === null) return "";

  return String(tableNumber).trim();
}

function TableBadge({ tableNumber }: { tableNumber: string }) {
  if (!tableNumber) return null;

  return (
    <span className="inline-flex w-fit items-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-black text-primary shadow-sm">
      <UtensilsCrossed size={13} />
      Table {tableNumber}
    </span>
  );
}

function isDineInOrder(order: AdminOrder) {
  return order.orderType === "dine_in" || Boolean(getOrderTableNumber(order));
}

function OrderTypeBadge({ dineIn }: { dineIn: boolean }) {
  return (
    <span className={`inline-flex w-fit items-center rounded-md border px-2.5 py-1 text-xs font-black ${
      dineIn
        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
        : "border-blue-500/30 bg-blue-500/10 text-blue-400"
    }`}>
      {dineIn ? "Dine-in" : "Delivery"}
    </span>
  );
}

function getOrderProcessStatuses(order: AdminOrder) {
  return isDineInOrder(order)
    ? ["Pending", "Accepted", "Preparing", "Ready", "Delivered"]
    : ["Placed", "Accepted", "Preparing", "Ready", "Out for Delivery", "Delivered"];
}

function getOrderItemsSummary(order: AdminOrder) {
  const items = order?.items;

  if (Array.isArray(items) && items.length > 0) {
    return items
      .map((item) => {
        const quantity = Number(item?.quantity) || 1;
        const name = item?.name ?? item?.item?.name ?? "Item";
        return `${quantity}x ${name}`;
      })
      .join(", ");
  }

  if (typeof items === "string" && items.trim()) return items;

  return "Custom Order";
}

function getOrderText(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed || fallback;
}

function getAdminNextOrderStatuses(order: AdminOrder) {
  const status = toApiOrderStatus(order.status);
  const transitions = isDineInOrder(order)
    ? {
        pending: ["Accepted", "Cancelled"],
        placed: ["Accepted", "Cancelled"],
        accepted: ["Preparing", "Cancelled"],
        preparing: ["Ready", "Cancelled"],
        ready: ["Delivered"],
        ready_for_pickup: ["Delivered"],
        served: [],
        delivered: [],
        cancelled: []
      }
    : {
        pending: ["Accepted", "Cancelled"],
        placed: ["Accepted", "Cancelled"],
        accepted: ["Preparing", "Cancelled"],
        preparing: ["Ready", "Cancelled"],
        ready: ["Out for Delivery", "Cancelled"],
        ready_for_pickup: ["Out for Delivery", "Cancelled"],
        out_for_delivery: ["Delivered"],
        delivered: [],
        cancelled: []
      };
  return transitions[status as keyof typeof transitions] ?? [];
}

function escapeReceiptHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPrintableOrderItems(order: AdminOrder) {
  const items = order.items;

  if (Array.isArray(items) && items.length > 0) {
    return items.map((item) => {
      const quantity = Number(item?.quantity) || 1;
      const total = Number(item?.total);
      return {
        name: getOrderText(item?.name ?? item?.item?.name, "Item"),
        quantity,
        total: Number.isFinite(total) ? total : undefined
      };
    });
  }

  if (typeof items === "string" && items.trim()) {
    return [{ name: items.trim(), quantity: 1, total: undefined }];
  }

  return [{ name: "Custom Order", quantity: 1, total: undefined }];
}

function getOrderPaymentLabel(order: AdminOrder) {
  if (order.paymentMethod === "cash_on_delivery") {
    return isDineInOrder(order) ? "Pay at table" : "COD";
  }
  if (order.paymentMethod === "razorpay") {
    return order.paymentStatus === "paid" ? "Paid via Razorpay" : "Razorpay payment pending";
  }
  return "Payment not recorded";
}

function formatAdminMoney(value: number) {
  return `₹${Math.round(value).toLocaleString("en-IN")}`;
}

function formatAdminDate(value?: string) {
  if (!value) return "Not available";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
      });
}

function isOrderTimerComplete(status: string) {
  return ["delivered", "served", "cancelled"].includes(
    status.trim().toLowerCase()
  );
}

function getOrderTimestamp(value?: string) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}

function formatOrderElapsedTime(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");

  return days > 0 ? `${days}d ${clock}` : clock;
}

function OrderElapsedTimer({ order }: { order: AdminOrder }) {
  const timerComplete = isOrderTimerComplete(order.status);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  useEffect(() => {
    if (timerComplete) return;

    setCurrentTime(Date.now());
    const interval = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [timerComplete]);

  const receivedAt = getOrderTimestamp(order.createdAt);
  const completedAt = timerComplete
    ? getOrderTimestamp(order.completedAt ?? order.updatedAt)
    : null;

  if (receivedAt === null || (timerComplete && completedAt === null)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background/70 px-2.5 py-1 text-[10px] font-bold text-muted-foreground">
        <Clock size={13} />
        Timer unavailable
      </span>
    );
  }

  const elapsed = formatOrderElapsedTime(
    (timerComplete ? completedAt! : currentTime) - receivedAt
  );
  const normalizedStatus = order.status.trim().toLowerCase();
  const label =
    normalizedStatus === "delivered"
      ? "Delivered in"
      : normalizedStatus === "served"
        ? "Served in"
        : normalizedStatus === "cancelled"
          ? "Cancelled after"
          : "Since received";
  const receivedLabel = new Date(receivedAt).toLocaleString("en-IN");

  return (
    <span
      aria-label={`${label} ${elapsed}`}
      title={`Order received ${receivedLabel}`}
      className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 ${
        normalizedStatus === "cancelled"
          ? "border-red-500/30 bg-red-500/10 text-red-400"
          : timerComplete
            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
            : "border-primary/30 bg-primary/10 text-primary"
      }`}
    >
      <Clock size={13} className={timerComplete ? "" : "animate-pulse"} />
      <span className="text-[9px] font-black uppercase tracking-wide opacity-80">
        {label}
      </span>
      <span className="font-mono text-xs font-black tabular-nums">{elapsed}</span>
    </span>
  );
}

function getOrderLocation(order: AdminOrder, tableNumber: string) {
  if (tableNumber) return `Dine-in table ${tableNumber}`;
  return getOrderText(order?.address, "Delivery address not added");
}

function getDeliveryPersonStatusLabel(status: DeliveryPersonStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function getDeliveryPersonStatusColor(status: DeliveryPersonStatus) {
  if (status === "available") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-400";
  }
  if (status === "busy") {
    return "border-amber-500/30 bg-amber-500/10 text-amber-400";
  }
  return "border-slate-500/30 bg-slate-500/10 text-slate-400";
}

function normalizeWhatsAppPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length === 10 ? `91${digits}` : digits;
}

export default function AdminDashboard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileNavigationRef = useRef<HTMLElement>(null);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] =
    useState(false);
  const [authStatus, setAuthStatus] = useState<
    "checking" | "authenticated" | "unauthorized"
  >("checking");
  const [adminUser, setAdminUser] = useState<{
    id: string;
    name: string;
    email: string;
    role: string;
  } | null>(null);

  // --- FUNCTIONAL STATE ---
  const [menuData, setMenuData] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [ordersError, setOrdersError] = useState("");
  const [ordersNotice, setOrdersNotice] = useState("");
  const [isOrdersRefreshing, setIsOrdersRefreshing] = useState(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState<string | null>(null);
  const [orderAlertsEnabled, setOrderAlertsEnabled] = useState(false);
  const [orderAlertMessage, setOrderAlertMessage] = useState("");
  const knownOrderIdsRef = useRef<Set<string>>(new Set());
  const knownOrderStatusesRef = useRef<Map<string, string>>(new Map());
  const hasLoadedOrdersRef = useRef(false);
  const ordersRefreshRequestRef = useRef(0);
  const orderAlertsEnabledRef = useRef(false);
  const orderAlertPlayerRef = useRef<OrderAlertPlayer>({
    audio: null,
    monitorTimer: null
  });
  const [isMenuLoading, setIsMenuLoading] = useState(true);
  const [isSavingMenu, setIsSavingMenu] = useState(false);
  const [menuError, setMenuError] = useState("");
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tablesError, setTablesError] = useState("");
  const [tableNotice, setTableNotice] = useState("");
  const [tableActionId, setTableActionId] = useState<string | null>(null);
  const [isTableModalOpen, setIsTableModalOpen] = useState(false);
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [tableForm, setTableForm] = useState({ tableNumber: 11, label: "" });
  const [appOrigin, setAppOrigin] = useState("");
  const [deliveryPeople, setDeliveryPeople] = useState<DeliveryPerson[]>([]);
  const [isStaffLoading, setIsStaffLoading] = useState(true);
  const [staffError, setStaffError] = useState("");
  const [staffNotice, setStaffNotice] = useState("");
  const [isStaffModalOpen, setIsStaffModalOpen] = useState(false);
  const [isSavingStaff, setIsSavingStaff] = useState(false);
  const [editingDeliveryPerson, setEditingDeliveryPerson] = useState<DeliveryPerson | null>(null);
  const [deliveryPersonForm, setDeliveryPersonForm] = useState<DeliveryPersonFormData>(
    () => createEmptyDeliveryPersonFormData()
  );
  const [assignmentOrderId, setAssignmentOrderId] = useState<string | null>(null);
  const [deliverySelections, setDeliverySelections] = useState<Record<string, string>>({});
  const [assigningOrderId, setAssigningOrderId] = useState<string | null>(null);
  const [assignmentError, setAssignmentError] = useState("");
  const [customers, setCustomers] = useState<AdminCustomer[]>([]);
  const [isCustomersLoading, setIsCustomersLoading] = useState(true);
  const [customerError, setCustomerError] = useState("");
  const [customerNotice, setCustomerNotice] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerStatus, setCustomerStatus] = useState("all");
  const [selectedCustomer, setSelectedCustomer] =
    useState<AdminCustomerDetail | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerNotes, setCustomerNotes] = useState("");
  const [isCustomerActionRunning, setIsCustomerActionRunning] = useState(false);
  const [reportFrom, setReportFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().slice(0, 10);
  });
  const [reportTo, setReportTo] = useState(() =>
    new Date().toISOString().slice(0, 10)
  );
  const [reportData, setReportData] = useState<ReportSummary | null>(null);
  const [dashboardData, setDashboardData] = useState<ReportSummary | null>(null);
  const [isReportLoading, setIsReportLoading] = useState(true);
  const [reportError, setReportError] = useState("");
  const [settingsData, setSettingsData] =
    useState<RestaurantSettingsData | null>(null);
  const [isSettingsLoading, setIsSettingsLoading] = useState(true);
  const [isSettingsSaving, setIsSettingsSaving] = useState(false);
  const [isRestaurantStatusSaving, setIsRestaurantStatusSaving] = useState(false);
  const [settingsError, setSettingsError] = useState("");
  const [settingsNotice, setSettingsNotice] = useState("");
  const [supportData, setSupportData] = useState<SupportIssuePage | null>(null);
  const [supportSearch, setSupportSearch] = useState("");
  const [supportSearchInput, setSupportSearchInput] = useState("");
  const [supportStatus, setSupportStatus] = useState("");
  const [supportPage, setSupportPage] = useState(1);
  const [supportError, setSupportError] = useState("");
  const [supportActionId, setSupportActionId] = useState<string | null>(null);
  const [reviewData, setReviewData] = useState<AdminReviewPage | null>(null);
  const [reviewSearch, setReviewSearch] = useState("");
  const [reviewSearchInput, setReviewSearchInput] = useState("");
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewError, setReviewError] = useState("");
  const [isReviewLoading, setIsReviewLoading] = useState(false);

  // Modal State
  const [isMenuModalOpen, setIsMenuModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  // Form State (Updated with Standard Price)
  const [formData, setFormData] = useState<MenuFormData>(() => createEmptyMenuFormData());
  const [isUploadingMenuImage, setIsUploadingMenuImage] = useState(false);
  const [menuImageError, setMenuImageError] = useState("");

  const refreshMenu = async () => {
    setIsMenuLoading(true);
    setMenuError("");

    try {
      const menu = await fetchMenu();
      setMenuData(menu);
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : "Unable to load menu");
    } finally {
      setIsMenuLoading(false);
    }
  };

  const refreshOrders = async (showLoading = false) => {
    const requestId = ++ordersRefreshRequestRef.current;
    if (showLoading) setIsOrdersRefreshing(true);
    setOrdersError("");
    try {
      const apiOrders = await fetchOrders();
      if (requestId !== ordersRefreshRequestRef.current) return;
      const nextOrders = apiOrders.map(normalizeApiOrder);

      const newOrderCount = hasLoadedOrdersRef.current
        ? nextOrders.filter((order) => !knownOrderIdsRef.current.has(order.id)).length
        : 0;
      const customerCancelledOrders = hasLoadedOrdersRef.current
        ? nextOrders.filter((order) => {
            const previousStatus = knownOrderStatusesRef.current.get(order.id);
            return (
              order.status === "Cancelled" &&
              order.cancelledBy === "customer" &&
              previousStatus !== undefined &&
              previousStatus !== "Cancelled"
            );
          })
        : [];

      nextOrders.forEach((order) => {
        knownOrderIdsRef.current.add(order.id);
        knownOrderStatusesRef.current.set(order.id, order.status);
      });
      hasLoadedOrdersRef.current = true;
      setOrders(nextOrders);

      const alertMessages: string[] = [];
      if (newOrderCount > 0) {
        alertMessages.push(
          `${newOrderCount} new order${newOrderCount === 1 ? "" : "s"} received`
        );
      }
      if (customerCancelledOrders.length > 0) {
        alertMessages.push(
          customerCancelledOrders.length === 1
            ? `${customerCancelledOrders[0].orderNumber ?? customerCancelledOrders[0].id} cancelled by customer`
            : `${customerCancelledOrders.length} orders cancelled by customers`
        );
      }

      if (alertMessages.length > 0 && orderAlertsEnabledRef.current) {
        void playOrderAlertSound(orderAlertPlayerRef.current)
          .then(() => {
            setOrderAlertMessage(alertMessages.join(" • "));
          })
          .catch((error) => {
            console.warn("Unable to play the order alert", error);
            setOrderAlertMessage(
              "Sound was blocked. Click the order sound button to enable it again."
            );
          });
      }
    } catch (error) {
      if (requestId !== ordersRefreshRequestRef.current) return;
      console.error("Unable to refresh admin orders", error);
      setOrdersError(
        error instanceof Error
          ? error.message
          : "Unable to load live orders. The last verified list is still shown."
      );
    } finally {
      if (showLoading) setIsOrdersRefreshing(false);
    }
  };

  const toggleOrderAlerts = async () => {
    const nextEnabled = !orderAlertsEnabledRef.current;
    orderAlertsEnabledRef.current = nextEnabled;
    setOrderAlertsEnabled(nextEnabled);
    window.localStorage.setItem(ORDER_ALERTS_STORAGE_KEY, String(nextEnabled));

    if (!nextEnabled) {
      setOrderAlertMessage("Order alert sound is off");
      stopOrderAlertSound(orderAlertPlayerRef.current);
      return;
    }

    try {
      await playOrderAlertSound(orderAlertPlayerRef.current);
      setOrderAlertMessage("Order alert sound is on");
    } catch (error) {
      console.warn("Unable to enable the order alert", error);
      orderAlertsEnabledRef.current = false;
      setOrderAlertsEnabled(false);
      window.localStorage.setItem(ORDER_ALERTS_STORAGE_KEY, "false");
      setOrderAlertMessage("This browser could not enable sound alerts.");
    }
  };

  const refreshTables = async () => {
    setTablesError("");
    try {
      setTables(await fetchRestaurantTables());
    } catch (error) {
      setTablesError(error instanceof Error ? error.message : "Unable to load table QR codes");
    }
  };

  const refreshDeliveryPeople = async () => {
    setIsStaffLoading(true);
    setStaffError("");
    try {
      setDeliveryPeople(await fetchDeliveryPeople());
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Unable to load delivery people");
    } finally {
      setIsStaffLoading(false);
    }
  };

  const refreshCustomers = async (
    search = customerSearch,
    status = customerStatus
  ) => {
    setIsCustomersLoading(true);
    setCustomerError("");
    try {
      setCustomers(await fetchCustomers(search, status));
    } catch (error) {
      setCustomerError(
        error instanceof Error ? error.message : "Unable to load customers"
      );
    } finally {
      setIsCustomersLoading(false);
    }
  };

  const refreshReports = async (from = reportFrom, to = reportTo) => {
    setIsReportLoading(true);
    setReportError("");
    try {
      setReportData(await fetchReportSummary(from, to));
    } catch (error) {
      setReportError(
        error instanceof Error ? error.message : "Unable to load reports"
      );
    } finally {
      setIsReportLoading(false);
    }
  };

  const refreshSettings = async () => {
    setIsSettingsLoading(true);
    setSettingsError("");
    try {
      setSettingsData(await fetchRestaurantSettings());
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Unable to load settings"
      );
    } finally {
      setIsSettingsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    void fetchCurrentAdmin()
      .then(({ user }) => {
        if (cancelled) return;
        if (user.role !== "admin") throw new Error("Admin access required");
        setAdminUser(user);
        setAuthStatus("authenticated");
      })
      .catch(() => {
        if (cancelled) return;
        setAuthStatus("unauthorized");
        router.replace("/admin/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!isMobileNavigationOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => {
      mobileNavigationRef.current
        ?.querySelector<HTMLElement>("button")
        ?.focus();
    });

    const handleNavigationKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavigationOpen(false);
        mobileMenuButtonRef.current?.focus();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        mobileNavigationRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleNavigationKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleNavigationKeyDown);
    };
  }, [isMobileNavigationOpen]);

  useEffect(() => {
    const player = orderAlertPlayerRef.current;
    const savedPreference =
      window.localStorage.getItem(ORDER_ALERTS_STORAGE_KEY) === "true";
    orderAlertsEnabledRef.current = savedPreference;
    setOrderAlertsEnabled(savedPreference);

    return () => stopOrderAlertSound(player);
  }, []);

  useEffect(() => {
    if (!orderAlertsEnabled) return;

    const unlockAudio = () => {
      void unlockOrderAlertAudio(orderAlertPlayerRef.current).catch(() => {
        // The labelled sound control remains available if the browser blocks this attempt.
      });
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
  }, [orderAlertsEnabled]);

  // Load API-backed dashboard modules only after the admin session is verified.
  useEffect(() => {
    if (authStatus !== "authenticated") return;

    setAppOrigin(window.location.origin);
    void refreshOrders();
    void refreshDashboard();
    void refreshTables();
    void refreshMenu();
    void refreshDeliveryPeople();
    setIsCustomersLoading(true);
    void fetchCustomers("", "all")
      .then(setCustomers)
      .catch((error) =>
        setCustomerError(
          error instanceof Error ? error.message : "Unable to load customers"
        )
      )
      .finally(() => setIsCustomersLoading(false));

    const initialReportTo = new Date();
    const initialReportFrom = new Date();
    initialReportFrom.setDate(initialReportFrom.getDate() - 30);
    setIsReportLoading(true);
    void fetchReportSummary(
      initialReportFrom.toISOString().slice(0, 10),
      initialReportTo.toISOString().slice(0, 10)
    )
      .then(setReportData)
      .catch((error) =>
        setReportError(
          error instanceof Error ? error.message : "Unable to load reports"
        )
      )
      .finally(() => setIsReportLoading(false));
    void refreshSettings();

    const handleStorageChange = () => {
      void refreshOrders();
    };
    const pollOrders = window.setInterval(() => void refreshOrders(), 5000);

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.clearInterval(pollOrders);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [authStatus]);

  const handleAssignSupportIssue = async (issueId: string) => {
    setSupportActionId(issueId);
    setSupportError("");
    try {
      await assignIssueAgent(issueId);
      await refreshSupport();
    } catch (error) {
      setSupportError(error instanceof Error ? error.message : "Unable to assign support ticket");
    } finally {
      setSupportActionId(null);
    }
  };

  const handleResolveSupportIssue = async (issueId: string) => {
    const reason = window.prompt("Resolution note for the customer:", "Issue resolved by restaurant support.");
    if (reason === null) return;
    setSupportActionId(issueId);
    setSupportError("");
    try {
      await decideIssueResolution(issueId, {
        resolutionType: "resolved",
        decisionReason: reason.trim() || "Issue resolved by restaurant support."
      });
      await refreshSupport();
    } catch (error) {
      setSupportError(error instanceof Error ? error.message : "Unable to resolve support ticket");
    } finally {
      setSupportActionId(null);
    }
  };

  // Update Order Status Logic
  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    const matchingOrder = orders.find((order) => order.id === orderId);
    const apiOrderId = matchingOrder?._id || matchingOrder?.orderNumber || orderId;
    ordersRefreshRequestRef.current += 1;
    setOrdersError("");
    setOrdersNotice("");
    setUpdatingOrderId(orderId);
    setUpdatingOrderStatus(newStatus);
    try {
      const apiUpdatedOrder = await updateOrderStatusApi(
        apiOrderId,
        toApiOrderStatus(newStatus)
      );
      const normalizedUpdatedOrder = normalizeApiOrder(apiUpdatedOrder);
      setOrders((current) => current.map((order) =>
        order.id === orderId ? normalizedUpdatedOrder : order
      ));
      knownOrderStatusesRef.current.set(
        normalizedUpdatedOrder.id,
        normalizedUpdatedOrder.status
      );
      setOrdersNotice(
        `${normalizedUpdatedOrder.orderNumber ?? normalizedUpdatedOrder.id} is now ${normalizedUpdatedOrder.status}.`
      );
      void refreshOrders();
      void refreshDashboard();
      if (["Delivered", "Cancelled"].includes(normalizedUpdatedOrder.status)) {
        void refreshDeliveryPeople();
      }
    } catch (error) {
      console.error("Unable to update admin order status", {
        orderId: apiOrderId,
        requestedStatus: toApiOrderStatus(newStatus),
        error
      });
      setOrdersError(
        error instanceof Error
          ? error.message
          : "Unable to update this order. Its verified status was not changed."
      );
    } finally {
      setUpdatingOrderId(null);
      setUpdatingOrderStatus(null);
    }
  };

  const refreshSupport = useCallback(async () => {
    setSupportError("");
    try {
      setSupportData(await fetchAdminIssues({
        page: supportPage,
        limit: 12,
        status: supportStatus,
        search: supportSearch
      }));
    } catch (error) {
      setSupportError(error instanceof Error ? error.message : "Unable to load support queue");
    }
  }, [supportPage, supportSearch, supportStatus]);

  useEffect(() => {
    if (authStatus !== "authenticated" || activeTab !== "Support") return;
    void refreshSupport();
  }, [activeTab, authStatus, refreshSupport]);

  const refreshReviews = useCallback(async () => {
    setIsReviewLoading(true);
    setReviewError("");
    try {
      setReviewData(await fetchAdminReviews({
        page: reviewPage,
        limit: 12,
        rating: reviewRating || undefined,
        search: reviewSearch
      }));
    } catch (error) {
      console.error("Unable to load admin reviews", error);
      setReviewError(
        error instanceof Error ? error.message : "Unable to load customer reviews"
      );
    } finally {
      setIsReviewLoading(false);
    }
  }, [reviewPage, reviewRating, reviewSearch]);

  useEffect(() => {
    if (authStatus !== "authenticated" || activeTab !== "Reviews") return;
    void refreshReviews();
  }, [activeTab, authStatus, refreshReviews]);

  const refreshDashboard = async () => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      setDashboardData(await fetchReportSummary(today, today));
    } catch (error) {
      setOrdersError(
        error instanceof Error ? error.message : "Unable to load dashboard totals"
      );
    }
  };

  const openDeliveryPersonModal = (person?: DeliveryPerson) => {
    setStaffError("");
    setStaffNotice("");
    if (person) {
      setEditingDeliveryPerson(person);
      setDeliveryPersonForm({
        name: person.name,
        phone: person.phone,
        status: person.status
      });
    } else {
      setEditingDeliveryPerson(null);
      setDeliveryPersonForm(createEmptyDeliveryPersonFormData());
    }
    setIsStaffModalOpen(true);
  };

  const handleSaveDeliveryPerson = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSavingStaff(true);
    setStaffError("");
    setStaffNotice("");

    try {
      if (editingDeliveryPerson) {
        const updated = await updateDeliveryPerson(
          editingDeliveryPerson.id,
          deliveryPersonForm
        );
        setDeliveryPeople((current) =>
          current.map((person) =>
            person.id === editingDeliveryPerson.id ? updated : person
          )
        );
        setStaffNotice(`${updated.name} was updated.`);
      } else {
        const created = await createDeliveryPerson(deliveryPersonForm);
        setDeliveryPeople((current) => [created, ...current]);
        setStaffNotice(`${created.name} was added to the delivery team.`);
      }
      setIsStaffModalOpen(false);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Unable to save delivery person");
    } finally {
      setIsSavingStaff(false);
    }
  };

  const handleDeliveryPersonStatusChange = async (
    person: DeliveryPerson,
    status: DeliveryPersonStatus
  ) => {
    setStaffError("");
    setStaffNotice("");
    try {
      const updated = await updateDeliveryPerson(person.id, {
        name: person.name,
        phone: person.phone,
        status
      });
      setDeliveryPeople((current) =>
        current.map((item) => (item.id === person.id ? updated : item))
      );
      setStaffNotice(`${updated.name} is now ${getDeliveryPersonStatusLabel(status)}.`);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Unable to update status");
    }
  };

  const handleDeleteDeliveryPerson = async (person: DeliveryPerson) => {
    if (!window.confirm(`Remove ${person.name} from the delivery team?`)) return;

    setStaffError("");
    setStaffNotice("");
    try {
      await deleteDeliveryPerson(person.id);
      setDeliveryPeople((current) => current.filter((item) => item.id !== person.id));
      setStaffNotice(`${person.name} was removed.`);
    } catch (error) {
      setStaffError(error instanceof Error ? error.message : "Unable to remove delivery person");
    }
  };

  const openDeliveryAssignment = (order: AdminOrder) => {
    const assignedStaffId = order.deliveryAgent?.staffId;
    const firstAvailable = deliveryPeople.find((person) => person.status === "available");
    setDeliverySelections((current) => ({
      ...current,
      [order.id]: assignedStaffId ?? current[order.id] ?? firstAvailable?.id ?? ""
    }));
    setAssignmentError("");
    setAssignmentOrderId((current) => (current === order.id ? null : order.id));
  };

  const handleSendDeliveryWhatsApp = async (order: AdminOrder) => {
    const deliveryPersonId = deliverySelections[order.id];
    const person = deliveryPeople.find((item) => item.id === deliveryPersonId);
    if (!person) {
      setAssignmentError("Select an available delivery person.");
      return;
    }

    const phone = normalizeWhatsAppPhone(person.phone);
    if (phone.length < 10) {
      setAssignmentError("The selected delivery person needs a valid WhatsApp number.");
      return;
    }

    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(
      buildDeliveryWhatsAppMessage(
        order,
        settingsData?.whatsappTemplate
      )
    )}`;
    const whatsappWindow = window.open("about:blank", "_blank");
    if (whatsappWindow) {
      whatsappWindow.opener = null;
      whatsappWindow.document.title = "Opening WhatsApp...";
      whatsappWindow.document.body.textContent = "Opening WhatsApp...";
    }

    setAssigningOrderId(order.id);
    setAssignmentError("");
    try {
      const apiOrderId = order._id || order.orderNumber || order.id;
      const assignedOrder = normalizeApiOrder(
        await assignOrderDelivery(apiOrderId, person.id)
      );
      setOrders((current) =>
        current.map((item) => (item.id === order.id ? assignedOrder : item))
      );
      setDeliveryPeople((current) =>
        current.map((item) =>
          item.id === person.id ? { ...item, status: "busy" } : item
        )
      );
      setOrdersNotice(
        `${person.name} was assigned to ${assignedOrder.orderNumber ?? assignedOrder.id}.`
      );
      void refreshDeliveryPeople();
      setAssignmentOrderId(null);

      if (whatsappWindow) {
        whatsappWindow.location.replace(whatsappUrl);
      } else {
        window.location.href = whatsappUrl;
      }
    } catch (error) {
      whatsappWindow?.close();
      console.error("Unable to assign delivery person", {
        orderId: order._id || order.orderNumber || order.id,
        deliveryPersonId,
        error
      });
      setAssignmentError(error instanceof Error ? error.message : "Unable to assign delivery");
    } finally {
      setAssigningOrderId(null);
    }
  };

  const getTableQrUrl = (table: RestaurantTable) => {
    if (!appOrigin) return "";
    const url = new URL("/menu", appOrigin);
    url.searchParams.set("t", table.qrToken);
    return url.toString();
  };

  const handleCopyTableLink = async (table: RestaurantTable) => {
    const qrUrl = getTableQrUrl(table);
    if (!qrUrl) return;

    await navigator.clipboard.writeText(qrUrl);
    setTableNotice(`${table.label} link copied.`);
  };

  const openTableModal = () => {
    const nextTableNumber =
      tables.reduce((highest, table) => Math.max(highest, table.tableNumber), 0) + 1;
    setTableForm({ tableNumber: nextTableNumber, label: "" });
    setTablesError("");
    setTableNotice("");
    setIsTableModalOpen(true);
  };

  const handleCreateTable = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsCreatingTable(true);
    setTablesError("");
    setTableNotice("");

    try {
      const created = await createRestaurantTable({
        tableNumber: tableForm.tableNumber,
        ...(tableForm.label.trim() ? { label: tableForm.label.trim() } : {})
      });
      setTables((current) =>
        [...current, created].sort(
          (first, second) => first.tableNumber - second.tableNumber
        )
      );
      setTableNotice(`${created.label} was added and its QR code is ready.`);
      setIsTableModalOpen(false);
    } catch (error) {
      setTablesError(error instanceof Error ? error.message : "Unable to add table");
    } finally {
      setIsCreatingTable(false);
    }
  };

  const handleDownloadQr = (table: RestaurantTable) => {
    const svg = document.getElementById(`table-qr-${table.id}`);
    if (!(svg instanceof SVGElement)) return;

    const source = new XMLSerializer().serializeToString(svg);
    const blobUrl = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = `al-arab-${table.label.toLowerCase().replace(/\s+/g, "-")}-qr.svg`;
    link.click();
    URL.revokeObjectURL(blobUrl);
    setTableNotice(`${table.label} QR downloaded.`);
  };

  const handleRegenerateTableQr = async (table: RestaurantTable) => {
    if (!window.confirm(`Regenerate ${table.label}'s QR code? The old printed QR will stop working.`)) return;

    setTableActionId(table.id);
    setTablesError("");
    try {
      const updated = await regenerateRestaurantTableQr(table.id);
      setTables((current) => current.map((item) => item.id === table.id ? updated : item));
      setTableNotice(`${table.label} now has a new QR code.`);
    } catch (error) {
      setTablesError(error instanceof Error ? error.message : "Unable to regenerate QR code");
    } finally {
      setTableActionId(null);
    }
  };

  const handleToggleTable = async (table: RestaurantTable) => {
    setTableActionId(table.id);
    setTablesError("");
    try {
      const updated = await setRestaurantTableActive(table.id, !table.isActive);
      setTables((current) => current.map((item) => item.id === table.id ? updated : item));
      setTableNotice(`${table.label} is now ${updated.isActive ? "active" : "paused"}.`);
    } catch (error) {
      setTablesError(error instanceof Error ? error.message : "Unable to update table");
    } finally {
      setTableActionId(null);
    }
  };

  // --- DELETE MENU ITEM LOGIC ---
  const handleDeleteMenu = async (idToDelete: string) => {
    // Show a browser confirmation popup before deleting
    if (!window.confirm("Are you sure you want to delete this item? This action cannot be undone.")) {
      return;
    }

    const previousMenu = menuData;
    setMenuError("");
    setMenuData(menuData.filter((item) => getMenuItemId(item) !== idToDelete));

    try {
      await deleteMenuItem(idToDelete);
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
    } catch (error) {
      setMenuData(previousMenu);
      setMenuError(error instanceof Error ? error.message : "Unable to delete menu item");
    }
  };

  const handleMenuImageUpload = async (file?: File) => {
    if (!file) return;

    setMenuImageError("");
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      setMenuImageError("Upload a JPG, PNG, or WEBP dish photo.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setMenuImageError("Dish photo must be under 3MB.");
      return;
    }

    setIsUploadingMenuImage(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result === "string") resolve(reader.result);
          else reject(new Error("Unable to read dish photo"));
        };
        reader.onerror = () => reject(new Error("Unable to read dish photo"));
        reader.readAsDataURL(file);
      });
      const uploaded = await uploadMenuImage(file.name, dataUrl);
      setFormData((current) => ({ ...current, image: uploaded.imageUrl }));
    } catch (error) {
      setMenuImageError(error instanceof Error ? error.message : "Unable to upload dish photo");
    } finally {
      setIsUploadingMenuImage(false);
    }
  };

  // Menu Logic
  const handleSaveMenu = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSavingMenu(true);
    setMenuError("");

    try {
      const payload = buildMenuPayload(formData, editingItem ?? undefined);

      if (editingItem) {
        const itemId = getMenuItemId(editingItem);
        const updatedItem = await updateMenuItem(itemId, payload);
        setMenuData((currentMenu) =>
          currentMenu.map((item) => (getMenuItemId(item) === itemId ? updatedItem : item))
        );
      } else {
        const newItem = await createMenuItem(payload);
        setMenuData((currentMenu) => [newItem, ...currentMenu]);
      }

      await queryClient.invalidateQueries({ queryKey: ["menu"] });
      setIsMenuModalOpen(false);
    } catch (error) {
      setMenuError(error instanceof Error ? error.message : "Unable to save menu item");
    } finally {
      setIsSavingMenu(false);
    }
  };

  const handleToggleAvailability = async (item: MenuItem) => {
    const itemId = getMenuItemId(item);
    const nextAvailable = !item.available;
    const previousMenu = menuData;

    setMenuError("");
    setMenuData(menuData.map((menuItem) => (getMenuItemId(menuItem) === itemId ? { ...menuItem, available: nextAvailable } : menuItem)));

    try {
      const updatedItem = await updateMenuItem(itemId, buildMenuPayloadFromItem(item, { available: nextAvailable }));
      setMenuData((currentMenu) =>
        currentMenu.map((menuItem) => (getMenuItemId(menuItem) === itemId ? updatedItem : menuItem))
      );
      await queryClient.invalidateQueries({ queryKey: ["menu"] });
    } catch (error) {
      setMenuData(previousMenu);
      setMenuError(error instanceof Error ? error.message : "Unable to update stock status");
    }
  };

  const openMenuModal = (item?: MenuItem) => {
    setMenuImageError("");
    setIsUploadingMenuImage(false);
    if (item) {
      setEditingItem(item);
      const itemSizes = getEditableSizeNames(item);
      const hasUnsupportedSizes = getApiSizeOptions(item).some(
        (size) => !["Half", "Full", "Regular"].includes(size.name)
      );
      setFormData({
        id: getMenuItemId(item),
        name: item.name,
        description: item.description,
        category: item.category,
        image: item.image,
        available: item.available,
        sizes: itemSizes,
        preserveExistingSizes: hasUnsupportedSizes,
        prices: {
          Half: getItemPriceBySize(item, "Half"),
          Full: getItemPriceBySize(item, "Full"),
          Standard: item.price || 0
        }
      });
    } else {
      setEditingItem(null);
      setFormData(createEmptyMenuFormData());
    }
    setIsMenuModalOpen(true);
  };

  const toggleSize = (size: string) => {
    const newSizes = formData.sizes.includes(size)
      ? formData.sizes.filter(s => s !== size)
      : [...formData.sizes, size];
    setFormData({ ...formData, sizes: newSizes });
  };

  const openCustomerDetails = async (customer: AdminCustomer) => {
    setIsCustomerActionRunning(true);
    setCustomerError("");
    try {
      const detail = await fetchCustomer(customer.id);
      setSelectedCustomer(detail);
      setCustomerNotes(detail.adminNotes ?? "");
      setIsCustomerModalOpen(true);
    } catch (error) {
      setCustomerError(
        error instanceof Error ? error.message : "Unable to load customer"
      );
    } finally {
      setIsCustomerActionRunning(false);
    }
  };

  const handleCustomerBlockedChange = async (
    customer: AdminCustomer | AdminCustomerDetail
  ) => {
    const nextBlocked = !customer.isBlocked;
    let reason: string | undefined;
    if (nextBlocked) {
      const response = window.prompt(
        `Why are you blocking ${customer.name}?`,
        "Account restricted by administrator"
      );
      if (response === null) return;
      reason = response.trim() || undefined;
    } else if (!window.confirm(`Unblock ${customer.name}?`)) {
      return;
    }

    setIsCustomerActionRunning(true);
    setCustomerError("");
    setCustomerNotice("");
    try {
      await setCustomerBlocked(customer.id, nextBlocked, reason);
      await refreshCustomers();
      if (isCustomerModalOpen) {
        const detail = await fetchCustomer(customer.id);
        setSelectedCustomer(detail);
      }
      setCustomerNotice(
        `${customer.name} was ${nextBlocked ? "blocked" : "unblocked"}.`
      );
    } catch (error) {
      setCustomerError(
        error instanceof Error ? error.message : "Unable to update customer"
      );
    } finally {
      setIsCustomerActionRunning(false);
    }
  };

  const handleSaveCustomerNotes = async () => {
    if (!selectedCustomer) return;
    setIsCustomerActionRunning(true);
    setCustomerError("");
    try {
      await updateCustomerNotes(selectedCustomer.id, customerNotes);
      const detail = await fetchCustomer(selectedCustomer.id);
      setSelectedCustomer(detail);
      setCustomerNotice(`Notes for ${selectedCustomer.name} were saved.`);
      await refreshCustomers();
    } catch (error) {
      setCustomerError(
        error instanceof Error ? error.message : "Unable to save notes"
      );
    } finally {
      setIsCustomerActionRunning(false);
    }
  };

  const handleToggleRestaurantOpen = async () => {
    if (!settingsData || isRestaurantStatusSaving) return;

    const previousSettings = settingsData;
    const nextSettings = {
      ...settingsData,
      restaurantOpen: !settingsData.restaurantOpen
    };

    setIsRestaurantStatusSaving(true);
    setSettingsError("");
    setSettingsNotice("");
    setSettingsData(nextSettings);

    try {
      const updated = await updateRestaurantSettings(nextSettings);
      setSettingsData(updated);
      setSettingsNotice(
        updated.restaurantOpen
          ? "Website is online and accepting orders."
          : "Website is offline. Customers cannot place new orders."
      );
    } catch (error) {
      setSettingsData(previousSettings);
      setSettingsError(
        error instanceof Error ? error.message : "Unable to update website status"
      );
    } finally {
      setIsRestaurantStatusSaving(false);
    }
  };

  const handlePrintOrderBill = (order: AdminOrder) => {
    const printWindow = window.open("about:blank", "_blank", "width=420,height=720");
    if (!printWindow) {
      window.alert("Allow pop-ups to print the bill.");
      return;
    }

    const tableNumber = getOrderTableNumber(order);
    const orderMode = isDineInOrder(order)
      ? `Dine-in${tableNumber ? ` - Table ${tableNumber}` : ""}`
      : "Delivery";
    const customerName = getOrderText(order.customer, "Guest customer");
    const customerPhone = getOrderText(order.phone, "Phone not added");
    const deliveryLocation = getOrderLocation(order, tableNumber);
    const billDate = new Date(order.createdAt ?? Date.now()).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short"
    });
    const printableItems = getPrintableOrderItems(order);
    const itemRows = printableItems
      .map((item) => {
        const amount =
          item.total === undefined ? "" : escapeReceiptHtml(formatAdminMoney(item.total));
        return `
          <tr>
            <td>${escapeReceiptHtml(item.quantity)}x ${escapeReceiptHtml(item.name)}</td>
            <td class="amount">${amount}</td>
          </tr>
        `;
      })
      .join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Bill ${escapeReceiptHtml(order.id)}</title>
          <style>
            * { box-sizing: border-box; }
            body {
              margin: 0;
              background: #f6f1ec;
              color: #2d1b17;
              font-family: Arial, sans-serif;
              font-size: 13px;
            }
            .receipt {
              width: 320px;
              margin: 0 auto;
              background: #fffaf5;
              padding: 22px 18px;
            }
            .brand {
              text-align: center;
              border-bottom: 1px dashed #b9a89f;
              padding-bottom: 14px;
            }
            .brand h1 {
              margin: 0;
              font-size: 22px;
              letter-spacing: 2px;
            }
            .brand p, .meta p, .foot {
              margin: 4px 0 0;
              color: #6d5b52;
              line-height: 1.4;
            }
            .meta, .total {
              border-bottom: 1px dashed #b9a89f;
              padding: 12px 0;
            }
            .row {
              display: flex;
              justify-content: space-between;
              gap: 12px;
              margin-top: 5px;
            }
            .row strong {
              color: #2d1b17;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin: 12px 0;
            }
            td {
              padding: 6px 0;
              vertical-align: top;
            }
            .amount {
              text-align: right;
              white-space: nowrap;
              font-weight: 700;
            }
            .total {
              border-top: 1px dashed #b9a89f;
              font-size: 16px;
              font-weight: 800;
            }
            .foot {
              padding-top: 12px;
              text-align: center;
              font-size: 11px;
            }
            @page { margin: 8mm; }
            @media print {
              body { background: white; }
              .receipt { width: 100%; box-shadow: none; }
            }
          </style>
        </head>
        <body>
          <main class="receipt">
            <section class="brand">
              <h1>${escapeReceiptHtml(settingsData?.restaurantName || "AL-ARAB")}</h1>
              <p>${escapeReceiptHtml(settingsData?.address || "Restaurant bill")}</p>
              <p>${escapeReceiptHtml(settingsData?.phone || "")}</p>
            </section>

            <section class="meta">
              <div class="row"><span>Bill</span><strong>${escapeReceiptHtml(order.id)}</strong></div>
              <div class="row"><span>Date</span><strong>${escapeReceiptHtml(billDate)}</strong></div>
              <div class="row"><span>Mode</span><strong>${escapeReceiptHtml(orderMode)}</strong></div>
              <div class="row"><span>Status</span><strong>${escapeReceiptHtml(order.status)}</strong></div>
            </section>

            <section class="meta">
              <div class="row"><span>Customer</span><strong>${escapeReceiptHtml(customerName)}</strong></div>
              <div class="row"><span>Phone</span><strong>${escapeReceiptHtml(customerPhone)}</strong></div>
              <p>${escapeReceiptHtml(deliveryLocation)}</p>
            </section>

            <table>
              <tbody>${itemRows}</tbody>
            </table>

            <section class="total row">
              <span>Total</span>
              <strong>${escapeReceiptHtml(formatAdminMoney(order.total))}</strong>
            </section>

            <p class="foot">${escapeReceiptHtml(getOrderPaymentLabel(order))}</p>
            <p class="foot">Thank you for ordering from Al-Arab.</p>
          </main>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 250);
  };

  const handleExportReport = () => {
    if (!reportData) return;
    const rows = [
      ["Metric", "Value"],
      ["Orders", String(reportData.totals.orders)],
      ["Revenue", String(reportData.totals.revenue)],
      ["Average order value", String(reportData.totals.averageOrderValue)],
      ["Delivery orders", String(reportData.totals.deliveryOrders)],
      ["Dine-in orders", String(reportData.totals.dineInOrders)],
      ["Cancelled orders", String(reportData.totals.cancelledOrders)],
      [],
      ["Top item", "Quantity", "Revenue"],
      ...reportData.topItems.map((item) => [
        item.name,
        String(item.quantity),
        String(item.revenue)
      ])
    ];
    const csv = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`)
          .join(",")
      )
      .join("\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" })
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `al-arab-report-${reportFrom}-to-${reportTo}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleSaveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!settingsData) return;
    setIsSettingsSaving(true);
    setSettingsError("");
    setSettingsNotice("");
    try {
      const updated = await updateRestaurantSettings(settingsData);
      setSettingsData(updated);
      setSettingsNotice("Restaurant settings were saved.");
    } catch (error) {
      setSettingsError(
        error instanceof Error ? error.message : "Unable to save settings"
      );
    } finally {
      setIsSettingsSaving(false);
    }
  };

  const handleAdminLogout = async () => {
    await logoutAdmin();
    router.replace("/admin/login");
    router.refresh();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Pending": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Placed": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Accepted": return "bg-blue-500/20 text-blue-400 border-blue-500/30";
      case "Preparing": return "bg-primary/20 text-primary border-primary/30";
      case "Ready": return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
      case "Served": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Out for Delivery": return "bg-orange-500/20 text-orange-400 border-orange-500/30";
      case "Delivered": return "bg-green-500/20 text-green-400 border-green-500/30";
      case "Cancelled": return "bg-red-500/20 text-red-400 border-red-500/30";
      default: return "bg-foreground/10 text-foreground border-border";
    }
  };

  const renderRestaurantStatusButton = (placement: "header" | "toolbar") => {
    const hasSettings = Boolean(settingsData);
    const restaurantIsOpen = Boolean(settingsData?.restaurantOpen);
    const isWorking = isRestaurantStatusSaving;
    const label = !hasSettings
      ? "Loading status"
      : restaurantIsOpen
        ? "Website online"
        : "Website offline";
    const toneClass = !hasSettings
      ? "border-border bg-card text-muted-foreground"
      : restaurantIsOpen
        ? "border-emerald-500/35 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/15"
        : "border-red-500/35 bg-red-500/10 text-red-400 hover:bg-red-500/15";
    const placementClass =
      placement === "header"
        ? "hidden lg:inline-flex min-h-10 px-3 text-xs"
        : "inline-flex min-h-10 px-3 py-2 text-xs";

    return (
      <button
        type="button"
        disabled={!hasSettings || isWorking}
        onClick={() => void handleToggleRestaurantOpen()}
        aria-pressed={restaurantIsOpen}
        title={
          restaurantIsOpen
            ? "Click to take the customer website offline"
            : "Click to put the customer website online"
        }
        className={`${placementClass} items-center gap-2 rounded-xl border font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-wait disabled:opacity-60 ${toneClass}`}
      >
        {isWorking ? (
          <RefreshCw size={15} className="animate-spin" />
        ) : (
          <Power size={15} />
        )}
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            restaurantIsOpen ? "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.75)]" : "bg-red-400"
          }`}
        />
        {isWorking ? "Saving..." : label}
      </button>
    );
  };

  const sidebarLinks = [
    { name: "Dashboard", icon: LayoutDashboard },
    { name: "Live Orders", icon: ShoppingBag },
    { name: "Menu Management", icon: UtensilsCrossed },
    { name: "Table QR Codes", icon: QrCode },
    { name: "Delivery Staff", icon: Bike },
    { name: "Customers", icon: UserCircle },
    { name: "Reviews", icon: Star },
    { name: "Support", icon: MessageCircle },
    { name: "Reports", icon: BarChart3 },
    { name: "Settings", icon: Settings },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case "Dashboard":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { label: "Today's Orders", value: dashboardData?.totals.orders ?? "--", icon: ShoppingBag },
                { label: "Today's Revenue", value: dashboardData ? formatAdminMoney(dashboardData.totals.revenue) : "--", icon: BarChart3 },
                { label: "Customer Feedback", value: dashboardData ? `${dashboardData.feedback.averageRating.toFixed(1)} (${dashboardData.feedback.reviewCount})` : "--", icon: Star },
              ].map((stat, idx) => (
                <div key={idx} className="bg-card border border-border rounded-2xl p-5 shadow-sm hover:border-primary/30 transition-colors">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <h3 className="text-3xl font-heading font-medium text-foreground mt-2">{stat.value}</h3>
                    </div>
                    <div className="h-10 w-10 rounded-xl bg-background border border-border flex items-center justify-center text-primary">
                      <stat.icon size={18} />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-card border border-border rounded-2xl shadow-sm overflow-hidden flex flex-col">
              <div className="p-5 border-b border-border">
                <h3 className="font-heading text-xl font-medium text-foreground">Recent Activity</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-background/50 text-muted-foreground font-medium border-b border-border">
                    <tr>
                      <th className="px-6 py-4">Order ID</th>
                      <th className="px-6 py-4">Items</th>
                      <th className="px-6 py-4">Total</th>
                      <th className="px-6 py-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.slice(0, 5).map((order) => {
                      const tableNumber = getOrderTableNumber(order);
                      const dineIn = isDineInOrder(order);

                      return (
                      <tr key={order.id} className="hover:bg-foreground/[0.02] transition-colors">
                        <td className="px-6 py-4 font-bold text-foreground">
                          <div className="flex flex-col gap-2">
                            <span>{order.id}</span>
                            <div className="flex flex-wrap gap-2">
                              <OrderTypeBadge dineIn={dineIn} />
                              <TableBadge tableNumber={tableNumber} />
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{getOrderItemsSummary(order)}</td>
                        <td className="px-6 py-4 font-bold">₹{order.total}</td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold border ${getStatusColor(order.status)}`}>{order.status}</span>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );

      case "Live Orders":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="font-heading text-2xl font-medium text-foreground">New Orders Received</h3>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void toggleOrderAlerts()}
                  aria-pressed={orderAlertsEnabled}
                  title={
                    orderAlertsEnabled
                      ? "Turn off order alert sound"
                      : "Turn on order alert sound and play a test chime"
                  }
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                    orderAlertsEnabled
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-card text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  }`}
                >
                  {orderAlertsEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                  {orderAlertsEnabled ? "Order sound on" : "Enable order sound"}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshOrders(true)}
                  disabled={isOrdersRefreshing}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 py-2 text-sm font-bold text-primary transition hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw size={15} className={isOrdersRefreshing ? "animate-spin" : ""} />
                  {isOrdersRefreshing ? "Refreshing..." : "Refresh"}
                </button>
                <span className="sr-only" role="status" aria-live="polite">
                  {orderAlertMessage}
                </span>
              </div>
            </div>

            {(settingsError || settingsNotice) && (
              <p
                role={settingsError ? "alert" : "status"}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                  settingsError
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {settingsError || settingsNotice}
              </p>
            )}
            {ordersError && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">
                {ordersError}
              </p>
            )}
            {ordersNotice && !ordersError && (
              <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-400">
                {ordersNotice}
              </p>
            )}

            <div className="grid gap-4">
              {orders.map((order) => {
                const tableNumber = getOrderTableNumber(order);
                const dineIn = isDineInOrder(order);
                const customerName = getOrderText(order.customer, "Guest customer");
                const customerPhone = getOrderText(order.phone, "Phone not added");
                const deliveryLocation = getOrderLocation(order, tableNumber);
                const deliveryTime = getOrderText(order.deliveryTime, "ASAP");
                const instructions = getOrderText(order.instructions, "");
                const isCancelled = order.status === "Cancelled";
                const isCompleted = isCancelled || order.status === "Delivered";
                const eligibleDeliveryPeople = deliveryPeople.filter(
                  (person) =>
                    person.status === "available" ||
                    person.id === order.deliveryAgent?.staffId
                );

                return (
                <div key={order.id} className="bg-card border border-border rounded-2xl p-5 shadow-sm">
                  <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-bold text-lg text-foreground">{order.id}</h4>
                      <OrderTypeBadge dineIn={dineIn} />
                      <TableBadge tableNumber={tableNumber} />
                      <span className={`px-2.5 py-0.5 rounded-md text-xs font-bold border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                      <OrderElapsedTimer order={order} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {getOrderItemsSummary(order)}
                    </p>

                    <div className="mt-4 grid gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                          <User size={14} className="text-primary" />
                          Customer
                        </div>
                        <p className="mt-2 truncate text-sm font-bold text-foreground">{customerName}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <Phone size={13} />
                          <span className="truncate">{customerPhone}</span>
                        </p>
                      </div>

                      <div className="rounded-xl border border-border bg-background/60 p-3">
                        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide text-muted-foreground">
                          <MapPin size={14} className="text-primary" />
                          {dineIn ? "Table Service" : "Delivery Location"}
                        </div>
                        <p className="mt-2 line-clamp-2 text-sm font-bold text-foreground">{deliveryLocation}</p>
                        <p className="mt-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                          <Clock size={13} />
                          <span>{deliveryTime}</span>
                        </p>
                      </div>
                    </div>

                    {instructions && (
                      <p className="mt-3 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary">
                        Note: {instructions}
                      </p>
                    )}
                    <p className="text-xs font-bold text-foreground mt-2">Total: <span className="text-primary">₹{order.total}</span> • {getOrderPaymentLabel(order)}</p>

                    {!dineIn && (
                      <section className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.06] p-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                              <Bike size={17} />
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs font-black uppercase tracking-wide text-muted-foreground">
                                Delivery assignment
                              </p>
                              <p className="mt-0.5 truncate text-sm font-bold text-foreground">
                                {order.deliveryAgent?.name
                                  ? `${order.deliveryAgent.name} · ${order.deliveryAgent.phone ?? ""}`
                                  : "No delivery person assigned"}
                              </p>
                            </div>
                          </div>

                          {!isCompleted && (
                            <button
                              type="button"
                              onClick={() => openDeliveryAssignment(order)}
                              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-xs font-black text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              <Users size={15} />
                              {order.deliveryAgent?.name ? "Reassign Delivery" : "Assign Delivery"}
                            </button>
                          )}
                        </div>

                        {assignmentOrderId === order.id && !isCompleted && (
                          <div className="mt-3 grid gap-3 border-t border-primary/15 pt-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                            <label className="min-w-0">
                              <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                                Select delivery person
                              </span>
                              <select
                                value={deliverySelections[order.id] ?? ""}
                                onChange={(event) => {
                                  setDeliverySelections((current) => ({
                                    ...current,
                                    [order.id]: event.target.value
                                  }));
                                  setAssignmentError("");
                                }}
                                className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                              >
                                <option value="">Choose an available person</option>
                                {eligibleDeliveryPeople.map((person) => (
                                  <option key={person.id} value={person.id}>
                                    {person.name} · {person.phone} · {getDeliveryPersonStatusLabel(person.status)}
                                  </option>
                                ))}
                              </select>
                            </label>

                            <button
                              type="button"
                              disabled={
                                assigningOrderId === order.id ||
                                !deliverySelections[order.id]
                              }
                              onClick={() => void handleSendDeliveryWhatsApp(order)}
                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 text-xs font-black text-[#07140b] shadow-sm transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#25D366] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <MessageCircle size={16} />
                              {assigningOrderId === order.id
                                ? "Assigning..."
                                : "Send to WhatsApp"}
                              <Send size={14} />
                            </button>

                            {eligibleDeliveryPeople.length === 0 && (
                              <p className="text-xs font-semibold text-amber-400 lg:col-span-2">
                                No one is available. Add a delivery person or change their status in Delivery Staff.
                              </p>
                            )}
                            {assignmentError && (
                              <p role="alert" className="text-xs font-semibold text-red-400 lg:col-span-2">
                                {assignmentError}
                              </p>
                            )}
                          </div>
                        )}
                      </section>
                    )}
                  </div>

                    {/* Status Updater */}
                    <div className="w-full rounded-xl border border-border bg-background p-2 xl:w-auto">
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:flex xl:flex-wrap xl:items-center">
                        {getOrderProcessStatuses(order).map((status) => {
                          const canApplyStatus = getAdminNextOrderStatuses(order).includes(status);
                          return (
                          <button
                            key={status}
                            type="button"
                            disabled={order.status === status || !canApplyStatus || updatingOrderId === order.id}
                            onClick={() => void updateOrderStatus(order.id, status)}
                            className={`min-h-9 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                              order.status === status
                                ? "cursor-default bg-primary text-primary-foreground shadow-sm"
                                : "text-muted-foreground hover:bg-foreground/10"
                            }`}
                          >
                            {updatingOrderId === order.id && updatingOrderStatus === status
                              ? "Updating..."
                              : status}
                          </button>
                          );
                        })}
                      </div>
                      <button
                        type="button"
                        onClick={() => handlePrintOrderBill(order)}
                        className="mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border border-primary/25 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary transition-all hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        <ReceiptText size={14} />
                        Print bill
                      </button>
                      <button
                        type="button"
                        disabled={isCancelled || !getAdminNextOrderStatuses(order).includes("Cancelled") || updatingOrderId === order.id}
                        onClick={() => {
                          if (window.confirm(`Cancel order ${order.id}?`)) {
                            void updateOrderStatus(order.id, "Cancelled");
                          }
                        }}
                        className={`mt-2 flex min-h-9 w-full items-center justify-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-black transition-all ${
                          isCancelled
                            ? "cursor-default border-red-500 bg-red-500 text-white"
                            : "border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        }`}
                      >
                        <XCircle size={14} />
                        {updatingOrderId === order.id && updatingOrderStatus === "Cancelled"
                          ? "Cancelling..."
                          : isCancelled
                            ? "Cancelled"
                            : "Cancel Order"}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })}
              {orders.length === 0 && (
                <div className="text-center py-20 text-muted-foreground">No live orders found. Go to the mobile app and place one!</div>
              )}
            </div>
          </div>
        );

      case "Menu Management":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground">Overview of menu management</p>
              <div className="flex items-center gap-3">
                <button onClick={() => void refreshMenu()} disabled={isMenuLoading} className="text-sm font-bold text-primary hover:opacity-80 disabled:opacity-50">
                  Refresh
                </button>
                <button onClick={() => openMenuModal()} className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-bold text-sm hover:opacity-90 transition-opacity shadow-sm">
                  <Plus size={16} /> Add New Item
                </button>
              </div>
            </div>

            {menuError && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400">
                {menuError}
              </div>
            )}

            {isMenuLoading && (
              <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">
                Loading menu...
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {menuData.map((item) => {
                const sizeOptions = getApiSizeOptions(item);
                const halfSize = sizeOptions.find((size) => size.name === "Half");
                const fullSize = sizeOptions.find((size) => size.name === "Full");

                return (
                <div key={getMenuItemId(item)} className={`bg-card border border-border rounded-2xl overflow-hidden shadow-sm hover:border-primary/30 transition-all group flex flex-col ${!item.available && "opacity-60"}`}>
                  <div className="relative h-48 w-full bg-background border-b border-border shrink-0">
                    <Image src={item.image || FALLBACK_MENU_IMAGE} alt={item.name} fill className="object-cover group-hover:scale-105 transition-transform duration-500" />
                    {!item.available && (
                      <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] flex items-center justify-center">
                        <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full uppercase tracking-wider">Out of Stock</span>
                      </div>
                    )}
                  </div>
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-foreground text-lg leading-tight w-2/3 pr-2">{item.name}</h3>
                      {/* Price Display Logic */}
                      <div className="text-right flex flex-col justify-start w-1/3">
                        {halfSize && fullSize ? (
                          <>
                            <span className="font-heading text-lg font-bold text-primary leading-none">₹{item.price + fullSize.priceDelta} <span className="text-[10px] text-muted-foreground font-normal tracking-wide uppercase">Full</span></span>
                            <span className="text-sm font-bold text-primary/80 leading-tight mt-1">₹{item.price + halfSize.priceDelta} <span className="text-[10px] text-muted-foreground font-normal tracking-wide uppercase">Half</span></span>
                          </>
                        ) : (
                          <p className="font-heading text-lg font-bold text-primary">₹{item.price}</p>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed flex-1">
                      {item.description}
                    </p>

                    <div className="mt-5 space-y-3 border-t border-border pt-4">
                      <button
                        onClick={() => void handleToggleAvailability(item)}
                        className={`flex min-h-11 w-full items-center gap-2 rounded-xl border px-3 py-2 text-xs font-black transition-colors ${
                          item.available
                            ? "border-green-500/25 bg-green-500/10 text-green-400 hover:bg-green-500/15"
                            : "border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/15"
                        }`}
                      >
                        <span className={`relative h-5 w-9 shrink-0 rounded-full p-0.5 transition-colors ${item.available ? "bg-green-500" : "bg-red-500/70"}`}>
                          <span className={`block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${item.available ? "translate-x-4" : "translate-x-0"}`} />
                        </span>
                        <span className="min-w-0 leading-tight">{item.available ? "Active" : "Out of Stock"}</span>
                      </button>

                      <div className="grid grid-cols-2 gap-2">
                        <button onClick={() => openMenuModal(item)} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-2 text-xs font-black text-primary transition-colors hover:bg-primary/20">
                          <Edit2 size={14} /> Edit
                        </button>
                        <button onClick={() => void handleDeleteMenu(getMenuItemId(item))} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-black text-red-400 transition-colors hover:bg-red-500/20">
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        );

      case "Customers": {
        const blockedCustomers = customers.filter(
          (customer) => customer.isBlocked
        ).length;
        const customerRevenue = customers.reduce(
          (sum, customer) => sum + customer.totalSpent,
          0
        );

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-primary">
                    <Users size={14} />
                    Customer intelligence
                  </div>
                  <h3 className="mt-3 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                    Customers
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                    Review customer value, order activity, account status and internal service notes.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void refreshCustomers()}
                  disabled={isCustomersLoading}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/20 disabled:opacity-50"
                >
                  <RefreshCw
                    size={16}
                    className={isCustomersLoading ? "animate-spin" : ""}
                  />
                  Refresh customers
                </button>
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total customers",
                  value: customers.length,
                  icon: Users
                },
                {
                  label: "Active",
                  value: customers.length - blockedCustomers,
                  icon: UserCheck
                },
                {
                  label: "Blocked",
                  value: blockedCustomers,
                  icon: UserX
                },
                {
                  label: "Customer revenue",
                  value: formatAdminMoney(customerRevenue),
                  icon: TrendingUp
                }
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                        {item.label}
                      </p>
                      <p className="mt-2 font-heading text-3xl font-semibold text-foreground">
                        {item.value}
                      </p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                      <item.icon size={18} />
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(event) => {
                event.preventDefault();
                void refreshCustomers();
              }}
              className="grid gap-3 rounded-2xl border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_180px_auto]"
            >
              <label className="relative">
                <Search
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
                />
                <input
                  type="search"
                  value={customerSearch}
                  onChange={(event) => setCustomerSearch(event.target.value)}
                  className="min-h-11 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                  placeholder="Search name, phone or email"
                />
              </label>
              <select
                value={customerStatus}
                onChange={(event) => {
                  const status = event.target.value;
                  setCustomerStatus(status);
                  void refreshCustomers(customerSearch, status);
                }}
                className="min-h-11 rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
              >
                <option value="all">All customers</option>
                <option value="active">Active only</option>
                <option value="blocked">Blocked only</option>
              </select>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground"
              >
                <Search size={16} />
                Search
              </button>
            </form>

            {(customerError || customerNotice) && (
              <div
                role={customerError ? "alert" : "status"}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                  customerError
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {customerError || customerNotice}
              </div>
            )}

            <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead className="border-b border-border bg-background/60 text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="px-5 py-4">Customer</th>
                      <th className="px-5 py-4">Contact</th>
                      <th className="px-5 py-4">Orders</th>
                      <th className="px-5 py-4">Total spent</th>
                      <th className="px-5 py-4">Last order</th>
                      <th className="px-5 py-4">Status</th>
                      <th className="px-5 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="transition hover:bg-foreground/[0.025]"
                      >
                        <td className="px-5 py-4">
                          <p className="font-black text-foreground">
                            {customer.name}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">
                            Joined {formatAdminDate(customer.joinedAt)}
                          </p>
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-muted-foreground">
                          <p>{customer.phone || "Phone unavailable"}</p>
                          <p className="mt-1">{customer.email || "Email unavailable"}</p>
                        </td>
                        <td className="px-5 py-4 font-bold text-foreground">
                          {customer.orderCount}
                        </td>
                        <td className="px-5 py-4 font-black text-primary">
                          {formatAdminMoney(customer.totalSpent)}
                        </td>
                        <td className="px-5 py-4 text-xs font-semibold text-muted-foreground">
                          {formatAdminDate(customer.lastOrderAt)}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                              customer.isBlocked
                                ? "border-red-500/30 bg-red-500/10 text-red-400"
                                : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                            }`}
                          >
                            {customer.isBlocked ? "Blocked" : "Active"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              disabled={isCustomerActionRunning}
                              onClick={() => void openCustomerDetails(customer)}
                              className="min-h-9 rounded-lg border border-primary/25 bg-primary/10 px-3 text-xs font-black text-primary transition hover:bg-primary/20 disabled:opacity-50"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              disabled={isCustomerActionRunning}
                              onClick={() =>
                                void handleCustomerBlockedChange(customer)
                              }
                              className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg border px-3 text-xs font-black transition disabled:opacity-50 ${
                                customer.isBlocked
                                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                                  : "border-red-500/25 bg-red-500/10 text-red-400"
                              }`}
                            >
                              {customer.isBlocked ? (
                                <Unlock size={13} />
                              ) : (
                                <Ban size={13} />
                              )}
                              {customer.isBlocked ? "Unblock" : "Block"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {isCustomersLoading && customers.length === 0 && (
                <div className="p-12 text-center text-sm font-semibold text-muted-foreground">
                  Loading customers...
                </div>
              )}
              {!isCustomersLoading &&
                !customerError &&
                customers.length === 0 && (
                  <div className="p-12 text-center">
                    <Users size={30} className="mx-auto text-primary" />
                    <p className="mt-3 font-heading text-xl font-semibold text-foreground">
                      No customers found
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Customer profiles appear after accounts or orders are created.
                    </p>
                  </div>
                )}
            </div>
          </div>
        );
      }

      case "Delivery Staff": {
        const statusCounts = {
          available: deliveryPeople.filter((person) => person.status === "available").length,
          busy: deliveryPeople.filter((person) => person.status === "busy").length,
          offline: deliveryPeople.filter((person) => person.status === "offline").length
        };

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-primary">
                    <Bike size={14} />
                    Delivery operations
                  </div>
                  <h3 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                    Delivery Person Management
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Manage WhatsApp-enabled delivery people and their live availability for order assignments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openDeliveryPersonModal()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <Plus size={17} />
                  Add delivery person
                </button>
              </div>
            </section>

            <div className="grid gap-4 sm:grid-cols-3">
              {([
                ["available", "Available", statusCounts.available],
                ["busy", "Busy", statusCounts.busy],
                ["offline", "Offline", statusCounts.offline]
              ] as Array<[DeliveryPersonStatus, string, number]>).map(([status, label, count]) => (
                <div key={status} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">{label}</p>
                      <p className="mt-2 font-heading text-3xl font-semibold text-foreground">{count}</p>
                    </div>
                    <span className={`h-3 w-3 rounded-full border ${getDeliveryPersonStatusColor(status)}`} />
                  </div>
                </div>
              ))}
            </div>

            {(staffError || staffNotice) && (
              <div
                role={staffError ? "alert" : "status"}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                  staffError
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {staffError || staffNotice}
              </div>
            )}

            <div className="flex items-center justify-between gap-3">
              <div>
                <h4 className="font-heading text-xl font-semibold text-foreground">Delivery team</h4>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  Only Available people appear for new delivery assignments.
                </p>
              </div>
              <button
                type="button"
                onClick={() => void refreshDeliveryPeople()}
                disabled={isStaffLoading}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-black text-primary transition hover:border-primary/40 disabled:opacity-50"
              >
                <RefreshCw size={14} className={isStaffLoading ? "animate-spin" : ""} />
                Refresh
              </button>
            </div>

            {isStaffLoading && deliveryPeople.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">
                Loading delivery people...
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {deliveryPeople.map((person) => (
                <article key={person.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm transition hover:border-primary/35">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                        <Bike size={22} />
                      </span>
                      <div className="min-w-0">
                        <h5 className="truncate text-base font-black text-foreground">{person.name}</h5>
                        <a
                          href={`https://wa.me/${normalizeWhatsAppPhone(person.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 inline-flex items-center gap-1.5 text-xs font-bold text-[#25D366] hover:underline"
                        >
                          <MessageCircle size={13} />
                          {person.phone}
                        </a>
                      </div>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${getDeliveryPersonStatusColor(person.status)}`}>
                      {getDeliveryPersonStatusLabel(person.status)}
                    </span>
                  </div>

                  <label className="mt-5 block">
                    <span className="mb-1.5 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      Current status
                    </span>
                    <select
                      value={person.status}
                      onChange={(event) =>
                        void handleDeliveryPersonStatusChange(
                          person,
                          event.target.value as DeliveryPersonStatus
                        )
                      }
                      className="min-h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                    >
                      <option value="available">Available</option>
                      <option value="busy">Busy</option>
                      <option value="offline">Offline</option>
                    </select>
                  </label>

                  <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border pt-4">
                    <button
                      type="button"
                      onClick={() => openDeliveryPersonModal(person)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-xs font-black text-primary transition hover:bg-primary/20"
                    >
                      <Edit2 size={14} />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteDeliveryPerson(person)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-red-500/25 bg-red-500/10 px-3 text-xs font-black text-red-400 transition hover:bg-red-500/20"
                    >
                      <Trash2 size={14} />
                      Remove
                    </button>
                  </div>
                </article>
              ))}
            </div>

            {!isStaffLoading && !staffError && deliveryPeople.length === 0 && (
              <div className="rounded-2xl border border-dashed border-primary/30 bg-primary/[0.04] p-12 text-center">
                <Bike size={32} className="mx-auto text-primary" />
                <h4 className="mt-4 font-heading text-xl font-semibold text-foreground">
                  No delivery people yet
                </h4>
                <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
                  Add your first WhatsApp-enabled delivery person to start assigning delivery orders.
                </p>
                <button
                  type="button"
                  onClick={() => openDeliveryPersonModal()}
                  className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground"
                >
                  <Plus size={16} />
                  Add delivery person
                </button>
              </div>
            )}
          </div>
        );
      }

      case "Reviews": {
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="font-heading text-2xl font-semibold text-foreground">
                  Verified customer reviews
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Read individual ratings and comments submitted after completed orders.
                </p>
              </div>

              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  setReviewPage(1);
                  setReviewSearch(reviewSearchInput.trim());
                }}
              >
                <label className="relative">
                  <span className="sr-only">Search reviews</span>
                  <Search
                    size={16}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  />
                  <input
                    type="search"
                    value={reviewSearchInput}
                    onChange={(event) => setReviewSearchInput(event.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-64"
                    placeholder="Customer, order, dish, comment"
                  />
                </label>
                <select
                  value={reviewRating}
                  onChange={(event) => {
                    setReviewRating(Number(event.target.value));
                    setReviewPage(1);
                  }}
                  aria-label="Filter reviews by rating"
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                >
                  <option value={0}>All ratings</option>
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating} star{rating === 1 ? "" : "s"}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={isReviewLoading}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground disabled:cursor-wait disabled:opacity-60"
                >
                  {isReviewLoading ? (
                    <RefreshCw size={15} className="animate-spin" />
                  ) : (
                    <Search size={15} />
                  )}
                  {isReviewLoading ? "Loading..." : "Search"}
                </button>
                <button
                  type="button"
                  onClick={() => void refreshReviews()}
                  disabled={isReviewLoading}
                  aria-label="Refresh customer reviews"
                  title="Refresh customer reviews"
                  className="inline-flex h-11 items-center justify-center rounded-xl border border-border px-3 text-primary transition hover:border-primary/40 hover:bg-primary/10 disabled:cursor-wait disabled:opacity-60"
                >
                  <RefreshCw size={16} className={isReviewLoading ? "animate-spin" : ""} />
                </button>
              </form>
            </div>

            {reviewError && (
              <p
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400"
              >
                {reviewError}
              </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-muted-foreground">
                {reviewData
                  ? `${reviewData.pagination.total} verified review${reviewData.pagination.total === 1 ? "" : "s"}`
                  : "Loading verified reviews..."}
              </p>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              {reviewData?.reviews.map((review) => (
                <article
                  key={review.id}
                  className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-black text-foreground">
                        {review.customerName}
                      </h4>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">
                        {formatAdminDate(review.createdAt)}
                      </p>
                    </div>
                    <div
                      className="flex items-center gap-1 text-primary"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={16}
                          className={star <= review.rating ? "fill-current" : "opacity-25"}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-bold">
                    <span className="rounded-lg border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-primary">
                      {review.menuItemName}
                    </span>
                    <span className="rounded-lg border border-border px-2.5 py-1.5 text-muted-foreground">
                      {review.orderNumber || "Order unavailable"}
                    </span>
                  </div>

                  <blockquote className="mt-4 whitespace-pre-wrap break-words rounded-xl border border-border bg-background/60 px-4 py-3 text-sm leading-6 text-foreground">
                    {review.comment || "No written comment."}
                  </blockquote>
                </article>
              ))}
            </div>

            {isReviewLoading && !reviewData && (
              <div
                role="status"
                className="rounded-2xl border border-border bg-card p-12 text-center text-sm font-semibold text-muted-foreground"
              >
                Loading customer reviews...
              </div>
            )}

            {reviewData && reviewData.reviews.length === 0 && !isReviewLoading && (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm font-semibold text-muted-foreground">
                No customer reviews match these filters.
              </div>
            )}

            {reviewData && reviewData.pagination.pages > 1 && (
              <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Page {reviewData.pagination.page} of {reviewData.pagination.pages} ·{" "}
                  {reviewData.pagination.total} reviews
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={reviewPage <= 1 || isReviewLoading}
                    onClick={() => setReviewPage((page) => page - 1)}
                    className="h-10 rounded-xl border border-border px-4 text-sm font-bold disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={
                      reviewPage >= reviewData.pagination.pages || isReviewLoading
                    }
                    onClick={() => setReviewPage((page) => page + 1)}
                    className="h-10 rounded-xl border border-border px-4 text-sm font-bold disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      }

      case "Support": {
        return (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h3 className="font-heading text-2xl font-semibold text-foreground">Customer support queue</h3>
                <p className="mt-1 text-sm text-muted-foreground">Assign, discuss, and resolve restaurant support tickets.</p>
              </div>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event) => {
                  event.preventDefault();
                  setSupportPage(1);
                  setSupportSearch(supportSearchInput.trim());
                }}
              >
                <div className="relative">
                  <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={supportSearchInput}
                    onChange={(event) => setSupportSearchInput(event.target.value)}
                    className="h-11 w-full rounded-xl border border-border bg-card pl-9 pr-3 text-sm outline-none focus:border-primary sm:w-64"
                    placeholder="Order, customer, phone"
                  />
                </div>
                <select
                  value={supportStatus}
                  onChange={(event) => {
                    setSupportStatus(event.target.value);
                    setSupportPage(1);
                  }}
                  className="h-11 rounded-xl border border-border bg-card px-3 text-sm outline-none focus:border-primary"
                >
                  <option value="">All statuses</option>
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="refunded">Refunded</option>
                  <option value="closed">Closed</option>
                </select>
                <button className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground">
                  <Search size={15} /> Search
                </button>
              </form>
            </div>

            {supportError && (
              <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400">{supportError}</p>
            )}

            <div className="grid gap-4 xl:grid-cols-2">
              {supportData?.issues.map((issue) => {
                const issueId = issue._id || issue.id;
                const isClosed = ["resolved", "refunded", "closed"].includes(issue.status);
                return (
                  <article key={issueId} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-heading text-lg font-semibold text-foreground">{issue.orderNumber}</p>
                        <p className="mt-1 text-xs font-bold uppercase text-primary">{issue.category.replace(/_/g, " ")}</p>
                      </div>
                      <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black capitalize text-primary">{issue.status}</span>
                    </div>
                    <p className="mt-4 text-sm font-bold text-foreground">{issue.customerName}</p>
                    <p className="mt-1 line-clamp-3 text-sm leading-6 text-muted-foreground">{issue.description}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
                      <span className="rounded-lg border border-border px-2.5 py-1.5">{issue.phone}</span>
                      <span className="rounded-lg border border-border px-2.5 py-1.5">{issue.assignedAgentName || "Unassigned"}</span>
                    </div>
                    <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        disabled={Boolean(issue.assignedAgent) || supportActionId === issueId}
                        onClick={() => void handleAssignSupportIssue(issueId)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-xs font-black transition hover:border-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <UserCheck size={15} /> Assign to me
                      </button>
                      <button
                        type="button"
                        onClick={() => window.open(`/support/chat/${encodeURIComponent(issueId)}`, "_blank", "noopener,noreferrer")}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-black text-primary"
                      >
                        <MessageCircle size={15} /> Open chat
                      </button>
                      <button
                        type="button"
                        disabled={isClosed || supportActionId === issueId}
                        onClick={() => void handleResolveSupportIssue(issueId)}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-xs font-black text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <CheckCircle2 size={15} /> Resolve
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {supportData && supportData.issues.length === 0 && (
              <div className="rounded-2xl border border-dashed border-border p-12 text-center text-sm font-semibold text-muted-foreground">No support tickets match these filters.</div>
            )}

            {supportData && supportData.pagination.pages > 1 && (
              <div className="flex items-center justify-between border-t border-border pt-4">
                <p className="text-sm text-muted-foreground">Page {supportData.pagination.page} of {supportData.pagination.pages} · {supportData.pagination.total} tickets</p>
                <div className="flex gap-2">
                  <button type="button" disabled={supportPage <= 1} onClick={() => setSupportPage((page) => page - 1)} className="h-10 rounded-xl border border-border px-4 text-sm font-bold disabled:opacity-40">Previous</button>
                  <button type="button" disabled={supportPage >= supportData.pagination.pages} onClick={() => setSupportPage((page) => page + 1)} className="h-10 rounded-xl border border-border px-4 text-sm font-bold disabled:opacity-40">Next</button>
                </div>
              </div>
            )}
          </div>
        );
      }

      case "Reports": {
        const maximumDailyRevenue = Math.max(
          1,
          ...(reportData?.dailySales.map((day) => day.revenue) ?? [1])
        );
        const totalPaymentOrders = reportData
          ? reportData.payments.cash + reportData.payments.online
          : 0;

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-primary">
                    <BarChart3 size={14} />
                    Business performance
                  </div>
                  <h3 className="mt-3 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                    Reports
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Track sales, order channels, customer retention, popular dishes and operating performance.
                  </p>
                </div>

                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void refreshReports();
                  }}
                  className="grid gap-2 rounded-2xl border border-border bg-background/60 p-3 sm:grid-cols-[1fr_1fr_auto_auto]"
                >
                  <label>
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      From
                    </span>
                    <input
                      required
                      type="date"
                      value={reportFrom}
                      max={reportTo}
                      onChange={(event) => setReportFrom(event.target.value)}
                      className="min-h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                    />
                  </label>
                  <label>
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                      To
                    </span>
                    <input
                      required
                      type="date"
                      value={reportTo}
                      min={reportFrom}
                      onChange={(event) => setReportTo(event.target.value)}
                      className="min-h-10 rounded-xl border border-border bg-background px-3 text-xs font-bold text-foreground outline-none focus:border-primary"
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isReportLoading}
                    className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-xs font-black text-primary-foreground disabled:opacity-50"
                  >
                    <CalendarDays size={14} />
                    Apply
                  </button>
                  <button
                    type="button"
                    disabled={!reportData}
                    onClick={handleExportReport}
                    className="mt-auto inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-xs font-black text-primary disabled:opacity-50"
                  >
                    <Download size={14} />
                    CSV
                  </button>
                </form>
              </div>
            </section>

            {reportError && (
              <p
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-bold text-red-400"
              >
                {reportError}
              </p>
            )}

            {isReportLoading && !reportData && (
              <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm font-semibold text-muted-foreground">
                Loading business reports...
              </div>
            )}

            {reportData && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    {
                      label: "Total revenue",
                      value: formatAdminMoney(reportData.totals.revenue),
                      detail: `${reportData.totals.orders} total orders`,
                      icon: Wallet
                    },
                    {
                      label: "Average order",
                      value: formatAdminMoney(
                        reportData.totals.averageOrderValue
                      ),
                      detail: "Average order value",
                      icon: ReceiptText
                    },
                    {
                      label: "Unique customers",
                      value: reportData.totals.uniqueCustomers,
                      detail: `${reportData.totals.repeatCustomers} repeat customers`,
                      icon: Users
                    },
                    {
                      label: "Paid orders",
                      value: reportData.totals.paidOrders,
                      detail: `${reportData.totals.cancelledOrders} cancelled`,
                      icon: CheckCircle2
                    }
                  ].map((item) => (
                    <article
                      key={item.label}
                      className="rounded-2xl border border-border bg-card p-5 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                            {item.label}
                          </p>
                          <p className="mt-2 font-heading text-3xl font-semibold text-foreground">
                            {item.value}
                          </p>
                          <p className="mt-1 text-xs font-semibold text-muted-foreground">
                            {item.detail}
                          </p>
                        </div>
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                          <item.icon size={18} />
                        </span>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(300px,1fr)]">
                  <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-wider text-primary">
                          Revenue trend
                        </p>
                        <h4 className="mt-1 font-heading text-xl font-semibold text-foreground">
                          Daily sales
                        </h4>
                      </div>
                      {isReportLoading && (
                        <RefreshCw size={17} className="animate-spin text-primary" />
                      )}
                    </div>
                    <div className="mt-6 flex h-60 items-end gap-2 overflow-x-auto border-b border-border pb-2">
                      {reportData.dailySales.map((day) => (
                        <div
                          key={day.date}
                          className="group flex h-full min-w-8 flex-1 flex-col items-center justify-end"
                          title={`${day.date}: ${formatAdminMoney(day.revenue)} from ${day.orders} orders`}
                        >
                          <span className="mb-2 hidden text-[9px] font-black text-primary group-hover:block">
                            {formatAdminMoney(day.revenue)}
                          </span>
                          <span
                            className="w-full min-w-6 rounded-t-lg bg-gradient-to-t from-primary/55 to-primary transition group-hover:brightness-110"
                            style={{
                              height: `${Math.max(
                                4,
                                (day.revenue / maximumDailyRevenue) * 82
                              )}%`
                            }}
                          />
                          <span className="mt-2 text-[9px] font-bold text-muted-foreground">
                            {new Date(`${day.date}T00:00:00`).toLocaleDateString(
                              "en-IN",
                              { day: "2-digit", month: "short" }
                            )}
                          </span>
                        </div>
                      ))}
                      {reportData.dailySales.length === 0 && (
                        <p className="m-auto text-sm font-semibold text-muted-foreground">
                          No sales in this period.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                    <p className="text-xs font-black uppercase tracking-wider text-primary">
                      Order mix
                    </p>
                    <h4 className="mt-1 font-heading text-xl font-semibold text-foreground">
                      Channels & payments
                    </h4>
                    <div className="mt-5 space-y-5">
                      {[
                        {
                          label: "Delivery",
                          value: reportData.totals.deliveryOrders,
                          total: reportData.totals.orders
                        },
                        {
                          label: "Dine-in",
                          value: reportData.totals.dineInOrders,
                          total: reportData.totals.orders
                        },
                        {
                          label: "Cash payments",
                          value: reportData.payments.cash,
                          total: totalPaymentOrders
                        },
                        {
                          label: "Online payments",
                          value: reportData.payments.online,
                          total: totalPaymentOrders
                        }
                      ].map((item) => {
                        const percentage =
                          item.total > 0
                            ? Math.round((item.value / item.total) * 100)
                            : 0;
                        return (
                          <div key={item.label}>
                            <div className="mb-2 flex items-center justify-between text-xs font-bold">
                              <span className="text-muted-foreground">
                                {item.label}
                              </span>
                              <span className="text-foreground">
                                {item.value} · {percentage}%
                              </span>
                            </div>
                            <div className="h-2 overflow-hidden rounded-full bg-background">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </section>
                </div>

                <div className="grid gap-5 lg:grid-cols-3">
                  <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <header className="border-b border-border p-5">
                      <p className="text-xs font-black uppercase tracking-wider text-primary">
                        Menu performance
                      </p>
                      <h4 className="mt-1 font-heading text-xl font-semibold text-foreground">
                        Top ordered items
                      </h4>
                    </header>
                    <div className="divide-y divide-border">
                      {reportData.topItems.slice(0, 6).map((item, index) => (
                        <div
                          key={item.name}
                          className="flex items-center gap-3 px-5 py-4"
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-xs font-black text-primary">
                            {index + 1}
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-black text-foreground">
                              {item.name}
                            </p>
                            <p className="text-xs font-semibold text-muted-foreground">
                              {item.quantity} sold
                            </p>
                          </div>
                          <span className="text-xs font-black text-primary">
                            {formatAdminMoney(item.revenue)}
                          </span>
                        </div>
                      ))}
                      {reportData.topItems.length === 0 && (
                        <p className="p-8 text-center text-sm font-semibold text-muted-foreground">
                          No item sales yet.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <header className="border-b border-border p-5">
                      <p className="text-xs font-black uppercase tracking-wider text-primary">
                        Dispatch
                      </p>
                      <h4 className="mt-1 font-heading text-xl font-semibold text-foreground">
                        Delivery performance
                      </h4>
                    </header>
                    <div className="divide-y divide-border">
                      {reportData.deliveryPerformance.map((person) => (
                        <div
                          key={person.name}
                          className="flex items-center justify-between gap-4 px-5 py-4"
                        >
                          <div>
                            <p className="text-sm font-black text-foreground">
                              {person.name}
                            </p>
                            <p className="text-xs font-semibold text-muted-foreground">
                              {person.assigned} assigned
                            </p>
                          </div>
                          <span className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-black text-emerald-400">
                            {person.delivered} delivered
                          </span>
                        </div>
                      ))}
                      {reportData.deliveryPerformance.length === 0 && (
                        <p className="p-8 text-center text-sm font-semibold text-muted-foreground">
                          No assigned deliveries yet.
                        </p>
                      )}
                    </div>
                  </section>

                  <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                    <header className="border-b border-border p-5">
                      <p className="text-xs font-black uppercase tracking-wider text-primary">
                        Dine-in
                      </p>
                      <h4 className="mt-1 font-heading text-xl font-semibold text-foreground">
                        Table performance
                      </h4>
                    </header>
                    <div className="divide-y divide-border">
                      {reportData.tablePerformance.map((table) => (
                        <div
                          key={table.tableNumber}
                          className="flex items-center justify-between gap-4 px-5 py-4"
                        >
                          <div>
                            <p className="text-sm font-black text-foreground">
                              Table {table.tableNumber}
                            </p>
                            <p className="text-xs font-semibold text-muted-foreground">
                              {table.orders} orders
                            </p>
                          </div>
                          <span className="text-xs font-black text-primary">
                            {formatAdminMoney(table.revenue)}
                          </span>
                        </div>
                      ))}
                      {reportData.tablePerformance.length === 0 && (
                        <p className="p-8 text-center text-sm font-semibold text-muted-foreground">
                          No dine-in table sales yet.
                        </p>
                      )}
                    </div>
                  </section>
                </div>
              </>
            )}
          </div>
        );
      }

      case "Settings":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <section className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-primary">
                    <Settings size={14} />
                    Restaurant controls
                  </div>
                  <h3 className="mt-3 font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                    Settings
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Manage restaurant details, ordering modes, checkout charges and delivery communication.
                  </p>
                </div>
                {settingsData?.updatedAt && (
                  <p className="text-xs font-semibold text-muted-foreground">
                    Last saved {formatAdminDate(settingsData.updatedAt)}
                  </p>
                )}
              </div>
            </section>

            {(settingsError || settingsNotice) && (
              <p
                role={settingsError ? "alert" : "status"}
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                  settingsError
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {settingsError || settingsNotice}
              </p>
            )}

            {isSettingsLoading && !settingsData && (
              <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm font-semibold text-muted-foreground">
                Loading restaurant settings...
              </div>
            )}

            {settingsData && (
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Store size={18} />
                      </span>
                      <div>
                        <h4 className="font-heading text-xl font-semibold text-foreground">
                          Restaurant profile
                        </h4>
                        <p className="text-xs font-semibold text-muted-foreground">
                          Customer-facing business information
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      <label className="sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                          Restaurant name
                        </span>
                        <input
                          required
                          maxLength={120}
                          value={settingsData.restaurantName}
                          onChange={(event) =>
                            setSettingsData({
                              ...settingsData,
                              restaurantName: event.target.value
                            })
                          }
                          className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-primary"
                        />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                          Phone
                        </span>
                        <input
                          required
                          type="tel"
                          maxLength={24}
                          value={settingsData.phone}
                          onChange={(event) =>
                            setSettingsData({
                              ...settingsData,
                              phone: event.target.value
                            })
                          }
                          className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none focus:border-primary"
                        />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label>
                          <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                            Opens
                          </span>
                          <input
                            required
                            type="time"
                            value={settingsData.openingTime}
                            onChange={(event) =>
                              setSettingsData({
                                ...settingsData,
                                openingTime: event.target.value
                              })
                            }
                            className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                          />
                        </label>
                        <label>
                          <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                            Closes
                          </span>
                          <input
                            required
                            type="time"
                            value={settingsData.closingTime}
                            onChange={(event) =>
                              setSettingsData({
                                ...settingsData,
                                closingTime: event.target.value
                              })
                            }
                            className="min-h-12 w-full rounded-xl border border-border bg-background px-3 text-sm font-bold text-foreground outline-none focus:border-primary"
                          />
                        </label>
                      </div>
                      <label className="sm:col-span-2">
                        <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                          Address
                        </span>
                        <textarea
                          required
                          maxLength={300}
                          value={settingsData.address}
                          onChange={(event) =>
                            setSettingsData({
                              ...settingsData,
                              address: event.target.value
                            })
                          }
                          className="h-24 w-full resize-none rounded-xl border border-border bg-background p-4 text-sm font-bold text-foreground outline-none focus:border-primary"
                        />
                      </label>
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <div className="flex items-center gap-3 border-b border-border pb-4">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Wallet size={18} />
                      </span>
                      <div>
                        <h4 className="font-heading text-xl font-semibold text-foreground">
                          Checkout rules
                        </h4>
                        <p className="text-xs font-semibold text-muted-foreground">
                          Fees, tax and accepted payment methods
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-4 sm:grid-cols-3">
                      {[
                        {
                          label: "Delivery fee",
                          key: "deliveryFee" as const,
                          prefix: "₹",
                          step: "1"
                        },
                        {
                          label: "Tax rate",
                          key: "taxRate" as const,
                          suffix: "%",
                          step: "0.1"
                        },
                        {
                          label: "Minimum order",
                          key: "minimumOrder" as const,
                          prefix: "₹",
                          step: "1"
                        }
                      ].map((field) => (
                        <label key={field.key}>
                          <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                            {field.label}
                          </span>
                          <span className="relative block">
                            {field.prefix && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">
                                {field.prefix}
                              </span>
                            )}
                            <input
                              required
                              type="number"
                              min={0}
                              max={field.key === "taxRate" ? 100 : 100000}
                              step={field.step}
                              value={
                                field.key === "taxRate"
                                  ? Number(
                                      (settingsData.taxRate * 100).toFixed(2)
                                    )
                                  : settingsData[field.key]
                              }
                              onChange={(event) =>
                                setSettingsData({
                                  ...settingsData,
                                  [field.key]:
                                    field.key === "taxRate"
                                      ? Number(event.target.value) / 100
                                      : Number(event.target.value)
                                })
                              }
                              className={`min-h-12 w-full rounded-xl border border-border bg-background pr-8 text-sm font-bold text-foreground outline-none focus:border-primary ${
                                field.prefix ? "pl-7" : "pl-4"
                              }`}
                            />
                            {field.suffix && (
                              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-black text-muted-foreground">
                                {field.suffix}
                              </span>
                            )}
                          </span>
                        </label>
                      ))}
                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          label: "Cash payment",
                          detail: "Allow cash on delivery or at table",
                          key: "cashEnabled" as const
                        }
                      ].map((option) => (
                        <label
                          key={option.key}
                          className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border bg-background p-4"
                        >
                          <span>
                            <span className="block text-sm font-black text-foreground">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">
                              {option.detail}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={settingsData[option.key]}
                            onChange={(event) =>
                              setSettingsData({
                                ...settingsData,
                                [option.key]: event.target.checked
                              })
                            }
                            className="h-5 w-5 accent-primary"
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                </div>

                <div className="grid gap-5 xl:grid-cols-2">
                  <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <h4 className="font-heading text-xl font-semibold text-foreground">
                      Ordering channels
                    </h4>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      Turn customer order modes on or off.
                    </p>
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {[
                        {
                          label: "Website online",
                          detail: "Customers can place new orders",
                          key: "restaurantOpen" as const,
                          icon: Power
                        },
                        {
                          label: "Delivery orders",
                          detail: "Customers can choose home delivery",
                          key: "deliveryEnabled" as const,
                          icon: Bike
                        },
                        {
                          label: "Dine-in orders",
                          detail: "Customers can scan a table QR",
                          key: "dineInEnabled" as const,
                          icon: QrCode
                        }
                      ].map((option) => (
                        <label
                          key={option.key}
                          className={`flex cursor-pointer items-center gap-4 rounded-xl border p-4 transition ${
                            settingsData[option.key]
                              ? "border-primary/35 bg-primary/10"
                              : "border-border bg-background"
                          }`}
                        >
                          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                            <option.icon size={18} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-black text-foreground">
                              {option.label}
                            </span>
                            <span className="mt-1 block text-[11px] font-semibold text-muted-foreground">
                              {option.detail}
                            </span>
                          </span>
                          <input
                            type="checkbox"
                            checked={settingsData[option.key]}
                            onChange={(event) =>
                              setSettingsData({
                                ...settingsData,
                                [option.key]: event.target.checked
                              })
                            }
                            className="h-5 w-5 accent-primary"
                          />
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
                    <h4 className="font-heading text-xl font-semibold text-foreground">
                      WhatsApp assignment message
                    </h4>
                    <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                      Keep placeholders such as {"{customerName}"}, {"{phone}"},{" "}
                      {"{locationLink}"}, {"{items}"}, {"{total}"} and{" "}
                      {"{paymentStatus}"}.
                    </p>
                    <textarea
                      required
                      maxLength={2000}
                      value={settingsData.whatsappTemplate}
                      onChange={(event) =>
                        setSettingsData({
                          ...settingsData,
                          whatsappTemplate: event.target.value
                        })
                      }
                      className="mt-4 h-36 w-full resize-y rounded-xl border border-border bg-background p-4 font-mono text-xs font-semibold leading-5 text-foreground outline-none focus:border-primary"
                    />
                  </section>
                </div>

                <div className="sticky bottom-4 z-[5] flex justify-end rounded-2xl border border-primary/25 bg-card/95 p-3 shadow-2xl backdrop-blur-xl">
                  <button
                    type="submit"
                    disabled={isSettingsSaving}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-6 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
                  >
                    {isSettingsSaving ? (
                      <RefreshCw size={17} className="animate-spin" />
                    ) : (
                      <Save size={17} />
                    )}
                    {isSettingsSaving ? "Saving settings..." : "Save settings"}
                  </button>
                </div>
              </form>
            )}
          </div>
        );

      case "Table QR Codes":
        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 motion-reduce:animate-none">
            <section className="overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/15 via-card to-card p-5 shadow-sm sm:p-7">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-black uppercase tracking-[0.16em] text-primary">
                    <QrCode size={14} />
                    Secure dine-in entry
                  </div>
                  <h3 className="font-heading text-2xl font-semibold text-foreground sm:text-3xl">
                    One QR code for every table
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">
                    Download and print each code. A scan opens the same customer menu, verifies the private token, and attaches the table to the order automatically.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <button
                    type="button"
                    onClick={openTableModal}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Plus size={16} />
                    Add table
                  </button>
                  <button
                    type="button"
                    onClick={() => void refreshTables()}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/30 bg-primary/10 px-4 text-sm font-black text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <RefreshCw size={16} />
                    Refresh tables
                  </button>
                </div>
              </div>
            </section>

            {(tablesError || tableNotice) && (
              <div
                role={tablesError ? "alert" : "status"}
                aria-live="polite"
                className={`rounded-xl border px-4 py-3 text-sm font-bold ${
                  tablesError
                    ? "border-red-500/30 bg-red-500/10 text-red-400"
                    : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                }`}
              >
                {tablesError || tableNotice}
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {tables.map((table) => {
                const qrUrl = getTableQrUrl(table);
                const isWorking = tableActionId === table.id;

                return (
                  <article
                    key={table.id}
                    className={`rounded-2xl border bg-card p-5 shadow-sm transition ${
                      table.isActive ? "border-border hover:border-primary/35" : "border-red-500/25 opacity-70"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-heading text-xl font-semibold text-foreground">{table.label}</h4>
                        <p className="mt-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                          {table.isActive ? "Accepting orders" : "QR paused"}
                        </p>
                      </div>
                      <span className={`h-3 w-3 rounded-full ${table.isActive ? "bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.7)]" : "bg-red-500"}`} />
                    </div>

                    <div className="mx-auto mt-5 flex aspect-square max-w-[220px] items-center justify-center rounded-2xl bg-white p-4 shadow-inner">
                      {qrUrl && (
                        <QRCodeSVG
                          id={`table-qr-${table.id}`}
                          value={qrUrl}
                          size={188}
                          level="H"
                          bgColor="#ffffff"
                          fgColor="#080808"
                          marginSize={1}
                          title={`${table.label} menu QR code`}
                        />
                      )}
                    </div>

                    <p className="mt-4 truncate rounded-lg border border-border bg-background px-3 py-2 font-mono text-[10px] text-muted-foreground">
                      {qrUrl}
                    </p>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCopyTableLink(table)}
                        disabled={!qrUrl}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 text-xs font-black text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                      >
                        <Copy size={14} />
                        Copy link
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDownloadQr(table)}
                        disabled={!qrUrl}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-black text-foreground transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50"
                      >
                        <Download size={14} />
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRegenerateTableQr(table)}
                        disabled={isWorking}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-black text-foreground transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-50"
                      >
                        <RefreshCw size={14} className={isWorking ? "animate-spin" : ""} />
                        New code
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleToggleTable(table)}
                        disabled={isWorking}
                        aria-pressed={!table.isActive}
                        className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-50 ${
                          table.isActive
                            ? "border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                            : "border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                        }`}
                      >
                        <Power size={14} />
                        {table.isActive ? "Pause" : "Activate"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>

            {!tablesError && tables.length === 0 && (
              <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm font-semibold text-muted-foreground">
                Loading table QR codes...
              </div>
            )}
          </div>
        );

      default:
        return (
          <div className="flex flex-col items-center justify-center py-32 text-center animate-in fade-in duration-500">
            <div className="h-20 w-20 rounded-3xl bg-card border border-border flex items-center justify-center text-muted-foreground mb-6 shadow-sm">
              <Settings size={32} className="opacity-50" />
            </div>
            <h3 className="font-heading text-2xl font-medium text-foreground">{activeTab} Module</h3>
            <p className="mt-2 text-muted-foreground max-w-sm">This section is currently under construction and will be connected to the backend soon.</p>
          </div>
        );
    }
  };

  if (authStatus === "checking") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <RefreshCw size={30} className="mx-auto animate-spin text-primary" />
          <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-muted-foreground">
            Verifying admin session
          </p>
        </div>
      </main>
    );
  }

  if (authStatus === "unauthorized") return null;

  return (
    <div className="min-h-screen bg-background flex font-body text-foreground selection:bg-primary/30">
      {isMobileNavigationOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close admin navigation"
            className="absolute inset-0 bg-black/65 backdrop-blur-sm"
            onClick={() => {
              setIsMobileNavigationOpen(false);
              mobileMenuButtonRef.current?.focus();
            }}
          />
          <aside
            ref={mobileNavigationRef}
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            className="relative flex h-[100dvh] w-[min(20rem,calc(100vw-2rem))] flex-col overflow-y-auto border-r border-border bg-card shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-border/50 p-5">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src="/images/logo-watermark.png"
                  alt="Al-Arab"
                  width={52}
                  height={52}
                  className="h-11 w-auto shrink-0 object-contain drop-shadow-md"
                />
                <h1 className="font-logo text-xs font-bold leading-tight tracking-[0.18em] text-primary">
                  AL-ARAB
                  <br />
                  <span className="text-[8px] tracking-widest text-muted-foreground">
                    RESTAURANT
                  </span>
                </h1>
              </div>
              <button
                type="button"
                aria-label="Close admin navigation"
                onClick={() => {
                  setIsMobileNavigationOpen(false);
                  mobileMenuButtonRef.current?.focus();
                }}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <X size={20} />
              </button>
            </div>

            <nav aria-label="Admin sections" className="flex-1 space-y-1.5 p-4">
              {sidebarLinks.map((link) => {
                const isActive = activeTab === link.name;
                return (
                  <button
                    key={link.name}
                    type="button"
                    onClick={() => {
                      setActiveTab(link.name);
                      setIsMobileNavigationOpen(false);
                      mobileMenuButtonRef.current?.focus();
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-200 active:scale-[0.98] ${
                      isActive
                        ? "bg-primary/10 font-bold text-primary shadow-[inset_4px_0_0_0_var(--theme-primary)]"
                        : "font-medium text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
                    }`}
                    style={
                      isActive
                        ? ({
                            "--theme-primary": "hsl(var(--primary))"
                          } as React.CSSProperties)
                        : {}
                    }
                  >
                    <link.icon
                      size={18}
                      strokeWidth={isActive ? 2.5 : 2}
                    />
                    <span className="text-sm">{link.name}</span>
                  </button>
                );
              })}
            </nav>

            <div className="border-t border-border p-4">
              <div className="mb-3 min-w-0 px-2">
                <p className="truncate text-sm font-bold text-foreground">
                  {adminUser?.name || "Administrator"}
                </p>
                <p className="truncate text-xs font-medium text-muted-foreground">
                  {adminUser?.email || "Admin"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleAdminLogout()}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-background text-sm font-bold text-muted-foreground transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={17} />
                Sign out
              </button>
            </div>
          </aside>
        </div>
      )}

      <aside className="hidden md:flex flex-col w-64 border-r border-border bg-card/50 backdrop-blur-xl sticky top-0 h-screen overflow-y-auto">
        <div className="p-6 pb-2 border-b border-border/50">
          <div className="flex flex-col items-center">
            <Image src="/images/logo-watermark.png" alt="Al-Arab" width={68} height={68} className="h-14 w-auto object-contain drop-shadow-md mb-2" />
            <h1 className="font-logo text-sm font-bold tracking-[0.2em] text-primary text-center leading-tight">
              AL-ARAB<br/><span className="text-[9px] tracking-widest text-muted-foreground">RESTAURANT</span>
            </h1>
          </div>
        </div>
        <nav className="flex-1 p-4 space-y-1.5 mt-4">
          {sidebarLinks.map((link) => {
            const isActive = activeTab === link.name;
            return (
              <button
                key={link.name}
                onClick={() => setActiveTab(link.name)}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 active:scale-[0.98] ${
                  isActive ? "bg-primary/10 text-primary font-bold shadow-[inset_4px_0_0_0_var(--theme-primary)]" : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground font-medium"
                }`}
                style={isActive ? { '--theme-primary': 'hsl(var(--primary))' } as React.CSSProperties : {}}
              >
                <link.icon size={18} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-sm">{link.name}</span>
              </button>
            )
          })}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-background/80 p-3 backdrop-blur-md sm:p-4 md:p-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              ref={mobileMenuButtonRef}
              type="button"
              aria-label="Open admin navigation"
              aria-controls="admin-mobile-navigation"
              aria-expanded={isMobileNavigationOpen}
              onClick={() => setIsMobileNavigationOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 md:hidden"
            >
              <Menu size={20} />
            </button>
            <h2 className="min-w-0 truncate font-heading text-xl font-medium tracking-tight text-foreground sm:text-2xl md:text-3xl">
              {activeTab}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-1 sm:gap-3 lg:gap-5">
            {renderRestaurantStatusButton("header")}
            <NotificationCenter
              scope="admin"
              enabled={authStatus === "authenticated"}
              className="rounded-xl border-border bg-card text-muted-foreground hover:border-primary/40 hover:bg-primary/10 hover:text-primary"
              onNavigate={(href) => {
                const requestedTab = new URL(href, window.location.origin).searchParams.get("tab");
                if (!requestedTab || !["Live Orders", "Support"].includes(requestedTab)) return false;
                setActiveTab(requestedTab);
                return true;
              }}
            />
            <button
              type="button"
              onClick={() => void toggleOrderAlerts()}
              aria-label={
                orderAlertsEnabled
                  ? "Turn off order alert sound"
                  : "Turn on order alert sound"
              }
              aria-pressed={orderAlertsEnabled}
              title={
                orderAlertsEnabled
                  ? "Order alert sound is on"
                  : "Order alert sound is off"
              }
              className={`relative rounded-lg p-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                orderAlertsEnabled
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              }`}
            >
              {orderAlertsEnabled ? <Volume2 size={20} /> : <VolumeX size={20} />}
              <span
                className={`absolute right-1.5 top-1.5 h-2 w-2 rounded-full border border-background ${
                  orderAlertsEnabled ? "animate-pulse bg-emerald-400" : "bg-muted-foreground/40"
                }`}
              />
            </button>
            <div className="hidden items-center gap-3 border-l border-border pl-5 md:flex">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-bold text-foreground">
                  {adminUser?.name || "Administrator"}
                </p>
                <p className="max-w-44 truncate text-xs font-medium text-muted-foreground">
                  {adminUser?.email || "Admin"}
                </p>
              </div>
              <div className="h-10 w-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary">
                <UserCircle size={24} />
              </div>
              <button
                type="button"
                onClick={() => void handleAdminLogout()}
                aria-label="Sign out"
                title="Sign out"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition hover:border-red-500/30 hover:bg-red-500/10 hover:text-red-400"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </header>

        <div className="p-6 max-w-7xl mx-auto w-full">
          {renderContent()}
        </div>
      </main>

      {/* FULLY RESPONSIVE DESKTOP MODAL WITH INTERNAL SCROLL */}
      {isMenuModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 sm:p-6">
          <div className="bg-card border border-border rounded-3xl w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">

            {/* Modal Header - Pinned */}
            <div className="flex justify-between items-center p-6 border-b border-border shrink-0">
              <h3 className="font-heading text-2xl font-bold text-foreground">{editingItem ? "Edit Item" : "Add Menu Item"}</h3>
              <button type="button" onClick={() => setIsMenuModalOpen(false)} className="p-2 bg-foreground/5 hover:bg-foreground/10 rounded-full text-muted-foreground transition-colors"><X size={20}/></button>
            </div>

            {/* Form & Body */}
            <form onSubmit={handleSaveMenu} className="flex flex-col flex-1 overflow-hidden">

              {/* Scrollable Content Area */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">

                {/* DEVICE PHOTO UPLOAD */}
                <div>
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block">Dish photo</span>
                  <label
                    htmlFor="menu-image-file"
                    className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-primary/35 bg-background/80 px-4 py-5 text-center transition hover:border-primary hover:bg-primary/5"
                  >
                    <UploadCloud size={24} className="text-primary" />
                    <span className="mt-2 text-sm font-black text-foreground">
                      {isUploadingMenuImage ? "Uploading photo..." : "Upload photo from device"}
                    </span>
                    <span className="mt-1 text-xs font-semibold text-muted-foreground">
                      JPG, PNG, or WEBP. Maximum 3MB.
                    </span>
                    <input
                      id="menu-image-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      disabled={isUploadingMenuImage}
                      onChange={(event) => void handleMenuImageUpload(event.target.files?.[0])}
                      className="sr-only"
                    />
                  </label>
                  {menuImageError && (
                    <p className="mt-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-400">
                      {menuImageError}
                    </p>
                  )}
                  {formData.image && (
                    <div className="relative mt-3 h-40 w-full overflow-hidden rounded-xl border border-border bg-background">
                      <Image
                        src={formData.image}
                        alt="Dish preview"
                        fill
                        unoptimized={formData.image.startsWith("https://")}
                        className="object-cover"
                      />
                    </div>
                  )}
                  <details className="mt-3 rounded-xl border border-border bg-background/60 p-3">
                    <summary className="cursor-pointer text-xs font-black uppercase tracking-wider text-muted-foreground">
                      Use image URL instead
                    </summary>
                    <input
                      id="menu-image-url"
                      type="url"
                      inputMode="url"
                      value={formData.image.startsWith("/uploads/") ? "" : formData.image}
                      onChange={(event) => setFormData({ ...formData, image: event.target.value })}
                      className="mt-3 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground outline-none transition-colors focus:border-primary"
                      placeholder="https://cdn.example.com/dish.webp"
                    />
                  </details>
                </div>

                {/* NAME & CATEGORY */}
                <div className="flex gap-4">
                  <div className="flex-[2]">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Item Name</label>
                    <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:border-primary outline-none transition-colors" placeholder="E.g., Chicken Mandi" />
                  </div>
                  <div className="flex-1">
                    <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Category</label>
                    <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value as Category})} className="w-full bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:border-primary outline-none transition-colors">
                      <option>Appetizers</option>
                      <option>Mains</option>
                      <option>Desserts</option>
                      <option>Beverages</option>
                    </select>
                  </div>
                </div>

                {/* DYNAMIC SIZES & PRICES */}
                <div className="bg-background/50 border border-border rounded-2xl p-5">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 block">Available Sizes & Prices</label>
                  <div className="space-y-4">

                    {formData.preserveExistingSizes ? (
                      <div className="rounded-xl border border-primary/20 bg-primary/10 p-4 text-sm text-foreground">
                        <p className="font-bold">Custom portion pricing is preserved.</p>
                        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                          This dish uses size names outside Half and Full. Editing its details will not overwrite those existing portions.
                        </p>
                      </div>
                    ) : (
                      <>
                    {/* Half Portion Option */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm font-bold text-foreground cursor-pointer w-32">
                        <input type="checkbox" checked={formData.sizes.includes("Half")} onChange={() => toggleSize("Half")} className="w-4 h-4 rounded border-border accent-primary" />
                        Half Portion
                      </label>
                      {formData.sizes.includes("Half") && (
                        <div className="flex-1 relative animate-in fade-in slide-in-from-left-2 duration-200">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                          <input required type="number" min="0" value={formData.prices.Half || ''} onChange={e => setFormData({...formData, prices: { ...formData.prices, Half: Number(e.target.value) }})} className="w-full bg-background border border-border rounded-xl py-2.5 pl-7 pr-3 text-sm text-foreground focus:border-primary outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="Half Price" />
                        </div>
                      )}
                    </div>

                    {/* Full Portion Option */}
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-2 text-sm font-bold text-foreground cursor-pointer w-32">
                        <input type="checkbox" checked={formData.sizes.includes("Full")} onChange={() => toggleSize("Full")} className="w-4 h-4 rounded border-border accent-primary" />
                        Full Portion
                      </label>
                      {formData.sizes.includes("Full") && (
                        <div className="flex-1 relative animate-in fade-in slide-in-from-left-2 duration-200">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                          <input required type="number" min="0" value={formData.prices.Full || ''} onChange={e => setFormData({...formData, prices: { ...formData.prices, Full: Number(e.target.value) }})} className="w-full bg-background border border-border rounded-xl py-2.5 pl-7 pr-3 text-sm text-foreground focus:border-primary outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="Full Price" />
                        </div>
                      )}
                    </div>

                    {/* Standard Price Option (If Neither are Checked) */}
                    {formData.sizes.length === 0 && (
                      <div className="pt-4 border-t border-border mt-2">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 block text-primary">Standard Price</label>
                        <div className="relative animate-in fade-in slide-in-from-bottom-2 duration-200">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">₹</span>
                          <input required type="number" min="0" value={formData.prices.Standard || ''} onChange={e => setFormData({...formData, prices: { ...formData.prices, Standard: Number(e.target.value) }})} className="w-full bg-background border border-border rounded-xl py-2.5 pl-7 pr-3 text-sm text-foreground focus:border-primary outline-none transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none" placeholder="Standard Price" />
                        </div>
                      </div>
                    )}
                      </>
                    )}

                  </div>
                </div>

                {/* DESCRIPTION */}
                <div>
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-1 block">Description</label>
                  <textarea required value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} className="w-full h-24 resize-none bg-background border border-border rounded-xl p-3 text-sm text-foreground focus:border-primary outline-none transition-colors" placeholder="Describe the dish..." />
                </div>

              </div>

              {/* Modal Footer - Pinned */}
              <div className="p-6 border-t border-border shrink-0 bg-card rounded-b-3xl">
                <button type="submit" disabled={isSavingMenu} className="w-full bg-primary text-primary-foreground font-black py-4 rounded-xl hover:opacity-90 transition-opacity flex justify-center items-center gap-2 shadow-lg shadow-primary/20 disabled:opacity-60">
                  <CheckCircle2 size={18} /> {isSavingMenu ? "Saving..." : editingItem ? "Save Changes" : "Add to Menu"}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {isCustomerModalOpen && selectedCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 p-4 backdrop-blur-sm sm:p-6">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="customer-detail-title"
            className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border p-5 sm:p-6">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/25 bg-primary/10 text-primary">
                  <UserCircle size={27} />
                </span>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      id="customer-detail-title"
                      className="truncate font-heading text-2xl font-bold text-foreground"
                    >
                      {selectedCustomer.name}
                    </h3>
                    <span
                      className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${
                        selectedCustomer.isBlocked
                          ? "border-red-500/30 bg-red-500/10 text-red-400"
                          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      }`}
                    >
                      {selectedCustomer.isBlocked ? "Blocked" : "Active"}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                    {[selectedCustomer.phone, selectedCustomer.email]
                      .filter(Boolean)
                      .join(" · ") || "No contact details available"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label="Close customer details"
                onClick={() => setIsCustomerModalOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={19} />
              </button>
            </header>

            <div className="flex-1 space-y-5 overflow-y-auto p-5 sm:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  {
                    label: "Total orders",
                    value: selectedCustomer.orderCount,
                    icon: ShoppingBag
                  },
                  {
                    label: "Lifetime spend",
                    value: formatAdminMoney(selectedCustomer.totalSpent),
                    icon: Wallet
                  },
                  {
                    label: "Last order",
                    value: formatAdminDate(selectedCustomer.lastOrderAt),
                    icon: CalendarDays
                  }
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-2xl border border-border bg-background p-4"
                  >
                    <div className="flex items-center gap-2 text-primary">
                      <item.icon size={15} />
                      <span className="text-[10px] font-black uppercase tracking-wider text-muted-foreground">
                        {item.label}
                      </span>
                    </div>
                    <p className="mt-2 text-lg font-black text-foreground">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {selectedCustomer.isBlocked && (
                <div className="rounded-2xl border border-red-500/25 bg-red-500/10 p-4">
                  <p className="text-xs font-black uppercase tracking-wider text-red-400">
                    Account restriction
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {selectedCustomer.blockReason ||
                      "No restriction reason was recorded."}
                  </p>
                  {selectedCustomer.blockedAt && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Blocked {formatAdminDate(selectedCustomer.blockedAt)}
                    </p>
                  )}
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.8fr)]">
                <section className="overflow-hidden rounded-2xl border border-border">
                  <header className="border-b border-border bg-background/50 px-5 py-4">
                    <h4 className="font-heading text-lg font-semibold text-foreground">
                      Order history
                    </h4>
                    <p className="mt-1 text-xs font-semibold text-muted-foreground">
                      Recent delivery and dine-in activity
                    </p>
                  </header>
                  <div className="max-h-80 divide-y divide-border overflow-y-auto">
                    {selectedCustomer.orders.map((order) => (
                      <article
                        key={order._id || order.id || order.orderNumber}
                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-black text-foreground">
                              #{order.orderNumber}
                            </p>
                            <span
                              className={`rounded-full border px-2 py-0.5 text-[9px] font-black uppercase ${getStatusColor(
                                order.status
                              )}`}
                            >
                              {order.status}
                            </span>
                          </div>
                          <p className="mt-1 truncate text-xs font-semibold text-muted-foreground">
                            {order.items
                              .map((item) => `${item.quantity}× ${item.name}`)
                              .join(", ")}
                          </p>
                          <p className="mt-1 text-[11px] font-semibold text-muted-foreground">
                            {formatAdminDate(order.createdAt)} ·{" "}
                            {order.orderType === "dine_in"
                              ? `Dine-in${
                                  order.tableNumber
                                    ? ` · Table ${order.tableNumber}`
                                    : ""
                                }`
                              : "Delivery"}
                          </p>
                        </div>
                        <p className="shrink-0 text-sm font-black text-primary">
                          {formatAdminMoney(order.total)}
                        </p>
                      </article>
                    ))}
                    {selectedCustomer.orders.length === 0 && (
                      <p className="p-10 text-center text-sm font-semibold text-muted-foreground">
                        No order history is available for this customer.
                      </p>
                    )}
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-background/40 p-5">
                  <h4 className="font-heading text-lg font-semibold text-foreground">
                    Internal notes
                  </h4>
                  <p className="mt-1 text-xs font-semibold leading-5 text-muted-foreground">
                    Visible only to restaurant administrators.
                  </p>
                  <textarea
                    maxLength={2000}
                    value={customerNotes}
                    onChange={(event) => setCustomerNotes(event.target.value)}
                    className="mt-4 h-40 w-full resize-y rounded-xl border border-border bg-background p-4 text-sm font-semibold text-foreground outline-none focus:border-primary"
                    placeholder="Preferences, service history or useful context..."
                  />
                  <button
                    type="button"
                    disabled={isCustomerActionRunning}
                    onClick={() => void handleSaveCustomerNotes()}
                    className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-black text-primary-foreground disabled:opacity-50"
                  >
                    <Save size={16} />
                    Save notes
                  </button>
                </section>
              </div>
            </div>

            <footer className="flex shrink-0 flex-col-reverse gap-3 border-t border-border bg-background/30 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <p className="text-xs font-semibold text-muted-foreground">
                Customer since {formatAdminDate(selectedCustomer.joinedAt)}
              </p>
              <button
                type="button"
                disabled={isCustomerActionRunning}
                onClick={() =>
                  void handleCustomerBlockedChange(selectedCustomer)
                }
                className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-5 text-sm font-black transition disabled:opacity-50 ${
                  selectedCustomer.isBlocked
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                    : "border-red-500/25 bg-red-500/10 text-red-400 hover:bg-red-500/20"
                }`}
              >
                {selectedCustomer.isBlocked ? (
                  <Unlock size={16} />
                ) : (
                  <Ban size={16} />
                )}
                {selectedCustomer.isBlocked
                  ? "Unblock customer"
                  : "Block customer"}
              </button>
            </footer>
          </section>
        </div>
      )}

      {isTableModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-table-modal-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Table QR Codes
                </p>
                <h3 id="add-table-modal-title" className="mt-1 font-heading text-2xl font-bold text-foreground">
                  Add another table
                </h3>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">
                  A secure QR code will be generated automatically.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close add table form"
                onClick={() => setIsTableModalOpen(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={19} />
              </button>
            </header>

            <form onSubmit={handleCreateTable}>
              <div className="space-y-5 p-6">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Table number
                  </span>
                  <input
                    required
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={999}
                    value={tableForm.tableNumber}
                    onChange={(event) =>
                      setTableForm((current) => ({
                        ...current,
                        tableNumber: Number(event.target.value)
                      }))
                    }
                    className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                  />
                  <span className="mt-1.5 block text-[11px] font-semibold text-muted-foreground">
                    Use any unused number from 1 to 999.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Display label <span className="normal-case text-muted-foreground/70">(optional)</span>
                  </span>
                  <input
                    type="text"
                    maxLength={100}
                    value={tableForm.label}
                    onChange={(event) =>
                      setTableForm((current) => ({
                        ...current,
                        label: event.target.value
                      }))
                    }
                    className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary"
                    placeholder={`Table ${tableForm.tableNumber}`}
                  />
                </label>

                {tablesError && (
                  <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
                    {tablesError}
                  </p>
                )}
              </div>

              <footer className="border-t border-border bg-background/30 p-6">
                <button
                  type="submit"
                  disabled={isCreatingTable}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
                >
                  <QrCode size={18} />
                  {isCreatingTable ? "Creating table..." : "Add table and generate QR"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

      {isStaffModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 p-4 backdrop-blur-sm">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="delivery-person-modal-title"
            className="w-full max-w-md overflow-hidden rounded-3xl border border-border bg-card shadow-2xl animate-in zoom-in-95 duration-200"
          >
            <header className="flex items-start justify-between gap-4 border-b border-border p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary">
                  Delivery team
                </p>
                <h3 id="delivery-person-modal-title" className="mt-1 font-heading text-2xl font-bold text-foreground">
                  {editingDeliveryPerson ? "Edit delivery person" : "Add delivery person"}
                </h3>
              </div>
              <button
                type="button"
                aria-label="Close delivery person form"
                onClick={() => setIsStaffModalOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground/5 text-muted-foreground transition hover:bg-foreground/10 hover:text-foreground"
              >
                <X size={19} />
              </button>
            </header>

            <form onSubmit={handleSaveDeliveryPerson}>
              <div className="space-y-5 p-6">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Name
                  </span>
                  <input
                    required
                    minLength={2}
                    maxLength={100}
                    value={deliveryPersonForm.name}
                    onChange={(event) =>
                      setDeliveryPersonForm((current) => ({
                        ...current,
                        name: event.target.value
                      }))
                    }
                    className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary"
                    placeholder="Delivery person name"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Phone number with WhatsApp
                  </span>
                  <div className="relative">
                    <MessageCircle
                      size={17}
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#25D366]"
                    />
                    <input
                      required
                      type="tel"
                      inputMode="tel"
                      minLength={10}
                      maxLength={20}
                      value={deliveryPersonForm.phone}
                      onChange={(event) =>
                        setDeliveryPersonForm((current) => ({
                          ...current,
                          phone: event.target.value
                        }))
                      }
                      className="min-h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-bold text-foreground outline-none transition placeholder:text-muted-foreground/60 focus:border-primary"
                      placeholder="+91 98765 43210"
                    />
                  </div>
                  <span className="mt-1.5 block text-[11px] font-semibold text-muted-foreground">
                    Include the country code for reliable WhatsApp opening.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-xs font-black uppercase tracking-wider text-muted-foreground">
                    Status
                  </span>
                  <select
                    value={deliveryPersonForm.status}
                    onChange={(event) =>
                      setDeliveryPersonForm((current) => ({
                        ...current,
                        status: event.target.value as DeliveryPersonStatus
                      }))
                    }
                    className="min-h-12 w-full rounded-xl border border-border bg-background px-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                  >
                    <option value="available">Available</option>
                    <option value="busy">Busy</option>
                    <option value="offline">Offline</option>
                  </select>
                </label>

                {staffError && (
                  <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400">
                    {staffError}
                  </p>
                )}
              </div>

              <footer className="border-t border-border bg-background/30 p-6">
                <button
                  type="submit"
                  disabled={isSavingStaff}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
                >
                  <CheckCircle2 size={18} />
                  {isSavingStaff
                    ? "Saving..."
                    : editingDeliveryPerson
                      ? "Save changes"
                      : "Add delivery person"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}

    </div>
  );
}
