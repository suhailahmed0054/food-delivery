import { menuItems, type MenuItem } from "@/lib/data";

const CONFIGURED_API_URL = process.env.NEXT_PUBLIC_API_URL?.trim();

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function isLoopbackHostname(hostname: string) {
  return ["localhost", "127.0.0.1", "::1"].includes(hostname);
}

function getApiBaseUrl() {
  if (CONFIGURED_API_URL) {
    if (typeof window !== "undefined") {
      try {
        const configuredUrl = new URL(CONFIGURED_API_URL, window.location.origin);
        if (
          isLoopbackHostname(configuredUrl.hostname) &&
          !isLoopbackHostname(window.location.hostname)
        ) {
          configuredUrl.hostname = window.location.hostname;
          configuredUrl.protocol = window.location.protocol;
          configuredUrl.port = configuredUrl.port || "5000";
          return trimTrailingSlash(configuredUrl.toString());
        }
      } catch {
        // Fall through to the configured value below.
      }
    }

    return trimTrailingSlash(CONFIGURED_API_URL);
  }

  if (typeof window !== "undefined") {
    const { hostname, protocol } = window.location;

    if (hostname && !isLoopbackHostname(hostname)) {
      return `${protocol}//${hostname}:5000/api`;
    }
  }

  return "http://localhost:5000/api";
}

export function getApiSocketUrl() {
  if (typeof window === "undefined") return "";
  return new URL(getApiBaseUrl(), window.location.origin).origin;
}

export type MenuItemPayload = Omit<MenuItem, "id">;

export type AuthResponse = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "customer" | "admin" | "kitchen";
  };
};

export type CustomerAddress = {
  id: string;
  label: string;
  address: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
  isDefault: boolean;
};

export type CustomerNotificationPreferences = {
  orderUpdates: boolean;
  offers: boolean;
};

export type InAppNotification = {
  id: string;
  audience: "admin" | "customer";
  type: "order" | "payment" | "delivery" | "support" | "system";
  title: string;
  message: string;
  href?: string;
  orderNumber?: string;
  supportIssueId?: string;
  readAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type NotificationFeed = {
  notifications: InAppNotification[];
  unreadCount: number;
};

export type CustomerAccount = {
  id: string;
  name: string;
  email: string;
  phone: string;
  addresses: CustomerAddress[];
  notificationPreferences: CustomerNotificationPreferences;
  joinedAt: string;
};

export type ResolvedTable = {
  id: string;
  tableNumber: number;
  label: string;
  token?: string;
};

export type RestaurantTable = ResolvedTable & {
  qrToken: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
};

export type DeliveryPersonStatus = "available" | "busy" | "offline";

export type DeliveryPerson = {
  id: string;
  name: string;
  phone: string;
  status: DeliveryPersonStatus;
  createdAt?: string;
  updatedAt?: string;
};

export type DeliveryPersonPayload = Pick<DeliveryPerson, "name" | "phone" | "status">;

export type AdminCustomer = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  orderCount: number;
  totalSpent: number;
  joinedAt?: string;
  lastOrderAt?: string;
  isBlocked: boolean;
  blockedAt?: string;
  blockReason?: string;
  adminNotes?: string;
};

export type AdminCustomerDetail = AdminCustomer & {
  orders: ApiOrder[];
};

export type ReportSummary = {
  period: { from: string; to: string };
  totals: {
    orders: number;
    revenue: number;
    averageOrderValue: number;
    deliveryOrders: number;
    dineInOrders: number;
    paidOrders: number;
    cancelledOrders: number;
    uniqueCustomers: number;
    repeatCustomers: number;
  };
  payments: { cash: number; online: number };
  feedback: { averageRating: number; reviewCount: number };
  topItems: Array<{ name: string; quantity: number; revenue: number }>;
  dailySales: Array<{ date: string; orders: number; revenue: number }>;
  deliveryPerformance: Array<{
    name: string;
    assigned: number;
    delivered: number;
  }>;
  tablePerformance: Array<{
    tableNumber: string;
    orders: number;
    revenue: number;
  }>;
};

