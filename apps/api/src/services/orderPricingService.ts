import { z } from "zod";
import { MenuItem } from "../models/MenuItem";
import { Order } from "../models/Order";
import { RestaurantSettings } from "../models/RestaurantSettings";
import { listLocalMenu } from "./localMenuStore";
import { listLocalOrders } from "./localOrderStore";
import {
  defaultRestaurantSettings,
  readLocalSettings,
  type RestaurantSettingsData
} from "./localSettingsStore";

export const pricingOrderItemSchema = z.object({
  menuItem: z.string().trim().min(1).max(200).optional(),
  name: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().int().min(1).max(100),
  price: z.coerce.number().finite().min(0).optional(),
  customization: z
    .object({
      size: z.string().trim().min(1).max(100),
      spiceLevel: z.string().trim().min(1).max(100),
      addOns: z.array(z.string().trim().min(1).max(100)).max(20)
    })
    .optional()
});

export const orderQuoteSchema = z.object({
  items: z.array(pricingOrderItemSchema).min(1).max(100),
  orderType: z.enum(["delivery", "dine_in"]).default("delivery"),
  couponCode: z.string().trim().max(30).optional(),
  phone: z.string().trim().max(30).optional()
});

export type PricingOrderItemInput = z.infer<typeof pricingOrderItemSchema>;
export type OrderQuoteInput = z.infer<typeof orderQuoteSchema>;

export type PricedOrderItem = {
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
};

export type OrderQuote = {
  items: PricedOrderItem[];
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

type PricingMenuItem = {
  id?: unknown;
  _id?: unknown;
  name?: unknown;
  price?: unknown;
  available?: unknown;
  customization?: {
    sizes?: Array<{ name?: unknown; priceDelta?: unknown }>;
    spiceLevels?: unknown[];
    addOns?: Array<{ name?: unknown; price?: unknown }>;
  };
};

export class OrderPricingError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string
  ) {
    super(message);
  }
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizePhone(value?: string) {
  return value?.replace(/\D/g, "") ?? "";
}

function menuItemId(item: PricingMenuItem) {
  const value = item.id ?? item._id;
  return value === undefined || value === null ? "" : String(value);
}

function menuItemName(item: PricingMenuItem) {
  return typeof item.name === "string" ? item.name : "";
}

function findMenuItem(
  menu: PricingMenuItem[],
  requested: PricingOrderItemInput
) {
  if (requested.menuItem) {
    const byId = menu.find((item) => menuItemId(item) === requested.menuItem);
    if (byId) return byId;
  }

  const exactName = menu.find(
    (item) => menuItemName(item) === requested.name
  );
  if (exactName) return exactName;

  const normalizedName = requested.name.toLocaleLowerCase();
  const caseInsensitiveMatches = menu.filter(
    (item) => menuItemName(item).toLocaleLowerCase() === normalizedName
  );
  return caseInsensitiveMatches.length === 1
    ? caseInsensitiveMatches[0]
    : undefined;
}

async function loadMenuForPricing() {
  if (MenuItem.db.readyState !== 1) {
    return (await listLocalMenu()) as PricingMenuItem[];
  }

  return (await MenuItem.find({}).lean()) as PricingMenuItem[];
}

export async function getCommerceSettings(): Promise<RestaurantSettingsData> {
  if (RestaurantSettings.db.readyState !== 1) {
    return readLocalSettings();
  }

  const settings = await RestaurantSettings.findOne({ key: "restaurant" })
    .lean();
  return {
    ...defaultRestaurantSettings,
    ...(settings ?? {})
  } as RestaurantSettingsData;
}

async function hasPreviousOrder(phone?: string) {
  const normalizedPhone = normalizePhone(phone);
  if (!normalizedPhone) return false;

  if (Order.db.readyState !== 1) {
    const orders = await listLocalOrders();
    return orders.some(
      (order) =>
        order.customerPhoneNormalized === normalizedPhone ||
        normalizePhone(order.phone) === normalizedPhone
    );
  }

  return Boolean(
    await Order.exists({
      $or: [
        { customerPhoneNormalized: normalizedPhone },
        { phone }
      ]
    })
  );
}

