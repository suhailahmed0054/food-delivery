"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import {
  Bell,
  BellRing,
  CheckCheck,
  CircleAlert,
  CreditCard,
  Headphones,
  PackageCheck,
  Truck,
  X
} from "lucide-react";
import {
  fetchNotifications,
  getApiSocketUrl,
  markAllNotificationsRead,
  markNotificationRead,
  type InAppNotification
} from "@/lib/api";

type NotificationCenterProps = {
  scope: "admin" | "customer";
  enabled?: boolean;
  className?: string;
  onNavigate?: (href: string) => boolean;
};

const notificationIcons = {
  order: PackageCheck,
  payment: CreditCard,
  delivery: Truck,
  support: Headphones,
  system: CircleAlert
};

function relativeTime(value?: string) {
  if (!value) return "Just now";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "Just now";
  const elapsedSeconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (elapsedSeconds < 60) return "Just now";
  const minutes = Math.floor(elapsedSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short"
  });
}

function showBrowserNotification(notification: InAppNotification) {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    window.Notification.permission !== "granted" ||
    document.visibilityState === "visible"
  ) {
    return;
  }

  const browserNotification = new window.Notification(notification.title, {
    body: notification.message,
    icon: "/images/logo-watermark.png",
    tag: notification.id
  });
  browserNotification.onclick = () => {
    window.focus();
    if (notification.href) window.location.assign(notification.href);
    browserNotification.close();
  };
}

