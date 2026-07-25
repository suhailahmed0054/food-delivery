"use client";

import {
  type FormEvent,
  type MouseEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronRight,
  CreditCard,
  Edit3,
  FileText,
  LockKeyhole,
  LogOut,
  MapPin,
  Plus,
  Shield,
  Trash2,
  UserCircle,
  WalletCards,
  X,
} from "lucide-react";

import {
  addCustomerAddress,
  claimCustomerOrders,
  deleteCustomerAddress,
  fetchCustomerAccount,
  logoutAccount,
  updateCustomerNotifications,
  updateCustomerProfile,
  type CustomerAddress,
  type CustomerNotificationPreferences,
} from "@/lib/api";
import { parseSavedOrders } from "@/lib/saved-orders";
import { useCustomer3DReveal } from "@/lib/use-customer-3d-reveal";

type ProfilePanel =
  | "edit"
  | "addresses"
  | "payments"
  | "notifications"
  | "security"
  | "signout"
  | null;

type CustomerProfile = {
  name: string;
  email: string;
  phone: string;
};

const ADDRESS_STORAGE_KEY = "al-arab-addresses";

const defaultProfile: CustomerProfile = {
  name: "",
  email: "",
  phone: "",
};

const panelTitles: Record<Exclude<ProfilePanel, null>, { eyebrow: string; title: string }> = {
  edit: { eyebrow: "Personal details", title: "Edit Profile" },
  addresses: { eyebrow: "Delivery", title: "Saved Addresses" },
  payments: { eyebrow: "Checkout", title: "Payment Methods" },
  notifications: { eyebrow: "Preferences", title: "Notifications" },
  security: { eyebrow: "Privacy", title: "Security Settings" },
  signout: { eyebrow: "Account", title: "Sign Out" },
};

const inputClassName =
  "mt-2 h-12 w-full rounded-xl border border-white/10 bg-black/35 px-4 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-primary/60 focus:ring-2 focus:ring-primary/20";

