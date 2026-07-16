const DEFAULT_TIMEOUT_MS = 15000;
const TARGET_ACCURACY_METERS = 40;

type PreciseLocationOptions = {
  timeoutMs?: number;
  targetAccuracyMeters?: number;
};

export function getPreciseCurrentPosition({
  timeoutMs = DEFAULT_TIMEOUT_MS,
  targetAccuracyMeters = TARGET_ACCURACY_METERS
}: PreciseLocationOptions = {}) {
  return new Promise<GeolocationPosition>((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Geolocation is not supported"));
      return;
    }

    let bestPosition: GeolocationPosition | null = null;
    let watchId: number | null = null;
    let timeoutId: number | null = null;
    let finished = false;

    const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timeoutId !== null) window.clearTimeout(timeoutId);
    };

    const finish = (position: GeolocationPosition) => {
      if (finished) return;
      finished = true;
      cleanup();
      resolve(position);
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (
          !bestPosition ||
          position.coords.accuracy < bestPosition.coords.accuracy
        ) {
          bestPosition = position;
        }

        if (position.coords.accuracy <= targetAccuracyMeters) {
          finish(position);
        }
      },
      (error) => {
        if (finished) return;
        if (error.code === error.PERMISSION_DENIED || !bestPosition) {
          finished = true;
          cleanup();
          reject(error);
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs
      }
    );

    timeoutId = window.setTimeout(() => {
      if (bestPosition) {
        finish(bestPosition);
        return;
      }

      finished = true;
      cleanup();
      reject(new Error("Unable to determine the current location"));
    }, timeoutMs);
  });
}
