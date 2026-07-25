"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Mic, Search, Star, X } from "lucide-react";
import type { MenuItem } from "@/lib/data";

type VoiceSearchResultEvent = {
  results: {
    [index: number]: {
      [index: number]: { transcript: string };
    };
  };
};

type VoiceSearchRecognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  onresult: ((event: VoiceSearchResultEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

type VoiceSearchRecognitionConstructor = new () => VoiceSearchRecognition;

declare global {
  interface Window {
    SpeechRecognition?: VoiceSearchRecognitionConstructor;
    webkitSpeechRecognition?: VoiceSearchRecognitionConstructor;
  }
}

type MenuSearchOverlayProps = {
  searchTerm: string;
  results: MenuItem[];
  popularItems: MenuItem[];
  onSearchTermChange: (value: string) => void;
  onClose: () => void;
  onSelect: (item: MenuItem) => void;
};

const popularSearches = ["Mandi", "Grill", "Shawarma", "Desserts", "Beverages"];

export function MenuSearchOverlay({
  searchTerm,
  results,
  popularItems,
  onSearchTermChange,
  onClose,
  onSelect
}: MenuSearchOverlayProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState("");

  useEffect(() => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const startVoiceSearch = () => {
    setVoiceError("");
    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      setVoiceError("Voice search is not supported by this browser.");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript?.trim();
      if (transcript) onSearchTermChange(transcript);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setVoiceError("I couldn't hear that. Please try again.");
    };
    recognition.onend = () => setIsListening(false);
    setIsListening(true);
    recognition.start();
  };

  const displayedItems = searchTerm.trim() ? results : popularItems;

  return (
    <section
      role="dialog"
      aria-modal="true"
      aria-labelledby="menu-search-title"
      className="fixed inset-0 z-[90] flex w-full max-w-[100vw] flex-col overflow-x-hidden bg-background text-foreground animate-in fade-in slide-in-from-right-4 duration-200"
    >
      <header className="shrink-0 border-b border-border bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto grid h-16 w-full max-w-3xl grid-cols-[44px_1fr_44px] items-center px-3 sm:px-5">
          <button
            type="button"
            aria-label="Back to menu"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-full text-foreground transition hover:bg-muted active:scale-95"
          >
            <ArrowLeft size={24} aria-hidden="true" />
          </button>
          <h2 id="menu-search-title" className="truncate text-center text-[15px] font-black sm:text-lg">
            Search for dishes
          </h2>
          <span aria-hidden="true" />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-3xl px-3 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-4 min-[390px]:px-4 sm:px-6 sm:pt-6">
          <div className="relative">
            <Search
              size={21}
              className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground"
            />
            <input
              ref={inputRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              aria-label="Search for dishes"
              autoComplete="off"
              value={searchTerm}
              onChange={(event) => onSearchTermChange(event.target.value)}
              placeholder="Search dishes or ingredients"
              className={`h-14 w-full appearance-none rounded-2xl border border-border bg-card pl-11 text-[clamp(0.8rem,3.8vw,1rem)] font-bold text-foreground shadow-sm outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15 [&::-webkit-search-cancel-button]:hidden ${searchTerm ? "pr-[6.25rem]" : "pr-[3.75rem]"}`}
            />
            <div className="absolute right-1.5 top-1/2 flex -translate-y-1/2 items-center">
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    onSearchTermChange("");
                    inputRef.current?.focus();
                  }}
                  className="flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition hover:bg-muted hover:text-foreground"
                >
                  <X size={21} aria-hidden="true" />
                </button>
              )}
              {searchTerm && <span className="h-7 w-px bg-border" aria-hidden="true" />}
              <button
                type="button"
                aria-label={isListening ? "Listening for dish name" : "Search by voice"}
                aria-pressed={isListening}
                onClick={startVoiceSearch}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition active:scale-95 ${
                  isListening
                    ? "animate-pulse bg-[#D84315]/10 text-[#D84315]"
                    : "text-[#D84315] hover:bg-[#D84315]/10"
                }`}
              >
                <Mic size={22} aria-hidden="true" />
              </button>
            </div>
          </div>

          {voiceError && (
            <p role="alert" className="mt-2 px-1 text-xs font-semibold text-[#D84315]">
              {voiceError}
            </p>
          )}

          {!searchTerm.trim() && (
            <div className="mt-6">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Popular searches
              </p>
              <div className="-mx-3 mt-3 flex snap-x snap-proximity gap-2 overflow-x-auto overscroll-x-contain px-3 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] min-[390px]:-mx-4 min-[390px]:px-4 [&::-webkit-scrollbar]:hidden">
                {popularSearches.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => {
                      onSearchTermChange(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="min-h-11 shrink-0 snap-start rounded-full border border-border bg-card px-4 py-2.5 text-xs font-black text-foreground transition hover:border-primary/30 hover:bg-muted"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-7 flex items-center gap-3">
            <h3 className="min-w-0 truncate text-[11px] font-black uppercase tracking-[0.14em] text-muted-foreground min-[390px]:tracking-[0.18em]">
              {searchTerm.trim()
                ? `Dishes relevant for '${searchTerm.trim()}'`
                : "Popular dishes"}
            </h3>
            <span className="h-px flex-1 bg-border" />
          </div>

          <div className="mt-4 divide-y divide-border">
            {displayedItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className="group grid w-full min-w-0 grid-cols-[72px_minmax(0,1fr)_40px] items-center gap-3 py-4 text-left transition active:scale-[0.99] min-[390px]:grid-cols-[76px_minmax(0,1fr)_40px] sm:grid-cols-[96px_minmax(0,1fr)_44px] sm:gap-4"
              >
                <span className="relative h-[72px] w-[72px] overflow-hidden rounded-2xl border border-border bg-muted min-[390px]:h-[76px] min-[390px]:w-[76px] sm:h-24 sm:w-24">
                  <Image
                    src={item.image || "/images/placeholder.jpg"}
                    alt=""
                    fill
                    sizes="96px"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 block text-[14px] font-black leading-tight min-[390px]:text-[15px] sm:text-lg">{item.name}</span>
                  <span className="mt-1 block truncate text-xs font-semibold text-muted-foreground sm:text-sm">
                    {item.category} · {item.available ? `₹${item.price}` : "Out of stock"}
                  </span>
                  <span className="mt-1.5 flex min-w-0 items-center gap-1 text-[10px] font-bold text-muted-foreground min-[390px]:text-[11px]">
                    <Star
                      size={12}
                      className={item.reviews > 0 ? "fill-[#D84315] text-[#D84315]" : "text-muted-foreground"}
                    />
                    <span className="truncate">
                      {item.reviews > 0 ? `${item.rating} · ${item.reviews} reviews` : "New dish"}
                    </span>
                  </span>
                </span>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition group-hover:border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Search size={18} aria-hidden="true" />
                </span>
              </button>
            ))}
          </div>

          {searchTerm.trim() && results.length === 0 && (
            <div className="py-16 text-center">
              <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Search size={24} aria-hidden="true" />
              </span>
              <p className="mt-4 text-base font-black">No matching dishes</p>
              <p className="mt-1 text-sm text-muted-foreground">Try mandi, grill, shawarma, or dessert.</p>
              <button
                type="button"
                onClick={() => {
                  onSearchTermChange("");
                  inputRef.current?.focus();
                }}
                className="mt-5 rounded-xl bg-primary px-5 py-3 text-xs font-black text-primary-foreground"
              >
                Clear search
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
