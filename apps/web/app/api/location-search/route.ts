import { NextRequest, NextResponse } from "next/server";
import {
  RESTAURANT_BRANCH,
  evaluateDeliveryLocation
} from "@/lib/delivery-zone";

type PhotonFeature = {
  geometry?: {
    coordinates?: unknown[];
  };
  properties?: {
    osm_type?: string;
    osm_id?: number | string;
    name?: string;
    street?: string;
    district?: string;
    locality?: string;
    city?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

function cleanText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function uniqueParts(parts: string[]) {
  const seen = new Set<string>();
  return parts.filter((part) => {
    const key = part.toLocaleLowerCase();
    if (!part || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) {
    return NextResponse.json({ results: [] });
  }
  if (query.length > 100) {
    return NextResponse.json(
      { message: "Location search is too long" },
      { status: 400 }
    );
  }

  const search = new URLSearchParams({
    q: `${query}, Karnataka, India`,
    lat: String(RESTAURANT_BRANCH.latitude),
    lon: String(RESTAURANT_BRANCH.longitude),
    location_bias_scale: "0.8",
    limit: "8",
    lang: "en"
  });

  try {
    const response = await fetch(
      `https://photon.komoot.io/api/?${search.toString()}`,
      {
        headers: { Accept: "application/geo+json, application/json" },
        next: { revalidate: 3600 }
      }
    );
    if (!response.ok) {
      throw new Error(`Photon returned ${response.status}`);
    }

    const payload = (await response.json()) as {
      features?: PhotonFeature[];
    };
    const results = (payload.features ?? [])
      .map((feature, index) => {
        const coordinates = feature.geometry?.coordinates;
        const longitude = Number(coordinates?.[0]);
        const latitude = Number(coordinates?.[1]);
        if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
          return null;
        }

        const properties = feature.properties ?? {};
        const name =
          cleanText(properties.name) ||
          cleanText(properties.street) ||
          cleanText(properties.city) ||
          "Mapped location";
        const subtitle = uniqueParts([
          cleanText(properties.street),
          cleanText(properties.district),
          cleanText(properties.locality),
          cleanText(properties.city),
          cleanText(properties.county),
          cleanText(properties.state),
          cleanText(properties.postcode),
          cleanText(properties.country)
        ])
          .filter((part) => part.toLocaleLowerCase() !== name.toLocaleLowerCase())
          .join(", ");
        const zone = evaluateDeliveryLocation({ lat: latitude, lng: longitude });

        return {
          id: `${properties.osm_type ?? "place"}-${properties.osm_id ?? index}`,
          name,
          subtitle,
          latitude,
          longitude,
          distanceKm: zone.distanceKm,
          isWithinDeliveryZone: zone.isWithinDeliveryZone
        };
      })
      .filter((result): result is NonNullable<typeof result> => Boolean(result))
      .filter((result) => result.distanceKm <= 100)
      .sort((first, second) => first.distanceKm - second.distanceKm)
      .slice(0, 6);

    return NextResponse.json({ results });
  } catch (error) {
    console.error(
      "Location search failed:",
      error instanceof Error ? error.message : error
    );
    return NextResponse.json(
      { message: "Location search is temporarily unavailable" },
      { status: 503 }
    );
  }
}