function priceMenuItem(
  menu: PricingMenuItem[],
  requested: PricingOrderItemInput
): PricedOrderItem {
  const item = findMenuItem(menu, requested);
  if (!item) {
    throw new OrderPricingError(
      `${requested.name} is no longer on the menu. Remove it from your cart.`,
      409,
      "ITEM_NOT_FOUND"
    );
  }
  if (item.available === false) {
    throw new OrderPricingError(
      `${menuItemName(item)} is currently unavailable. Remove it from your cart to continue.`,
      409,
      "ITEM_UNAVAILABLE"
    );
  }

  const basePrice = Number(item.price);
  if (!Number.isFinite(basePrice) || basePrice < 0) {
    throw new OrderPricingError(
      `${menuItemName(item)} cannot be priced right now.`,
      409,
      "INVALID_MENU_PRICE"
    );
  }

  const sizes = item.customization?.sizes ?? [];
  const spiceLevels = item.customization?.spiceLevels ?? [];
  const addOns = item.customization?.addOns ?? [];
  const requestedSize = requested.customization?.size;
  const size = requestedSize
    ? sizes.find((option) => option.name === requestedSize)
    : sizes[0];
  const requestedSpice = requested.customization?.spiceLevel;
  const spiceLevel = requestedSpice ?? String(spiceLevels[0] ?? "Regular");
  const requestedAddOns = [
    ...new Set(requested.customization?.addOns ?? [])
  ];

  if (!size || (requestedSpice && !spiceLevels.includes(requestedSpice))) {
    throw new OrderPricingError(
      `The options for ${menuItemName(item)} changed. Remove it and add it again.`,
      409,
      "CUSTOMIZATION_CHANGED"
    );
  }

  const selectedAddOns = requestedAddOns.map((name) => {
    const addOn = addOns.find((option) => option.name === name);
    if (!addOn) {
      throw new OrderPricingError(
        `The options for ${menuItemName(item)} changed. Remove it and add it again.`,
        409,
        "CUSTOMIZATION_CHANGED"
      );
    }
    return addOn;
  });
  const unitPrice = roundMoney(
    Math.max(
      0,
      basePrice +
        Number(size.priceDelta ?? 0) +
        selectedAddOns.reduce(
          (sum, addOn) => sum + Number(addOn.price ?? 0),
          0
        )
    )
  );

  return {
    menuItem: menuItemId(item),
    name: menuItemName(item),
    quantity: requested.quantity,
    price: unitPrice,
    lineTotal: roundMoney(unitPrice * requested.quantity),
    customization: {
      size: String(size.name),
      spiceLevel,
      addOns: selectedAddOns.map((addOn) => String(addOn.name))
    }
  };
}

export async function quoteOrderPricing(
  input: OrderQuoteInput
): Promise<OrderQuote> {
  const [menu, settings] = await Promise.all([
    loadMenuForPricing(),
    getCommerceSettings()
  ]);

  if (input.orderType === "delivery" && !settings.deliveryEnabled) {
    throw new OrderPricingError(
      "Delivery ordering is currently unavailable.",
      409,
      "DELIVERY_DISABLED"
    );
  }
  if (input.orderType === "dine_in" && !settings.dineInEnabled) {
    throw new OrderPricingError(
      "Dine-in ordering is currently unavailable.",
      409,
      "DINE_IN_DISABLED"
    );
  }

  const items = input.items.map((item) => priceMenuItem(menu, item));
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + item.lineTotal, 0)
  );
  const couponCode = input.couponCode?.trim().toUpperCase() ?? "";
  let itemDiscount = 0;
  let deliveryDiscount = 0;
  let coupon: OrderQuote["coupon"];
  const baseDeliveryFee =
    input.orderType === "delivery" ? settings.deliveryFee : 0;

  if (couponCode === "ALARAB10") {
    const applied = subtotal >= 500;
    itemDiscount = applied ? roundMoney(subtotal * 0.1) : 0;
    coupon = {
      code: couponCode,
      applied,
      message: applied
        ? "10% discount applied."
        : `Add Rs ${roundMoney(500 - subtotal)} more to use ALARAB10.`
    };
  } else if (couponCode === "FREEDEL") {
    const applied = input.orderType === "delivery" && subtotal >= 999;
    deliveryDiscount = applied ? baseDeliveryFee : 0;
    coupon = {
      code: couponCode,
      applied,
      message:
        input.orderType !== "delivery"
          ? "FREEDEL is only available for delivery orders."
          : applied
            ? baseDeliveryFee > 0
              ? "Free delivery applied."
              : "Delivery is already free."
            : `Add Rs ${roundMoney(999 - subtotal)} more to use FREEDEL.`
    };
  } else if (couponCode === "WELCOME50") {
    const hasPhone = Boolean(normalizePhone(input.phone));
    const firstOrder = hasPhone
      ? !(await hasPreviousOrder(input.phone))
      : false;
    const applied = hasPhone && firstOrder;
    itemDiscount = applied ? Math.min(50, subtotal) : 0;
    coupon = {
      code: couponCode,
      applied,
      message: !hasPhone
        ? "Add a delivery phone number to verify WELCOME50."
        : applied
          ? "First-order discount applied."
          : "WELCOME50 is only valid on your first order."
    };
  } else if (couponCode) {
    coupon = {
      code: couponCode,
      applied: false,
      message: "This coupon code is not valid."
    };
  }

  const taxableSubtotal = roundMoney(
    Math.max(0, subtotal - itemDiscount)
  );
  const tax = roundMoney(taxableSubtotal * settings.taxRate);
  const deliveryFee = roundMoney(
    Math.max(0, baseDeliveryFee - deliveryDiscount)
  );
  const discount = roundMoney(itemDiscount + deliveryDiscount);
  const total = roundMoney(taxableSubtotal + tax + deliveryFee);
  const minimumOrder =
    input.orderType === "delivery" ? settings.minimumOrder : 0;
  const amountToMinimum = roundMoney(
    Math.max(0, minimumOrder - subtotal)
  );

  return {
    items,
    subtotal,
    itemDiscount,
    deliveryDiscount,
    discount,
    taxRate: settings.taxRate,
    tax,
    deliveryFee,
    total,
    minimumOrder,
    amountToMinimum,
    canOrder: amountToMinimum === 0,
    coupon
  };
}