export type RestaurantSettingsData = {
  restaurantName: string;
  phone: string;
  address: string;
  openingTime: string;
  closingTime: string;
  deliveryEnabled: boolean;
  dineInEnabled: boolean;
  restaurantOpen: boolean;
  deliveryFee: number;
  taxRate: number;
  minimumOrder: number;
  cashEnabled: boolean;
  onlinePaymentEnabled: boolean;
  whatsappTemplate: string;
  updatedAt?: string;
};

export type OrderPayload = {
  items: Array<{
    menuItem?: string;
    name: string;
    quantity: number;
    price?: number;
    customization?: {
      size: string;
      spiceLevel: string;
      addOns: string[];
    };
  }>;
  total?: number;
  tax?: number;
  deliveryFee?: number;
  discount?: number;
  couponCode?: string;
  paymentMethod: "cash_on_delivery" | "razorpay";
  paymentStatus: "pending" | "paid" | "failed" | "refunded";
  orderType: "delivery" | "dine_in";
  tableToken?: string;
  customerName?: string;
  phone?: string;
  email?: string;
  address?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryTime?: string;
  specialInstructions?: string;
};

export type ApiOrder = {
  id?: string;
  _id?: string;
  orderNumber: string;
  customer?: unknown;
  customerName?: string;
  items: Array<{
    menuItem?: string;
    name: string;
    quantity: number;
    price: number;
    customization?: {
      size: string;
      spiceLevel: string;
      addOns: string[];
    };
  }>;
  subtotal?: number;
  total: number;
  tax?: number;
  deliveryFee?: number;
  discount?: number;
  couponCode?: string;
  status: string;
  paymentMethod?: "cash_on_delivery" | "razorpay";
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  refundStatus?: "pending" | "processed" | "failed";
  refundAmount?: number;
  razorpayRefundId?: string;
  orderType: "delivery" | "dine_in";
  tableNumber?: string;
  phone?: string;
  email?: string;
  address?: string;
  deliveryLatitude?: number;
  deliveryLongitude?: number;
  deliveryDistanceKm?: number;
  deliveryTime?: string;
  specialInstructions?: string;
  trackingToken?: string;
  estimatedDeliveryAt?: string;
  statusHistory?: Array<{
    status: string;
    at: string;
  }>;
  deliveryAgent?: {
    staffId?: string;
    name?: string;
    phone?: string;
  };
  completedAt?: string;
  createdAt: string;
  updatedAt?: string;
};

export type RazorpayCheckoutSession = {
  keyId: string;
  orderId: string;
  amount: number;
  currency: "INR";
};

export type RazorpayPaymentResult = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

export type OrderQuoteRequest = {
  items: Array<{
    menuItem?: string;
    name: string;
    quantity: number;
    customization?: {
      size: string;
      spiceLevel: string;
      addOns: string[];
    };
  }>;
  orderType: "delivery" | "dine_in";
  couponCode?: string;
  phone?: string;
};

export type OrderQuoteData = {
  items: Array<{
    menuItem: string;
    name: string;
    quantity: number;
    price: number;
    lineTotal: number;
    customization: {
      size: string;
      spiceLevel: string;
      addOns: string[];
    };
  }>;
  subtotal: number;
  itemDiscount: number;
  deliveryDiscount: number;
  discount: number;
  taxRate: number;
  tax: number;
  deliveryFee: number;
  total: number;
  minimumOrder: number;
  amountToMinimum: number;
  canOrder: boolean;
  coupon?: {
    code: string;
    applied: boolean;
    message: string;
  };
};