export function NotificationCenter({
  scope,
  enabled = true,
  className = "",
  onNavigate
}: NotificationCenterProps) {
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);
  const triggerButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<InAppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission | "unsupported">("default");

  const loadNotifications = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError("");
    try {
      const feed = await fetchNotifications(scope);
      setNotifications(feed.notifications);
      setUnreadCount(feed.unreadCount);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Unable to load notifications");
    } finally {
      setIsLoading(false);
    }
  }, [enabled, scope]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBrowserPermission(
      "Notification" in window ? window.Notification.permission : "unsupported"
    );
  }, []);

  useEffect(() => {
    if (!enabled) {
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    void loadNotifications();
    const socketUrl = getApiSocketUrl();
    if (!socketUrl) return;

    const socket = io(socketUrl, {
      withCredentials: true,
      transports: ["websocket", "polling"]
    });
    socketRef.current = socket;
    socket.on("notification:new", (notification: InAppNotification) => {
      setNotifications((current) => [
        notification,
        ...current.filter((item) => item.id !== notification.id)
      ].slice(0, 100));
      setUnreadCount((count) => count + (notification.readAt ? 0 : 1));
      showBrowserNotification(notification);
    });
    socket.on("connect_error", () => {
      // Polling below keeps the feed current when a socket is temporarily unavailable.
    });

    const poller = window.setInterval(() => void loadNotifications(), 30_000);
    const refreshOnFocus = () => void loadNotifications();
    window.addEventListener("focus", refreshOnFocus);
    return () => {
      window.clearInterval(poller);
      window.removeEventListener("focus", refreshOnFocus);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [enabled, loadNotifications]);

  useEffect(() => {
    if (!open) return;
    const triggerButton = triggerButtonRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);
    const handleDialogKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;
      const focusableElements = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      if (!focusableElements?.length) return;

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];
      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    window.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleDialogKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      triggerButton?.focus({ preventScroll: true });
    };
  }, [open]);

  const openNotification = async (notification: InAppNotification) => {
    if (!notification.readAt) {
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => item.id === notification.id ? { ...item, readAt } : item)
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      try {
        await markNotificationRead(notification.id, scope);
      } catch {
        void loadNotifications();
      }
    }
    setOpen(false);
    if (notification.href && !onNavigate?.(notification.href)) {
      router.push(notification.href);
    }
  };

  const markAllRead = async () => {
    if (unreadCount === 0) return;
    const readAt = new Date().toISOString();
    setNotifications((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? readAt })));
    setUnreadCount(0);
    try {
      await markAllNotificationsRead(scope);
    } catch {
      void loadNotifications();
    }
  };

  const enableBrowserAlerts = async () => {
    if (!("Notification" in window)) {
      setBrowserPermission("unsupported");
      return;
    }
    const permission = await window.Notification.requestPermission();
    setBrowserPermission(permission);
  };

  if (!enabled) return null;

  return (
    <>
      <button
        ref={triggerButtonRef}
        type="button"
        onClick={() => {
          setOpen(true);
          void loadNotifications();
        }}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={`${scope}-notifications-dialog`}
        className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/80 transition hover:border-primary/40 hover:bg-primary/10 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 active:scale-95 ${className}`}
      >
        {unreadCount > 0 ? <BellRing size={19} /> : <Bell size={19} />}
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#D84315] px-1 text-[9px] font-black text-white shadow-lg">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-end justify-center px-[max(0.5rem,env(safe-area-inset-left))] pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-[calc(0.5rem+env(safe-area-inset-top))] sm:items-start sm:justify-end sm:p-5">
          <button
            type="button"
            aria-label="Close notifications"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <section
            ref={dialogRef}
            id={`${scope}-notifications-dialog`}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${scope}-notifications-title`}
            className="relative isolate flex max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-1rem)] w-full flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#111111] text-white shadow-2xl sm:max-h-[calc(100dvh-2.5rem)] sm:max-w-md sm:rounded-2xl"
          >
            <header className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Live updates</p>
                <h2 id={`${scope}-notifications-title`} className="mt-1 text-xl font-black">Notifications</h2>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={() => void markAllRead()}
                    title="Mark all as read"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/65 transition hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                  >
                    <CheckCheck size={18} />
                  </button>
                )}
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Close notifications"
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/65 transition hover:bg-white/10 hover:text-white"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            {browserPermission === "default" && (
              <div className="flex items-center justify-between gap-3 border-b border-white/10 bg-primary/10 px-5 py-3">
                <p className="text-xs font-semibold text-white/75">Get updates when this tab is in the background.</p>
                <button
                  type="button"
                  onClick={() => void enableBrowserAlerts()}
                  className="shrink-0 rounded-lg bg-primary px-3 py-2 text-[10px] font-black uppercase text-primary-foreground transition hover:brightness-110"
                >
                  Enable alerts
                </button>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pb-3 sm:pb-0">
              {isLoading && notifications.length === 0 && (
                <div className="space-y-3 p-5" aria-label="Loading notifications">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="h-24 animate-pulse rounded-xl bg-white/5" />
                  ))}
                </div>
              )}
              {!isLoading && error && notifications.length === 0 && (
                <div className="p-8 text-center">
                  <CircleAlert className="mx-auto text-red-400" size={28} />
                  <p className="mt-3 text-sm font-bold">Notifications unavailable</p>
                  <p className="mt-1 text-xs text-white/50">{error}</p>
                  <button type="button" onClick={() => void loadNotifications()} className="mt-4 rounded-lg border border-white/15 px-4 py-2 text-xs font-bold hover:bg-white/10">Try again</button>
                </div>
              )}
              {!isLoading && !error && notifications.length === 0 && (
                <div className="p-10 text-center">
                  <Bell className="mx-auto text-white/20" size={34} />
                  <p className="mt-3 text-sm font-bold">You are all caught up</p>
                  <p className="mt-1 text-xs text-white/45">New activity will appear here instantly.</p>
                </div>
              )}
              {notifications.map((notification) => {
                const Icon = notificationIcons[notification.type] ?? CircleAlert;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    data-notification-unread={notification.readAt ? "false" : "true"}
                    onClick={() => void openNotification(notification)}
                    className={`flex w-full gap-3 border-b border-white/[0.07] px-5 py-4 text-left transition hover:bg-white/[0.05] ${notification.readAt ? "bg-transparent" : "bg-[#FFF7F2]"}`}
                  >
                    <span className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${notification.readAt ? "border-white/10 bg-white/5 text-white/50" : "border-[#D84315]/20 bg-[#D84315]/[0.06] text-[#6D574D]"}`}>
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-start justify-between gap-3">
                        <span className={`text-sm font-black leading-snug ${notification.readAt ? "" : "text-[#3E2723]"}`}>{notification.title}</span>
                        {!notification.readAt && <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#D84315]" />}
                      </span>
                      <span className={`mt-1 line-clamp-2 text-xs leading-5 ${notification.readAt ? "text-white/55" : "text-[#6D574D]"}`}>{notification.message}</span>
                      <span className={`mt-2 block text-[10px] font-bold uppercase tracking-wide ${notification.readAt ? "text-white/35" : "text-[#6D574D]"}`}>{relativeTime(notification.createdAt)}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>,
        document.body
      )}
    </>
  );
}
