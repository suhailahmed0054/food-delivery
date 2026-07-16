import type { MenuItem } from "@/lib/data";
import type { SavedOrderItem } from "@/lib/saved-orders";
import type { CartCustomization, CartItemInput } from "@/store/cart-store";

function normalizeItemName(name: string) {
  return name.trim().toLocaleLowerCase();
}

function findMenuItem(menu: MenuItem[], savedItem: SavedOrderItem) {
  if (savedItem.itemId) {
    const idMatch = menu.find((item) => item.id === savedItem.itemId);
    if (idMatch) return idMatch;
  }

  const exactNameMatch = menu.find((item) => item.name.trim() === savedItem.name.trim());
  if (exactNameMatch) return exactNameMatch;

  const normalizedName = normalizeItemName(savedItem.name);
  return menu.find((item) => normalizeItemName(item.name) === normalizedName);
}

function getReorderCustomization(item: MenuItem, savedItem: SavedOrderItem): CartCustomization {
  const sizes = item.customization.sizes;
  const savedSize = savedItem.customization?.size;
  const priceMatchedSize = Number.isFinite(savedItem.unitPrice)
    ? sizes.find((size) => Math.abs(item.price + size.priceDelta - Number(savedItem.unitPrice)) < 0.01)
    : undefined;
  const size =
    sizes.find((option) => option.name === savedSize)?.name ??
    priceMatchedSize?.name ??
    sizes[0]?.name ??
    "Regular";

  const spiceLevels = item.customization.spiceLevels;
  const savedSpiceLevel = savedItem.customization?.spiceLevel;
  const spiceLevel =
    savedSpiceLevel && spiceLevels.includes(savedSpiceLevel)
      ? savedSpiceLevel
      : spiceLevels[0] ?? "Regular";

  const validAddOns = new Set(item.customization.addOns.map((addOn) => addOn.name));
  const addOns = (savedItem.customization?.addOns ?? []).filter((addOn) => validAddOns.has(addOn));

  return { size, spiceLevel, addOns };
}

export function buildReorderCartItems(menu: MenuItem[], savedItems: SavedOrderItem[]) {
  const cartItems: CartItemInput[] = [];
  let unavailableQuantity = 0;

  savedItems.forEach((savedItem) => {
    const menuItem = findMenuItem(menu, savedItem);
    if (!menuItem?.available) {
      unavailableQuantity += savedItem.quantity;
      return;
    }

    cartItems.push({
      item: menuItem,
      customization: getReorderCustomization(menuItem, savedItem),
      quantity: savedItem.quantity
    });
  });

  return { cartItems, unavailableQuantity };
}