export type ApiOrderTracking = {
  orderNumber: string;
  status: string;
  orderType: "delivery" | "dine_in";
  tableNumber?: string;
  paymentStatus?: "pending" | "paid" | "failed" | "refunded";
  refundStatus?: "pending" | "processed" | "failed";
  refundAmount?: number;
  razorpayRefundId?: string;
  deliveryTime?: string;
  estimatedDeliveryAt?: string;
  deliveryAgent?: {
    name?: string;
    phone?: string;
    location?: {
      lat?: number;
      lng?: number;
    };
  };
  statusHistory: Array<{
    status: string;
    at: string;
  }>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type ClaimedOrderTracking = {
  trackingToken: string;
  order: ApiOrderTracking;
};

export type SupportIssue = {
  id: string;
  _id?: string;
  order: string;
  orderNumber: string;
  customer?: string;
  customerName: string;
  phone: string;
  email?: string;
  category: "missing_items" | "wrong_items" | "poor_quality" | "delivery_delay" | "other";
  description: string;
  desiredResolution: "refund" | "redelivery" | "feedback";
  status: "open" | "investigating" | "resolved" | "refunded" | "closed";
  resolutionDetails: string;
  refundAmount: number;
  createdAt: string;
  updatedAt: string;
  images?: string[];
  chatStatus?: "waiting" | "active" | "closed";
  assignedAgent?: string;
  assignedAgentName?: string;
  lastMessage?: string;
  lastMessageAt?: string;
  resolutionType?: "none" | "refund" | "partial_refund" | "replacement" | "coupon" | "rejected" | "resolved";
  decisionReason?: string;
  refundApproved?: boolean;
  refundStatus?: "none" | "pending" | "processed" | "failed";
  razorpayRefundId?: string;
  closedAt?: string;
};

export type SupportIssuePage = {
  issues: SupportIssue[];
  pagination: { page: number; limit: number; total: number; pages: number };
};

export type CustomerReview = {
  id: string;
  menuItem: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt?: string;
  updatedAt?: string;
};

export type SupportMessage = {
  id: string;
  _id?: string;
  issue: string;
  order?: string;
  sender?: string;
  senderType: "customer" | "guest" | "agent" | "admin" | "system";
  senderName: string;
  message: string;
  images?: string[];
  createdAt: string;
  readAt?: string;
};

async function getApiErrorMessage(response: Response, fallback: string) {
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const error = await response.json().catch(() => null);
    return error?.message ?? error?.error ?? fallback;
  }

  if (response.status === 413) {
    return "Dish image is too large. Please upload a smaller image.";
  }

  const text = await response.text().catch(() => "");
  return text && !text.trim().startsWith("<") ? text : fallback;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fallback = "API request failed",
  authScope: "admin" | "customer" = "admin"
) {
  const performRequest = () =>
    fetch(`${getApiBaseUrl()}${path}`, {
      ...init,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers
      }
    });

  let response = await performRequest();
  const isAdminAuthRequest = path.startsWith("/auth/");
  if (response.status === 401 && !isAdminAuthRequest) {
    const refreshed = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role: authScope })
    });
    if (refreshed.ok) response = await performRequest();
  }

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, fallback));
  }

  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("al-arab-admin-auth");
  }

  return {};
}

export async function loginAccount(email: string, password: string) {
  return requestJson<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }, "Unable to sign in");
}

export async function loginAdmin(email: string, password: string) {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("al-arab-admin-auth");
  }

  return requestJson<{ user: AuthResponse["user"] }>("/auth/admin/login", {
    method: "POST",
    body: JSON.stringify({ email, password })
  }, "Unable to sign in to the admin dashboard");
}

export async function fetchCurrentAdmin() {
  const fetchSession = () =>
    fetch(`${getApiBaseUrl()}/auth/me`, {
      method: "GET",
      credentials: "include",
      cache: "no-store"
    });

  let response = await fetchSession();
  if (response.status === 401) {
    const refreshed = await fetch(`${getApiBaseUrl()}/auth/refresh`, {
      method: "POST",
      credentials: "include"
    });
    if (refreshed.ok) response = await fetchSession();
  }

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Admin session expired"));
  }
  return response.json() as Promise<{ user: AuthResponse["user"] }>;
}

export async function fetchSystemHealth() {
  const response = await fetch(`${getApiBaseUrl()}/health`, {
    method: "GET",
    cache: "no-store"
  });
  if (!response.ok) {
    throw new Error("System health check failed");
  }
  return response.json() as Promise<{ ok: boolean; service: string }>;
}

