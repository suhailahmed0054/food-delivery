type WhatsAppOrderItem = {
  name?: unknown;
  quantity?: unknown;
  item?: { name?: unknown };
};

export type DeliveryWhatsAppOrder = {
  id: string;
  orderNumber?: string;
  customer?: unknown;
  customerName?: unknown;
  phone?: unknown;
  address?: unknown;
  deliveryLatitude?: unknown;
  deliveryLongitude?: unknown;
  paymentMethod?: unknown;
  paymentStatus?: unknown;
  orderType?: unknown;
  items?: WhatsAppOrderItem[] | string;
  total: number;
};

export const DEFAULT_DELIVERY_WHATSAPP_TEMPLATE = [
  "*Al-Arab Delivery Assignment*",
  "Order: {{orderNumber}}",
  "",
  "Customer: {{customerName}}",
  "Phone: {{phone}}",
  "Delivery location: {{locationLink}}",
  "",
  "*Ordered items*",
  "{{items}}",
  "",
  "Total amount: {{total}}",
  "Payment status: {{paymentStatus}}"
].join("\n");

function text(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  return value.trim() || fallback;
}

function getItems(order: DeliveryWhatsAppOrder) {
  if (Array.isArray(order.items) && order.items.length > 0) {
    return order.items
      .map((item) => {
        const quantity = Number(item.quantity) || 1;
        const name = item.name ?? item.item?.name ?? "Item";
        return `- ${quantity} x ${String(name)}`;
      })
      .join("\n");
  }

  if (typeof order.items === "string" && order.items.trim()) {
    return `- ${order.items.trim()}`;
  }

  return "- Custom order";
}

function getPaymentStatus(order: DeliveryWhatsAppOrder) {
  if (order.paymentMethod === "cash_on_delivery") return "COD";
  if (order.paymentMethod === "razorpay") {
    return order.paymentStatus === "paid"
      ? "Paid via Razorpay"
      : "Razorpay payment pending";
  }
  return "Payment not recorded";
}

export function getDeliveryLocationLink(order: DeliveryWhatsAppOrder) {
  const latitude = Number(order.deliveryLatitude);
  const longitude = Number(order.deliveryLongitude);
  if (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  ) {
    return `https://maps.google.com/?q=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  }

  const address = text(order.address, "");
  if (address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
      address
    )}`;
  }

  return "Location link unavailable";
}

export function buildDeliveryWhatsAppMessage(
  order: DeliveryWhatsAppOrder,
  template?: string
) {
  const locationLink = getDeliveryLocationLink(order);
  const values: Record<string, string> = {
    orderNumber: order.orderNumber ?? order.id,
    customerName: text(
      order.customerName ?? order.customer,
      "Guest customer"
    ),
    phone: text(order.phone, "Phone not added"),
    locationLink,
    deliveryLocation: locationLink,
    // Existing templates using address now receive a maps link automatically.
    address: locationLink,
    items: getItems(order),
    total: `Rs ${order.total.toLocaleString("en-IN")}`,
    paymentStatus: getPaymentStatus(order)
  };

  return (template?.trim() || DEFAULT_DELIVERY_WHATSAPP_TEMPLATE).replace(
    /\{\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}\}|\{\s*([A-Za-z][A-Za-z0-9]*)\s*\}/g,
    (placeholder, doubleBraceKey: string, singleBraceKey: string) =>
      values[doubleBraceKey || singleBraceKey] ?? placeholder
  );
}
