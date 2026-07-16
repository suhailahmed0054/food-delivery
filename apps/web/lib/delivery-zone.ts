export type Coordinates = {
  lat: number;
  lng: number;
};

export const RESTAURANT_BRANCH = {
  name: "Al-Arab Restaurant",
  plusCode: "7RV2+G99, Chikkaballapur Rd",
  latitude: 13.2937875,
  longitude: 77.800984375
} as const;

export const DELIVERY_RADIUS_KM = 5;

export const OUTSIDE_DELIVERY_MESSAGE =
  "We're sorry. You're not within our current delivery limits. We're working to reach your location soon.";

const EARTH_RADIUS_KM = 6371.0088;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceKm(
  origin: Coordinates,
  destination: Coordinates
) {
  const latitudeDelta = toRadians(destination.lat - origin.lat);
  const longitudeDelta = toRadians(destination.lng - origin.lng);
  const originLatitude = toRadians(origin.lat);
  const destinationLatitude = toRadians(destination.lat);

  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(originLatitude) *
      Math.cos(destinationLatitude) *
      Math.sin(longitudeDelta / 2) ** 2;

  return (
    2 *
    EARTH_RADIUS_KM *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function evaluateDeliveryLocation(coordinates: Coordinates) {
  const distanceKm = calculateDistanceKm(
    {
      lat: RESTAURANT_BRANCH.latitude,
      lng: RESTAURANT_BRANCH.longitude
    },
    coordinates
  );

  return {
    distanceKm,
    formattedDistance: `${distanceKm.toFixed(1)} km`,
    isWithinDeliveryZone: distanceKm <= DELIVERY_RADIUS_KM
  };
}
