export type DeliveryCoordinates = {
  lat: number;
  lng: number;
};

export const restaurantBranch = {
  plusCode: "7RV2+G99, Chikkaballapur Rd",
  latitude: 13.2937875,
  longitude: 77.800984375
} as const;

export const deliveryRadiusKm = 5;

export const outsideDeliveryMessage =
  "We're sorry. You're not within our current delivery limits. We're working to reach your location soon.";

const earthRadiusKm = 6371.0088;

function toRadians(value: number) {
  return (value * Math.PI) / 180;
}

export function calculateDeliveryDistanceKm(
  origin: DeliveryCoordinates,
  destination: DeliveryCoordinates
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
    earthRadiusKm *
    Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
  );
}

export function evaluateDeliveryZone(coordinates: DeliveryCoordinates) {
  const distanceKm = calculateDeliveryDistanceKm(
    {
      lat: restaurantBranch.latitude,
      lng: restaurantBranch.longitude
    },
    coordinates
  );

  return {
    distanceKm,
    isWithinDeliveryZone: distanceKm <= deliveryRadiusKm
  };
}
