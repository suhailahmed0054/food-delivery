import { NextRequest, NextResponse } from "next/server";

function coordinate(value: string | null, minimum: number, maximum: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : null;
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function unique(parts: string[]) {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLocaleLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: NextRequest) {
  const latitude = coordinate(request.nextUrl.searchParams.get("lat"), -90, 90);
  const longitude = coordinate(request.nextUrl.searchParams.get("lng"), -180, 180);

  if (latitude === null || longitude === null) {
    return NextResponse.json({ message: "Valid coordinates are required" }, { status: 400 });
  }

  const params = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
    "accept-language": "en"
  });

  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${params.toString()}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "Al-Arab-Restaurant/1.0"
        },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000)
      }
    );
    if (!response.ok) throw new Error(`Nominatim returned ${response.status}`);

    const payload = (await response.json()) as {
      display_name?: string;
      address?: Record<string, unknown>;
    };
    const address = payload.address ?? {};
    const label = unique([
      clean(address.house_number),
      clean(address.road) || clean(address.pedestrian),
      clean(address.neighbourhood) || clean(address.suburb),
      clean(address.village) || clean(address.town) || clean(address.city),
      clean(address.state_district),
      clean(address.state),
      clean(address.postcode)
    ]).join(", ");

    return NextResponse.json({
      displayName: label || clean(payload.display_name) || "Current location"
    });
  } catch (error) {
    console.error(
      "Reverse geocoding failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { message: "Address lookup is temporarily unavailable" },
      { status: 503 }
    );
  }
}