export async function logoutAdmin() {
  await fetch(`${getApiBaseUrl()}/auth/logout`, {
    method: "POST",
    credentials: "include"
  });
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("al-arab-admin-auth");
  }
}

export async function registerAccount(name: string, email: string, password: string) {
  return requestJson<AuthResponse>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ name, email, password })
  }, "Unable to create account");
}

export async function fetchMenu() {
  try {
    const response = await fetch(`${getApiBaseUrl()}/menu`);
    if (!response.ok) throw new Error("Menu API unavailable");
    const data = await response.json();
    if (!Array.isArray(data) || data.some((item) => !item.customization?.sizes || !item.customization?.addOns)) {
      return menuItems.map((item) => ({ ...item, rating: 0, reviews: 0 }));
    }
    return data;
  } catch {
    return menuItems.map((item) => ({ ...item, rating: 0, reviews: 0 }));
  }
}

export async function createMenuItem(payload: MenuItemPayload) {
  return requestJson<MenuItem>("/menu", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateMenuItem(id: string, payload: MenuItemPayload) {
  return requestJson<MenuItem>(`/menu/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteMenuItem(id: string) {
  const response = await fetch(`${getApiBaseUrl()}/menu/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Unable to delete menu item"));
  }
}

export async function createCheckout(orderNumber: string, trackingToken: string) {
  return requestJson<RazorpayCheckoutSession>("/payments/create-order", {
    method: "POST",
    body: JSON.stringify({ orderNumber, trackingToken })
  }, "Unable to start secure online payment", "customer");
}

export async function verifyCheckoutPayment(
  orderNumber: string,
  trackingToken: string,
  payment: RazorpayPaymentResult
) {
  return requestJson<{ order: ApiOrder }>("/payments/verify", {
    method: "POST",
    body: JSON.stringify({
      orderNumber,
      trackingToken,
      razorpayOrderId: payment.razorpay_order_id,
      razorpayPaymentId: payment.razorpay_payment_id,
      razorpaySignature: payment.razorpay_signature
    })
  }, "Unable to verify the online payment", "customer");
}

export async function resolveTableQr(input: { token?: string; legacyTableNumber?: string }) {
  return requestJson<ResolvedTable>("/tables/resolve", {
    method: "POST",
    body: JSON.stringify(input)
  }, "Unable to verify this table QR code");
}

export async function fetchRestaurantTables() {
  return requestJson<RestaurantTable[]>("/tables", {
    method: "GET",
    headers: getAuthHeaders()
  }, "Unable to load restaurant tables");
}

export async function createRestaurantTable(payload: {
  tableNumber: number;
  label?: string;
}) {
  return requestJson<RestaurantTable>("/tables", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  }, "Unable to add table");
}

export async function regenerateRestaurantTableQr(id: string) {
  return requestJson<RestaurantTable>(`/tables/${encodeURIComponent(id)}/regenerate`, {
    method: "POST",
    headers: getAuthHeaders()
  }, "Unable to regenerate the table QR code");
}

export async function setRestaurantTableActive(id: string, isActive: boolean) {
  return requestJson<RestaurantTable>(`/tables/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ isActive })
  }, "Unable to update the table");
}

export async function fetchDeliveryPeople() {
  return requestJson<DeliveryPerson[]>("/staff", {
    method: "GET",
    headers: getAuthHeaders()
  }, "Unable to load delivery people");
}

export async function createDeliveryPerson(payload: DeliveryPersonPayload) {
  return requestJson<DeliveryPerson>("/staff", {
    method: "POST",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  }, "Unable to add delivery person");
}

export async function updateDeliveryPerson(id: string, payload: DeliveryPersonPayload) {
  return requestJson<DeliveryPerson>(`/staff/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(payload)
  }, "Unable to update delivery person");
}