export default function ProfilePage() {
  const router = useRouter();
  const [activePanel, setActivePanel] = useState<ProfilePanel>(null);
  const [profile, setProfile] = useState<CustomerProfile>(defaultProfile);
  const [profileDraft, setProfileDraft] = useState<CustomerProfile>(defaultProfile);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [addressLabel, setAddressLabel] = useState("");
  const [addressText, setAddressText] = useState("");
  const [notifications, setNotifications] = useState<CustomerNotificationPreferences>({
    orderUpdates: true,
    offers: true,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  useCustomer3DReveal("profile");

  useEffect(() => {
    let cancelled = false;
    const loadAccount = async () => {
      try {
        let account = await fetchCustomerAccount();

        if (account.addresses.length === 0) {
          const storedAddresses = window.localStorage.getItem(ADDRESS_STORAGE_KEY);
          let legacyAddresses: Array<{ label?: unknown; address?: unknown }> = [];
          if (storedAddresses) {
            try {
              const parsed: unknown = JSON.parse(storedAddresses);
              if (Array.isArray(parsed)) legacyAddresses = parsed;
            } catch {
              window.localStorage.removeItem(ADDRESS_STORAGE_KEY);
            }
          }
          if (Array.isArray(legacyAddresses)) {
            for (const legacyAddress of legacyAddresses.slice(0, 10)) {
              if (
                typeof legacyAddress.label === "string" &&
                typeof legacyAddress.address === "string"
              ) {
                await addCustomerAddress({
                  label: legacyAddress.label,
                  address: legacyAddress.address,
                });
              }
            }
            if (legacyAddresses.length > 0) {
              window.localStorage.removeItem(ADDRESS_STORAGE_KEY);
              account = await fetchCustomerAccount();
            }
          }
        }

        const localOrders = parseSavedOrders(
          window.localStorage.getItem("al-arab-orders"),
        );
        const claimable = localOrders.flatMap((order) =>
          order.trackingToken
            ? [{ orderNumber: order.id, trackingToken: order.trackingToken }]
            : [],
        );
        if (claimable.length > 0) {
          await claimCustomerOrders(claimable).catch(() => undefined);
        }

        if (cancelled) return;
        const nextProfile = {
          name: account.name,
          email: account.email,
          phone: account.phone,
        };
        setProfile(nextProfile);
        setProfileDraft(nextProfile);
        setAddresses(account.addresses);
        setNotifications(account.notificationPreferences);
        window.localStorage.setItem(
          "al-arab-user",
          JSON.stringify({
            id: account.id,
            name: account.name,
            email: account.email,
            role: "customer",
          }),
        );
      } catch (error) {
        if (!cancelled) {
          setLoadError(
            error instanceof Error ? error.message : "Unable to load your account",
          );
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadAccount();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!statusMessage) return;

    const timeout = window.setTimeout(() => setStatusMessage(null), 2200);
    return () => window.clearTimeout(timeout);
  }, [statusMessage]);

  useEffect(() => {
    if (!activePanel) return;

    const previousOverflow = document.body.style.overflow;
    const focusFrame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>("button, input, textarea, a[href]")?.focus();
    });

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActivePanel(null);
        return;
      }

      if (event.key !== "Tab" || !panelRef.current) return;

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          "a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled])",
        ),
      );
      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (!firstElement || !lastElement) return;

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      lastTriggerRef.current?.focus();
    };
  }, [activePanel]);

  const openPanel = (panel: Exclude<ProfilePanel, null>, event: MouseEvent<HTMLElement>) => {
    lastTriggerRef.current = event.currentTarget;

    if (panel === "edit") {
      setProfileDraft(profile);
    }

    setActivePanel(panel);
  };

  const closePanel = () => setActivePanel(null);

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextProfile = {
      name: profileDraft.name.trim(),
      email: profileDraft.email.trim(),
      phone: profileDraft.phone.trim(),
    };

    if (!nextProfile.name || !nextProfile.email || !nextProfile.phone) return;

    setIsSaving(true);
    try {
      const account = await updateCustomerProfile(nextProfile);
      const savedProfile = {
        name: account.name,
        email: account.email,
        phone: account.phone,
      };
      setProfile(savedProfile);
      setProfileDraft(savedProfile);
      window.localStorage.setItem(
        "al-arab-user",
        JSON.stringify({
          id: account.id,
          name: account.name,
          email: account.email,
          role: "customer",
        }),
      );
      setStatusMessage("Profile updated");
      closePanel();
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to update profile");
    } finally {
      setIsSaving(false);
    }
  };

  const addAddress = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!addressLabel.trim() || !addressText.trim()) return;

    setIsSaving(true);
    try {
      const address = await addCustomerAddress({
        label: addressLabel.trim(),
        address: addressText.trim(),
      });
      setAddresses((current) => [...current, address]);
      setAddressLabel("");
      setAddressText("");
      setStatusMessage("Address saved to your account");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to save address");
    } finally {
      setIsSaving(false);
    }
  };

  const removeAddress = async (id: string) => {
    setIsSaving(true);
    try {
      await deleteCustomerAddress(id);
      setAddresses((current) => {
        const next = current.filter((address) => address.id !== id);
        if (next.length > 0 && !next.some((address) => address.isDefault)) {
          return next.map((address, index) => ({
            ...address,
            isDefault: index === 0,
          }));
        }
        return next;
      });
      setStatusMessage("Address removed");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to remove address");
    } finally {
      setIsSaving(false);
    }
  };

  const updateNotification = async (key: keyof CustomerNotificationPreferences) => {
    const nextNotifications = {
      ...notifications,
      [key]: !notifications[key],
    };

    setIsSaving(true);
    try {
      const saved = await updateCustomerNotifications(nextNotifications);
      setNotifications(saved);
      setStatusMessage("Notification preferences updated");
    } catch (error) {
      setStatusMessage(error instanceof Error ? error.message : "Unable to update preferences");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogout = async () => {
    await logoutAccount().catch(() => undefined);
    ["al-arab-auth", "al-arab-user", "auth-token"].forEach((key) => {
      window.localStorage.removeItem(key);
    });
    router.replace("/login");
  };

  const openMenu = () => {
    closePanel();
    router.push("/mobile");
  };

  const openPrivacy = () => {
    closePanel();
    router.push("/privacy");
  };

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] text-white">
        <div role="status" className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-white/15 border-t-primary" />
          <p className="mt-4 text-sm font-bold text-white/60">Loading your account…</p>
        </div>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#080808] p-5 text-white">
        <section
          className="mx-auto box-border min-w-0 rounded-3xl border border-white/10 bg-[#111111] p-6 text-center sm:p-7"
          style={{ width: "min(calc(100vw - 2rem), 28rem)" }}
        >
          <UserCircle size={48} className="mx-auto text-primary" aria-hidden="true" />
          <h1 className="mx-auto mt-4 max-w-[12ch] font-heading text-2xl font-semibold leading-none sm:text-3xl">
            Sign in to your account
          </h1>
          <p className="mx-auto mt-2 max-w-[30ch] text-sm leading-relaxed text-white/55">
            Your profile, addresses and orders are securely saved to your Al-Arab account.
          </p>
          <button
            type="button"
            onClick={() => router.replace("/login")}
            className="mt-6 min-h-12 w-full max-w-full rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground"
          >
            Continue to sign in
          </button>
          <button
            type="button"
            onClick={() => router.push("/mobile")}
            className="mt-3 min-h-12 w-full max-w-full rounded-xl border border-white/10 bg-white/5 px-5 py-3 font-bold"
          >
            Continue as guest
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="customer-3d-page min-h-screen overflow-x-clip bg-[#080808] text-white">
      <div className="customer-ambient customer-ambient--one" aria-hidden="true" />
      <div className="customer-ambient customer-ambient--two" aria-hidden="true" />

      <header className="customer-3d-header sticky top-0 z-40 border-b border-white/10 bg-black/90 px-4 py-4 backdrop-blur">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/mobile")}
            aria-label="Back to menu"
            className="customer-icon-button flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          >
            <ArrowLeft size={20} aria-hidden="true" />
          </button>
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.24em] text-primary">Personal space</p>
            <h1 className="font-heading text-2xl font-semibold">My Profile</h1>
          </div>
        </div>
      </header>

      <div className="relative z-10 mx-auto max-w-2xl space-y-6 p-4 pb-32">
        <div data-customer-reveal className="customer-profile-card customer-reveal relative overflow-hidden rounded-3xl border border-white/10 bg-[#111111] p-4 shadow-lg sm:p-6">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-yellow-500/10 blur-3xl" />

          <div className="relative z-10 flex items-center gap-4 sm:gap-5">
            <div className="customer-avatar relative shrink-0">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-yellow-500/50 bg-yellow-500/20 sm:h-20 sm:w-20">
                <UserCircle size={42} className="text-yellow-500 sm:h-12 sm:w-12" aria-hidden="true" />
              </div>
              <button
                type="button"
                aria-label="Edit profile"
                onClick={(event) => openPanel("edit", event)}
                className="customer-avatar-edit absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-[#111111] bg-yellow-500 text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <Edit3 size={12} aria-hidden="true" />
              </button>
            </div>

            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-black text-white sm:text-2xl">{profile.name}</h2>
              <p className="mt-1 break-all text-xs text-white/50 sm:text-sm">{profile.email}</p>
              <p className="mt-0.5 text-xs font-semibold text-yellow-500 sm:text-sm">{profile.phone}</p>
              <button
                type="button"
                onClick={(event) => openPanel("edit", event)}
                className="mt-3 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary transition hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                Edit profile
              </button>
            </div>
          </div>
        </div>

        <section data-customer-reveal className="customer-reveal">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">
            Account Settings
          </h3>
          <div className="customer-settings-card overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
            <button
              type="button"
              onClick={(event) => openPanel("addresses", event)}
              className="customer-setting-row flex min-h-14 w-full items-center justify-between border-b border-white/5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
            >
              <span className="flex items-center gap-3">
                <MapPin size={20} className="text-white/70" aria-hidden="true" />
                <span className="font-semibold">Saved Addresses</span>
              </span>
              <ChevronRight size={18} className="text-white/30" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={(event) => openPanel("payments", event)}
              className="customer-setting-row flex min-h-14 w-full items-center justify-between border-b border-white/5 p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
            >
              <span className="flex items-center gap-3">
                <CreditCard size={20} className="text-white/70" aria-hidden="true" />
                <span className="font-semibold">Payment Methods</span>
              </span>
              <ChevronRight size={18} className="text-white/30" aria-hidden="true" />
            </button>

            <button
              type="button"
              onClick={(event) => openPanel("notifications", event)}
              className="customer-setting-row flex min-h-14 w-full items-center justify-between p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
            >
              <span className="flex items-center gap-3">
                <Bell size={20} className="text-white/70" aria-hidden="true" />
                <span className="font-semibold">Notifications</span>
              </span>
              <ChevronRight size={18} className="text-white/30" aria-hidden="true" />
            </button>
          </div>
        </section>

        <section data-customer-reveal className="customer-reveal">
          <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-white/40">
            Privacy
          </h3>
          <div className="customer-settings-card overflow-hidden rounded-2xl border border-white/10 bg-[#111111]">
            <button
              type="button"
              onClick={(event) => openPanel("security", event)}
              className="customer-setting-row flex min-h-14 w-full items-center justify-between p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
            >
              <span className="flex items-center gap-3">
                <Shield size={20} className="text-white/70" aria-hidden="true" />
                <span className="font-semibold">Security Settings</span>
              </span>
              <ChevronRight size={18} className="text-white/30" aria-hidden="true" />
            </button>
          </div>
        </section>

        <button
          type="button"
          data-customer-reveal
          onClick={(event) => openPanel("signout", event)}
          className="customer-danger-button customer-reveal flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 py-4 font-bold text-red-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
        >
          <LogOut size={20} aria-hidden="true" />
          Sign Out
        </button>
      </div>

      {activePanel && (
        <div className="fixed inset-0 z-[250] flex items-end justify-center bg-black/75 backdrop-blur-sm sm:items-center sm:p-6">
          <button
            type="button"
            tabIndex={-1}
            aria-label="Close profile settings"
            className="absolute inset-0 cursor-default"
            onClick={closePanel}
          />
          <section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="profile-panel-title"
            className="relative flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-t-[30px] border border-white/10 bg-[#0d120f] shadow-[0_-24px_70px_rgba(0,0,0,0.65)] sm:rounded-[30px]"
          >
            <header className="flex shrink-0 items-center justify-between border-b border-white/10 px-5 py-4">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.22em] text-primary">
                  {panelTitles[activePanel].eyebrow}
                </p>
                <h2 id="profile-panel-title" className="mt-1 text-2xl font-semibold text-[#fff7df]">
                  {panelTitles[activePanel].title}
                </h2>
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close"
                className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </header>

            <div className="overflow-y-auto px-3 py-4 sm:px-5 sm:py-5">
              {activePanel === "edit" && (
                <form onSubmit={saveProfile} className="space-y-4">
                  <label className="block text-xs font-bold text-white/65">
                    Full name
                    <input
                      required
                      value={profileDraft.name}
                      onChange={(event) => setProfileDraft({ ...profileDraft, name: event.target.value })}
                      className={inputClassName}
                    />
                  </label>
                  <label className="block text-xs font-bold text-white/65">
                    Email address
                    <input
                      required
                      type="email"
                      value={profileDraft.email}
                      onChange={(event) => setProfileDraft({ ...profileDraft, email: event.target.value })}
                      className={inputClassName}
                    />
                  </label>
                  <label className="block text-xs font-bold text-white/65">
                    Phone number
                    <input
                      required
                      type="tel"
                      value={profileDraft.phone}
                      onChange={(event) => setProfileDraft({ ...profileDraft, phone: event.target.value })}
                      className={inputClassName}
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground transition hover:brightness-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d120f]"
                  >
                    <Check size={18} aria-hidden="true" />
                    {isSaving ? "Saving…" : "Save profile"}
                  </button>
                </form>
              )}

              {activePanel === "addresses" && (
                <div className="space-y-5">
                  <div className="space-y-3">
                    {addresses.length === 0 && (
                      <p className="rounded-2xl border border-dashed border-white/15 p-5 text-center text-sm text-white/45">
                        No saved addresses yet.
                      </p>
                    )}
                    {addresses.map((address) => (
                      <article key={address.id} className="flex gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <MapPin size={18} aria-hidden="true" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-black text-white">
                            {address.label}
                            {address.isDefault && (
                              <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] uppercase tracking-wider text-primary">
                                Default
                              </span>
                            )}
                          </h3>
                          <p className="mt-1 text-xs leading-relaxed text-white/50">{address.address}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAddress(address.id)}
                          disabled={isSaving}
                          aria-label={`Remove ${address.label} address`}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-red-400 transition hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/60"
                        >
                          <Trash2 size={17} aria-hidden="true" />
                        </button>
                      </article>
                    ))}
                  </div>

                  <form onSubmit={addAddress} className="space-y-3 border-t border-white/10 pt-5">
                    <h3 className="font-heading text-xl font-semibold text-[#fff7df]">Add a new address</h3>
                    <label className="block text-xs font-bold text-white/65">
                      Label
                      <input
                        required
                        value={addressLabel}
                        onChange={(event) => setAddressLabel(event.target.value)}
                        placeholder="Home, Office..."
                        className={inputClassName}
                      />
                    </label>
                    <label className="block text-xs font-bold text-white/65">
                      Full address
                      <textarea
                        required
                        value={addressText}
                        onChange={(event) => setAddressText(event.target.value)}
                        placeholder="Street, area, city and PIN code"
                        className={`${inputClassName} h-24 resize-none py-3`}
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                    >
                      <Plus size={18} aria-hidden="true" />
                      {isSaving ? "Saving…" : "Save address"}
                    </button>
                  </form>
                </div>
              )}

              {activePanel === "payments" && (
                <div className="space-y-4">
                  <div className="rounded-2xl border border-primary/25 bg-primary/10 p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                        <WalletCards size={20} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="font-black text-white">Choose at checkout</h3>
                        <p className="mt-1 text-xs text-white/55">UPI, card, or cash on delivery.</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed text-white/55">
                    For your security, payment details are entered only during checkout and are not stored on this device.
                  </p>
                  <button
                    type="button"
                    onClick={openMenu}
                    className="min-h-12 w-full rounded-xl bg-primary px-5 py-3 font-black text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                  >
                    Start an order
                  </button>
                </div>
              )}

              {activePanel === "notifications" && (
                <div className="space-y-3">
                  {[
                    {
                      key: "orderUpdates" as const,
                      title: "Order updates",
                      description: "Preparation, dispatch and delivery alerts.",
                    },
                    {
                      key: "offers" as const,
                      title: "Offers and rewards",
                      description: "Occasional discounts and menu announcements.",
                    },
                  ].map((preference) => (
                    <div key={preference.key} className="flex items-center gap-2.5 rounded-2xl border border-white/10 bg-white/[0.04] p-3 sm:gap-4 sm:p-4">
                      <div className="min-w-0 flex-1 pr-1">
                        <h3 className="text-sm font-black leading-tight text-white">{preference.title}</h3>
                        <p className="mt-1 text-[10px] leading-relaxed text-white/50 sm:text-xs">{preference.description}</p>
                      </div>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={notifications[preference.key]}
                        aria-label={preference.title}
                        onClick={() => updateNotification(preference.key)}
                        disabled={isSaving}
                        className="flex h-11 w-12 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
                      >
                        <span className={`relative h-7 w-12 rounded-full transition-colors ${
                          notifications[preference.key] ? "bg-primary" : "bg-white/15"
                        }`}>
                          <span
                            className={`absolute left-1 top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                              notifications[preference.key] ? "translate-x-5" : "translate-x-0"
                            }`}
                          />
                        </span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {activePanel === "security" && (
                <div className="space-y-3">
                  <div className="space-y-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <LockKeyhole size={18} aria-hidden="true" />
                      </span>
                      <div>
                        <h3 className="font-black text-white">Passwordless sign in</h3>
                        <p className="mt-1 text-xs leading-relaxed text-white/50">
                          Your account is protected with a one-time code sent to your verified email address.
                        </p>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={openPrivacy}
                    className="flex min-h-16 w-full items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-left transition hover:border-primary/30 hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FileText size={18} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-black text-white">Privacy policy</span>
                      <span className="mt-1 block text-xs text-white/50">Review how your information is handled.</span>
                    </span>
                    <ChevronRight size={18} className="text-white/30" aria-hidden="true" />
                  </button>
                </div>
              )}

              {activePanel === "signout" && (
                <div className="space-y-5 text-center">
                  <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-red-500/25 bg-red-500/10 text-red-400">
                    <LogOut size={27} aria-hidden="true" />
                  </span>
                  <div>
                    <h3 className="font-heading text-2xl font-semibold text-[#fff7df]">Leave your account?</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/50">
                      Your account data stays saved securely and will be here when you sign in again.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={closePanel}
                      className="min-h-12 rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isSaving}
                      className="min-h-12 rounded-xl border border-red-500/30 bg-red-500/15 px-4 py-3 font-bold text-red-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400/70"
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-28 left-1/2 z-[300] flex -translate-x-1/2 items-center gap-2 rounded-full border border-primary/25 bg-[#111811] px-4 py-2.5 text-xs font-black text-[#fff7df] shadow-2xl"
        >
          <Check size={15} className="text-primary" aria-hidden="true" />
          {statusMessage}
        </div>
      )}

    </main>
  );
}
