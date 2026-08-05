"use client";

import {
  AlertTriangle,
  CheckCircle2,
  LocateFixed,
  LoaderCircle,
  MapPin,
  Search,
  X
} from "lucide-react";
import { fetchWithTimeout } from "@/lib/api";
import { useEffect, useRef, useState } from "react";

export type DeliveryLocationSearchResult = {
  id: string;
  name: string;
  subtitle: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  isWithinDeliveryZone: boolean;
};

type Props = {
  open: boolean;
  isLocating: boolean;
  onClose: () => void;
  onUseCurrentLocation: () => void;
  onSelect: (location: DeliveryLocationSearchResult) => void;
};

const quickSearches = ["Vijayapura", "Devanahalli", "Chikkaballapur Road"];

export function DeliveryLocationSearch({
  open,
  isLocating,
  onClose,
  onUseCurrentLocation,
  onSelect
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DeliveryLocationSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() =>
      inputRef.current?.focus()
    );
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    const trimmedQuery = query.trim();
    const searchTerm =
      trimmedQuery.length >= 2 ? trimmedQuery : "Vijayapura Karnataka";
    const controller = new AbortController();
    const timeout = window.setTimeout(
      async () => {
        setIsSearching(true);
        setSearchError("");
        try {
          const response = await fetchWithTimeout(
            `/api/location-search?q=${encodeURIComponent(searchTerm)}`,
            { signal: controller.signal },
            10_000
          );
          if (!response.ok) throw new Error("Search unavailable");
          const payload = (await response.json()) as {
            results?: DeliveryLocationSearchResult[];
          };
          setResults(Array.isArray(payload.results) ? payload.results : []);
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") {
            return;
          }
          setResults([]);
          setSearchError(
            "We couldn’t search locations right now. Try again shortly."
          );
        } finally {
          if (!controller.signal.aborted) setIsSearching(false);
        }
      },
      trimmedQuery.length >= 2 ? 450 : 0
    );

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [open, query]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[110]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delivery-location-search-title"
    >
      <button
        type="button"
        aria-label="Close location search"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/65 backdrop-blur-[2px]"
      />

      <section className="absolute inset-y-0 left-0 flex w-full flex-col border-r border-[#dfd1b5] bg-[#fffaf0] text-[#1d160d] shadow-2xl animate-in slide-in-from-left duration-300 sm:max-w-[470px]">
        <header className="flex items-start justify-between gap-4 border-b border-[#eadfca] px-5 py-5 sm:px-7">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Delivery location
            </p>
            <h2
              id="delivery-location-search-title"
              className="mt-1 font-heading text-2xl font-semibold"
            >
              Where should we deliver?
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close location search"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#e3d7c0] bg-white text-[#5d503b] transition hover:border-primary/50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={20} />
          </button>
        </header>

        <div className="border-b border-[#eadfca] px-5 py-5 sm:px-7">
          <label className="relative block">
            <Search
              size={19}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search for area, street or landmark"
              autoComplete="off"
              aria-label="Search delivery locations"
              className="min-h-14 w-full rounded-xl border border-[#d9ccb4] bg-white pl-12 pr-12 text-sm font-bold shadow-sm outline-none transition placeholder:font-semibold placeholder:text-[#9a8e79] focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear location search"
                className="absolute right-2 top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-lg bg-transparent text-[#7b6e59] shadow-none transition hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={17} />
              </button>
            )}
          </label>

          <button
            type="button"
            onClick={onUseCurrentLocation}
            disabled={isLocating}
            className="mt-3 flex min-h-14 w-full items-center gap-3 rounded-xl border border-primary/25 bg-primary/[0.07] px-4 text-left transition hover:bg-primary/12 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
              {isLocating ? (
                <LoaderCircle size={19} className="animate-spin" />
              ) : (
                <LocateFixed size={19} />
              )}
            </span>
            <span>
              <span className="block text-sm font-black text-primary">
                {isLocating ? "Finding your location..." : "Use current location"}
              </span>
              <span className="mt-0.5 block text-xs font-semibold text-[#776a55]">
                Improves GPS accuracy before saving
              </span>
            </span>
          </button>

          <div className="mt-4 flex flex-wrap gap-2">
            {quickSearches.map((place) => (
              <button
                key={place}
                type="button"
                onClick={() => setQuery(place)}
                className="rounded-full border border-[#dfd2bb] bg-white px-3 py-1.5 text-[11px] font-black text-[#675a45] transition hover:border-primary/40 hover:text-primary"
              >
                {place}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-7">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#81745f]">
              {query.trim().length >= 2
                ? "Nearest matching locations"
                : "Nearest location references"}
            </p>
            {isSearching && (
              <LoaderCircle size={16} className="animate-spin text-primary" />
            )}
          </div>

          {searchError && (
            <p
              role="alert"
              className="rounded-xl border border-red-300 bg-red-50 p-4 text-xs font-bold text-red-700"
            >
              {searchError}
            </p>
          )}

          {!searchError && !isSearching && results.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#dccfb7] p-7 text-center">
              <MapPin size={24} className="mx-auto text-primary" />
              <p className="mt-3 text-sm font-black">No matching location found</p>
              <p className="mt-1 text-xs font-semibold text-[#81745f]">
                Try an area, street or nearby landmark.
              </p>
            </div>
          )}

          <div className="divide-y divide-[#e7dcc7]">
            {results.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelect(result)}
                className="group flex w-full items-start gap-3 py-4 text-left transition hover:translate-x-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[#ded1b9] bg-white text-primary group-hover:border-primary/40">
                  <MapPin size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[#21190f]">
                    {result.name}
                  </span>
                  <span className="mt-1 block text-xs font-semibold leading-5 text-[#81745f]">
                    {result.subtitle || "Mapped location"}
                  </span>
                  <span
                    className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black ${
                      result.isWithinDeliveryZone
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-red-100 text-red-700"
                    }`}
                  >
                    {result.isWithinDeliveryZone ? (
                      <CheckCircle2 size={12} />
                    ) : (
                      <AlertTriangle size={12} />
                    )}
                    {result.distanceKm.toFixed(1)} km ·{" "}
                    {result.isWithinDeliveryZone
                      ? "Delivery available"
                      : "Outside delivery area"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </div>

        <footer className="border-t border-[#eadfca] px-5 py-3 text-center text-[10px] font-semibold text-[#8a7c66] sm:px-7">
          Location data © OpenStreetMap contributors · Search powered by Photon
        </footer>
      </section>
    </div>
  );
}