export async function deleteDeliveryPerson(id: string) {
  const response = await fetch(`${getApiBaseUrl()}/staff/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
    credentials: "include"
  });
  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response, "Unable to delete delivery person"));
  }
}

export async function fetchCustomers(search = "", status = "all") {
  const query = new URLSearchParams();
  if (search.trim()) query.set("search", search.trim());
  if (status !== "all") query.set("status", status);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return requestJson<AdminCustomer[]>(`/customers${suffix}`, {
    method: "GET",
    headers: getAuthHeaders()
  }, "Unable to load customers");
}

export async function fetchCustomer(id: string) {
  return requestJson<AdminCustomerDetail>(
    `/customers/${encodeURIComponent(id)}`,
    { method: "GET", headers: getAuthHeaders() },
    "Unable to load customer"
  );
}

export async function setCustomerBlocked(
  id: string,
  blocked: boolean,
  reason?: string
) {
  return requestJson<AdminCustomer>(
    `/customers/${encodeURIComponent(id)}/${blocked ? "block" : "unblock"}`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(blocked ? { reason } : {})
    },
    blocked ? "Unable to block customer" : "Unable to unblock customer"
  );
}

export async function updateCustomerNotes(id: string, notes: string) {
  return requestJson<AdminCustomer>(
    `/customers/${encodeURIComponent(id)}/notes`,
    {
      method: "PUT",
      headers: getAuthHeaders(),
      body: JSON.stringify({ notes })
    },
    "Unable to save customer notes"
  );
}

export async function fetchReportSummary(from: string, to: string) {
  const query = new URLSearchParams({ from, to });
  return requestJson<ReportSummary>(`/reports/summary?${query.toString()}`, {
    method: "GET",
    headers: getAuthHeaders()
  }, "Unable to load reports");
}

export async function fetchRestaurantSettings() {
  return requestJson<RestaurantSettingsData>("/settings", {
    method: "GET",
    headers: getAuthHeaders()
  }, "Unable to load settings");
}

export async function fetchCustomerAccount() {
  return requestJson<CustomerAccount>(
    "/account",
    { method: "GET" },
    "Unable to load your account",
    "customer"
  );
}

export async function fetchNotifications(
  scope: "admin" | "customer"
) {
  return requestJson<NotificationFeed>(
    "/notifications",
    {
      method: "GET",
      cache: "no-store",
      headers: { "X-Notification-Scope": scope }
    },
    "Unable to load notifications",
    scope
  );
}

export async function markNotificationRead(
  id: string,
  scope: "admin" | "customer"
) {
  return requestJson<InAppNotification>(
    `/notifications/${encodeURIComponent(id)}/read`,
    {
      method: "PATCH",
      headers: { "X-Notification-Scope": scope }
    },
    "Unable to update notification",
    scope
  );
}

export async function markAllNotificationsRead(
  scope: "admin" | "customer"
) {
  return requestJson<{ updated: number }>(
    "/notifications/read-all",
    {
      method: "PATCH",
      headers: { "X-Notification-Scope": scope }
    },
    "Unable to update notifications",
    scope
  );
}

export async function updateCustomerProfile(payload: {
  name: string;
  email: string;
  phone: string;
}) {
  return requestJson<CustomerAccount>(
    "/account/profile",
    {
      method: "PUT",
      body: JSON.stringify(payload)
    },
    "Unable to update your profile",
    "customer"
  );
}

export async function addCustomerAddress(
  payload: Omit<CustomerAddress, "id" | "isDefault"> & {
    isDefault?: boolean;
  }
) {
  return requestJson<CustomerAddress>(
    "/account/addresses",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    "Unable to save this address",
    "customer"
  );
}

export async function deleteCustomerAddress(id: string) {
  return requestJson<void>(
    `/account/addresses/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "Unable to remove this address",
    "customer"
  );
}

export async function updateCustomerNotifications(
  preferences: CustomerNotificationPreferences
) {
  return requestJson<CustomerNotificationPreferences>(
    "/account/notifications",
    {
      method: "PUT",
      body: JSON.stringify(preferences)
    },
    "Unable to update notification preferences",
    "customer"
  );
}

