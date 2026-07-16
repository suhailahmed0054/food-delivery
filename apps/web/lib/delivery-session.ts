const DELIVERY_ADDRESS_SESSION_KEY = "al-arab-delivery-address";

export type SessionDeliveryAddress = {
  label: string;
  address: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
};

function normalizeAddress(value: unknown): SessionDeliveryAddress | null {
  if (!value || typeof value !== "object") return null;

  const address = value as Partial<SessionDeliveryAddress>;
  const label = typeof address.label === "string" ? address.label.trim() : "";
  const fullAddress = typeof address.address === "string" ? address.address.trim() : "";

  if (!label || !fullAddress) return null;

  const phone =
    typeof address.phone === "string" ? address.phone.trim().slice(0, 30) : "";
  const latitude =
    typeof address.latitude === "number" &&
    Number.isFinite(address.latitude) &&
    address.latitude >= -90 &&
    address.latitude <= 90
      ? address.latitude
      : undefined;
  const longitude =
    typeof address.longitude === "number" &&
    Number.isFinite(address.longitude) &&
    address.longitude >= -180 &&
    address.longitude <= 180
      ? address.longitude
      : undefined;

  return {
    label: label.slice(0, 50),
    address: fullAddress.slice(0, 1000),
    phone: phone || undefined,
    latitude,
    longitude
  };
}

export function readSessionDeliveryAddress() {
  if (typeof window === "undefined") return null;

  try {
    return normalizeAddress(JSON.parse(window.sessionStorage.getItem(DELIVERY_ADDRESS_SESSION_KEY) ?? ""));
  } catch {
    return null;
  }
}

export function persistSessionDeliveryAddress(address: SessionDeliveryAddress) {
  const normalized = normalizeAddress(address);
  if (!normalized || typeof window === "undefined") return normalized;

  try {
    window.sessionStorage.setItem(DELIVERY_ADDRESS_SESSION_KEY, JSON.stringify(normalized));
  } catch {
    // The in-memory selection still works when browser storage is unavailable.
  }
  return normalized;
}
