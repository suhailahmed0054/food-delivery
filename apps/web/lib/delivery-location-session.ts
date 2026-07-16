const DELIVERY_LOCATION_SESSION_KEY = "al-arab-delivery-location";

export type SessionDeliveryLocation = {
  latitude: number;
  longitude: number;
  displayName: string;
};

function normalizeLocation(value: unknown): SessionDeliveryLocation | null {
  if (!value || typeof value !== "object") return null;

  const location = value as Partial<SessionDeliveryLocation>;
  if (
    typeof location.latitude !== "number" ||
    !Number.isFinite(location.latitude) ||
    location.latitude < -90 ||
    location.latitude > 90 ||
    typeof location.longitude !== "number" ||
    !Number.isFinite(location.longitude) ||
    location.longitude < -180 ||
    location.longitude > 180
  ) {
    return null;
  }

  const displayName =
    typeof location.displayName === "string"
      ? location.displayName.trim().slice(0, 200)
      : "";

  return {
    latitude: location.latitude,
    longitude: location.longitude,
    displayName: displayName || "Current location"
  };
}

export function readSessionDeliveryLocation() {
  if (typeof window === "undefined") return null;

  try {
    return normalizeLocation(
      JSON.parse(
        window.sessionStorage.getItem(DELIVERY_LOCATION_SESSION_KEY) ?? ""
      )
    );
  } catch {
    return null;
  }
}

export function persistSessionDeliveryLocation(
  location: SessionDeliveryLocation
) {
  const normalized = normalizeLocation(location);
  if (!normalized || typeof window === "undefined") return normalized;

  try {
    window.sessionStorage.setItem(
      DELIVERY_LOCATION_SESSION_KEY,
      JSON.stringify(normalized)
    );
  } catch {
    // Keep the in-memory location when session storage is unavailable.
  }

  return normalized;
}