export async function changeCustomerPassword(
  currentPassword: string,
  newPassword: string
) {
  return requestJson<void>(
    "/account/password",
    {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword })
    },
    "Unable to change your password",
    "customer"
  );
}

export async function fetchCustomerOrders() {
  return requestJson<ApiOrder[]>(
    "/account/orders",
    { method: "GET" },
    "Unable to load your account orders",
    "customer"
  );
}

export async function claimCustomerOrders(
  orders: Array<{ orderNumber: string; trackingToken: string }>
) {
  return requestJson<{ claimed: number }>(
    "/account/orders/claim",
    {
      method: "POST",
      body: JSON.stringify({ orders })
    },
    "Unable to link saved orders",
    "customer"
  );
}

export async function logoutAccount() {
  await fetch(`${getApiBaseUrl()}/auth/customer/logout`, {
    method: "POST",
    credentials: "include"
  });
}

export async function fetchPublicRestaurantSettings() {
  return requestJson<RestaurantSettingsData>("/settings/public", {
    method: "GET"
  }, "Unable to check restaurant status");
}

export async function updateRestaurantSettings(
  settings: RestaurantSettingsData
) {
  return requestJson<RestaurantSettingsData>("/settings", {
    method: "PUT",
    headers: getAuthHeaders(),
    body: JSON.stringify(settings)
  }, "Unable to save settings");
}

export async function createOrder(payload: OrderPayload) {
  return requestJson<ApiOrder>("/orders", {
    method: "POST",
    body: JSON.stringify(payload)
  }, "Unable to place the order", "customer");
}

export async function quoteOrder(payload: OrderQuoteRequest) {
  return requestJson<OrderQuoteData>(
    "/orders/quote",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    "Unable to verify current prices"
  );
}

export async function fetchOrderTracking(
  orderNumber: string,
  trackingToken: string
) {
  return requestJson<ApiOrderTracking>(
    `/orders/${encodeURIComponent(orderNumber)}/tracking`,
    {
      method: "POST",
      body: JSON.stringify({ trackingToken })
    },
    "Unable to refresh order tracking"
  );
}

export async function claimOrderTracking(orderNumber: string, phone: string) {
  return requestJson<ClaimedOrderTracking>(
    `/orders/${encodeURIComponent(orderNumber)}/tracking/claim`,
    {
      method: "POST",
      body: JSON.stringify({ phone })
    },
    "Unable to activate order tracking"
  );
}

export async function fetchOrders() {
  return requestJson<ApiOrder[]>("/orders", {
    method: "GET",
    headers: getAuthHeaders()
  }, "Unable to load orders");
}

export async function updateOrderStatus(id: string, status: string) {
  return requestJson<ApiOrder>(`/orders/${encodeURIComponent(id)}/status`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status })
  }, "Unable to update the order status");
}

export async function assignOrderDelivery(id: string, deliveryPersonId: string) {
  return requestJson<ApiOrder>(`/orders/${encodeURIComponent(id)}/assign-delivery`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ deliveryPersonId })
  }, "Unable to assign delivery person");
}

export async function cancelOrder(id: string, reason?: string, trackingToken?: string) {
  return requestJson<ApiOrder>(`/orders/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
    body: JSON.stringify({ reason, trackingToken })
  }, "Unable to cancel the order", "customer");
}

export async function fetchOrderReviews(
  orderNumber: string,
  trackingToken?: string
) {
  const query = new URLSearchParams();
  if (trackingToken) query.set("trackingToken", trackingToken);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return requestJson<CustomerReview[]>(
    `/reviews/order/${encodeURIComponent(orderNumber)}${suffix}`,
    { method: "GET" },
    "Unable to load your reviews",
    "customer"
  );
}

export async function submitOrderReviews(payload: {
  orderNumber: string;
  trackingToken?: string;
  items: Array<{ menuItem: string; rating: number; comment: string }>;
}) {
  return requestJson<{ reviews: CustomerReview[] }>(
    "/reviews",
    {
      method: "POST",
      body: JSON.stringify(payload)
    },
    "Unable to save your review",
    "customer"
  );
}

export async function fetchMenuItemReviews(menuItemId: string) {
  return requestJson<CustomerReview[]>(
    `/reviews/menu/${encodeURIComponent(menuItemId)}`,
    { method: "GET" },
    "Unable to load reviews",
    "customer"
  );
}

export async function reportOrderIssue(payload: {
  orderNumber: string;
  category: string;
  description: string;
  desiredResolution: string;
  trackingToken?: string;
  images?: string[];
}) {
  return requestJson<SupportIssue>("/support/issues", {
    method: "POST",
    body: JSON.stringify(payload)
  }, "Unable to report the support issue", "customer");
}

export async function fetchCustomerIssues(credentials?: {
  orderNumber: string;
  trackingToken: string;
}) {
  const params = new URLSearchParams();
  if (credentials) {
    params.set("orderNumber", credentials.orderNumber);
  }
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return requestJson<SupportIssue[]>(`/support/issues/customer${suffix}`, {
    method: "GET",
    headers: credentials
      ? { "X-Order-Tracking-Token": credentials.trackingToken }
      : undefined
  }, "Unable to load support issues", "customer");
}

export async function fetchSupportIssue(
  issueId: string,
  trackingToken?: string
) {
  return requestJson<SupportIssue>(
    `/support/issues/${encodeURIComponent(issueId)}`,
    {
      method: "GET",
      headers: trackingToken
        ? { "X-Order-Tracking-Token": trackingToken }
        : undefined
    },
    "Unable to load the support ticket",
    "customer"
  );
}

export async function fetchAdminIssues(filters: {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
} = {}) {
  const query = new URLSearchParams();
  if (filters.page) query.set("page", String(filters.page));
  if (filters.limit) query.set("limit", String(filters.limit));
  if (filters.status) query.set("status", filters.status);
  if (filters.search) query.set("search", filters.search);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return requestJson<SupportIssuePage>(`/support/issues${suffix}`, {
    method: "GET",
    headers: getAuthHeaders()
  }, "Unable to load support issues");
}

export async function updateIssueStatus(
  id: string,
  status: string,
  resolutionDetails?: string,
  refundAmount?: number
) {
  return requestJson<SupportIssue>(`/support/issues/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: getAuthHeaders(),
    body: JSON.stringify({ status, resolutionDetails, refundAmount })
  }, "Unable to update the issue status");
}

export async function fetchIssueMessages(
  issueId: string,
  trackingToken?: string
) {
  return requestJson<SupportMessage[]>(
    `/support/issues/${encodeURIComponent(issueId)}/messages`,
    {
      method: "GET",
      headers: trackingToken
        ? { "X-Order-Tracking-Token": trackingToken }
        : undefined
    },
    "Unable to load chat messages",
    "customer"
  );
}

export async function sendIssueMessage(
  issueId: string,
  payload: {
    message: string;
    senderType?: string;
    senderName?: string;
    images?: string[];
  },
  trackingToken?: string
) {
  return requestJson<SupportMessage>(
    `/support/issues/${encodeURIComponent(issueId)}/messages`,
    {
      method: "POST",
      headers: trackingToken
        ? { "X-Order-Tracking-Token": trackingToken }
        : undefined,
      body: JSON.stringify(payload)
    },
    "Unable to send message",
    "customer"
  );
}

export async function assignIssueAgent(issueId: string) {
  return requestJson<SupportIssue>(
    `/support/issues/${encodeURIComponent(issueId)}/assign`,
    {
      method: "PATCH",
      headers: getAuthHeaders()
    },
    "Unable to assign agent"
  );
}

export async function decideIssueResolution(
  issueId: string,
  payload: {
    resolutionType: string;
    decisionReason: string;
    refundAmount?: number;
    resolutionDetails?: string;
  }
) {
  return requestJson<SupportIssue>(
    `/support/issues/${encodeURIComponent(issueId)}/decision`,
    {
      method: "PATCH",
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    },
    "Unable to apply decision"
  );
}
