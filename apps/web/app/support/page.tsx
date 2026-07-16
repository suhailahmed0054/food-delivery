"use client";

import Link from "next/link";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageCircle,
  PhoneCall,
  HeadphonesIcon,
  AlertTriangle,
  CheckCircle2,
  Info,
  ShieldCheck,
  Camera,
  X
} from "lucide-react";
import {
  fetchCustomerIssues,
  reportOrderIssue,
  type SupportIssue
} from "@/lib/api";
import { parseSavedOrders, type SavedOrder } from "@/lib/saved-orders";
import { Customer3DNav } from "@/components/Customer3DNav";

function money(value: number) {
  return `Rs ${value.toLocaleString("en-IN")}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export default function SupportPage() {
  const router = useRouter();
  const supportNumber = "919876543210";
  const whatsappMsg = "Hi Al-Arab Support, I need help with my order.";

  // State
  const [recentOrders, setRecentOrders] = useState<SavedOrder[]>([]);
  const [issues, setIssues] = useState<SupportIssue[]>([]);
  const [loadingIssues, setLoadingIssues] = useState(true);

  // Form State
  const [selectedOrderId, setSelectedOrderId] = useState<string>("manual");
  const [manualOrderNumber, setManualOrderNumber] = useState("");
  const [guestTrackingToken, setGuestTrackingToken] = useState("");
  const [category, setCategory] = useState("missing_items");
  const [desiredResolution, setDesiredResolution] = useState("refund");
  const [description, setDescription] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [issueImages, setIssueImages] = useState<string[]>([]);

  const handleIssueImagesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    setSubmitError("");
    const newImages = [...issueImages];

    if (newImages.length + files.length > 4) {
      setSubmitError("Maximum of 4 images allowed per support ticket.");
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
      if (!allowedTypes.includes(file.type)) {
        setSubmitError("Invalid image type. Only JPG, PNG, and WEBP are allowed.");
        return;
      }

      if (file.size > 1024 * 1024) {
        setSubmitError("Image is too large. Maximum size is 1MB per image.");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setIssueImages(prev => {
            if (prev.length >= 4) return prev;
            return [...prev, reader.result as string];
          });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const removeIssueImage = (index: number) => {
    setIssueImages(prev => prev.filter((_, i) => i !== index));
  };

  const loadIssuesData = useCallback(async (ordersList: SavedOrder[]) => {
    setLoadingIssues(true);
    try {
      let fetched: SupportIssue[] = [];
      try {
        fetched = await fetchCustomerIssues();
      } catch {
        // Ignore auth error
      }

      const guestOrders = ordersList.filter(
        (order): order is SavedOrder & { trackingToken: string } =>
          Boolean(order.trackingToken)
      );
      for (const order of guestOrders) {
        try {
          const guestIssues = await fetchCustomerIssues({
            orderNumber: order.id,
            trackingToken: order.trackingToken
          });
          fetched = [
            ...fetched,
            ...guestIssues.filter(gi => !fetched.some(fi => fi.id === gi.id))
          ];
        } catch {
          // Ignore
        }
      }
      setIssues(fetched);
    } catch {
      // Ignore
    } finally {
      setLoadingIssues(false);
    }
  }, []);

  useEffect(() => {
    const stored = window.localStorage.getItem("al-arab-orders");
    const parsed = parseSavedOrders(stored);
    setRecentOrders(parsed);
    if (parsed.length > 0) {
      setSelectedOrderId(parsed[0].id);
    }
    void loadIssuesData(parsed);
  }, [loadIssuesData]);

  const handleSubmitIssue = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError("");
    setSuccessMsg("");

    if (!description.trim()) {
      setSubmitError("Description is required.");
      return;
    }

    // Determine final order details
    let finalOrderNumber = "";
    let finalTrackingToken = "";

    if (selectedOrderId === "manual") {
      if (!manualOrderNumber.trim()) {
        setSubmitError("Order number is required.");
        return;
      }
      if (!guestTrackingToken.trim()) {
        setSubmitError("Please enter the secure tracking token for this order.");
        return;
      }
      finalOrderNumber = manualOrderNumber.trim();
      finalTrackingToken = guestTrackingToken.trim();
    } else {
      const selected = recentOrders.find(o => o.id === selectedOrderId);
      if (!selected) return;
      finalOrderNumber = selected.id;
      finalTrackingToken = selected.trackingToken || "";
    }

    setIsSubmitting(true);
    try {
      const payload = {
        orderNumber: finalOrderNumber,
        category,
        description,
        desiredResolution,
        trackingToken: finalTrackingToken || undefined,
        images: issueImages
      };

      const newIssue = await reportOrderIssue(payload);
      setIssues(prev => [newIssue, ...prev]);

      // Redirect to support chat
      const newIssueId = newIssue.id || newIssue._id;
      if (newIssueId && finalTrackingToken) {
        window.sessionStorage.setItem(
          `al-arab-support-token:${newIssueId}`,
          finalTrackingToken
        );
      }
      const chatUrl = `/support/chat/${newIssueId}`;
      setDescription("");
      setManualOrderNumber("");
      setGuestTrackingToken("");
      setIssueImages([]);
      router.push(chatUrl);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit support ticket. Verify your order details.";
      setSubmitError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#080808] p-5 text-white pb-32">
      <div className="mx-auto max-w-3xl">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link
            href="/mobile"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-[#111111] hover:bg-white/5 transition active:scale-95"
          >
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black font-heading">Support & Help</h1>
          <div className="h-11 w-11" />
        </div>

        {/* Hero Section */}
        <div className="flex flex-col items-center text-center mt-4 mb-8">
          <div className="h-20 w-20 rounded-full bg-yellow-500/10 flex items-center justify-center border border-yellow-500/30 mb-4 animate-pulse">
            <HeadphonesIcon size={40} className="text-yellow-500" />
          </div>
          <h2 className="text-2xl font-black mb-1 font-heading">How can we help you?</h2>
          <p className="text-xs text-white/50 max-w-[340px]">
            Support is active from 11:00 AM to 11:00 PM daily. Contact us or report a ticket below.
          </p>
        </div>

        {/* Contact Shortcuts */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
          <a
            href={`https://wa.me/${supportNumber}?text=${encodeURIComponent(whatsappMsg)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl border border-[#25D366]/30 bg-[#25D366]/10 p-4 text-[#25D366] transition hover:bg-[#25D366]/20 active:scale-[0.98]"
          >
            <MessageCircle size={28} />
            <div>
              <h3 className="font-bold text-left text-sm sm:text-base">Chat on WhatsApp</h3>
              <p className="text-xs opacity-80 text-left">Instant replies from our kitchen</p>
            </div>
          </a>

          <a
            href={`tel:+${supportNumber}`}
            className="flex items-center gap-4 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-yellow-500 transition hover:bg-yellow-500/20 active:scale-[0.98]"
          >
            <PhoneCall size={28} />
            <div>
              <h3 className="font-bold text-left text-sm sm:text-base">Call Support</h3>
              <p className="text-xs opacity-80 text-left">Speak directly to the restaurant manager</p>
            </div>
          </a>
        </div>

        {/* Form and Ticket List container */}
        <div className="space-y-8">

          {/* Report an Issue Form */}
          <section className="rounded-2xl border border-white/10 bg-[#111111] p-5 sm:p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 h-32 w-32 bg-yellow-500/5 rounded-full blur-3xl -z-10" />
            <h2 className="font-heading text-lg font-bold text-white mb-4 flex items-center gap-2">
              <AlertTriangle className="text-yellow-500" size={18} />
              Report Order Issue or Request Refund
            </h2>

            {successMsg && (
              <div className="mb-4 flex items-center gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-100 animate-in fade-in">
                <CheckCircle2 className="shrink-0 text-emerald-500" size={20} />
                <p className="text-sm font-semibold">{successMsg}</p>
              </div>
            )}

            <form onSubmit={handleSubmitIssue} className="space-y-4">

              {/* Order Selection */}
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                  Select Order
                </label>
                <select
                  value={selectedOrderId}
                  onChange={(e) => setSelectedOrderId(e.target.value)}
                  className="h-12 w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-3 text-sm text-white outline-none focus:border-yellow-500/60"
                >
                  {recentOrders.map((o) => (
                    <option key={o.id} value={o.id}>
                      Order #{o.id} - {formatDate(o.createdAt)} ({money(o.total)})
                    </option>
                  ))}
                  <option value="manual">Enter Order Number Manually (Guest)</option>
                </select>
              </div>

              {/* Manual inputs for guest validation */}
              {selectedOrderId === "manual" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border border-white/5 bg-black/30 p-4 rounded-xl animate-in slide-in-from-top-2 duration-200">
                  <div>
                    <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                      Order Number
                    </label>
                    <input
                      required={selectedOrderId === "manual"}
                      type="text"
                      placeholder="e.g. AR-123456-78"
                      value={manualOrderNumber}
                      onChange={(e) => setManualOrderNumber(e.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none focus:border-yellow-500/60"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      Tracking Token
                      <ShieldCheck size={14} className="text-yellow-500/60" />
                    </label>
                    <input
                      type="text"
                      placeholder="Enter secure tracking token"
                      value={guestTrackingToken}
                      onChange={(e) => setGuestTrackingToken(e.target.value)}
                      className="h-12 w-full rounded-xl border border-white/10 bg-black/40 px-4 text-sm text-white outline-none focus:border-yellow-500/60"
                    />
                  </div>
                  <div className="md:col-span-2 text-[10px] text-white/40 flex items-center gap-1.5 mt-1">
                    <Info size={12} />
                    Guest support requires the secure tracking token shown with your order.
                  </div>
                </div>
              )}

              {/* Category & Desired Resolution */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                    Issue Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-3 text-sm text-white outline-none focus:border-yellow-500/60"
                  >
                    <option value="missing_items">Missing Items</option>
                    <option value="wrong_items">Wrong Items</option>
                    <option value="poor_quality">Food Quality Issue</option>
                    <option value="delivery_delay">Late Delivery</option>
                    <option value="other">Other issue</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                    Desired Resolution
                  </label>
                  <select
                    value={desiredResolution}
                    onChange={(e) => setDesiredResolution(e.target.value)}
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#1a1a1a] px-3 text-sm text-white outline-none focus:border-yellow-500/60"
                  >
                    <option value="refund">Refund Request</option>
                    <option value="redelivery">Redelivery of Item</option>
                    <option value="feedback">Feedback Only</option>
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                  Issue Description
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Explain the problem in detail so our kitchen team can investigate..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-black/35 p-4 text-sm text-white outline-none resize-none focus:border-yellow-500/60 focus:ring-2 focus:ring-yellow-500/20 transition-all"
                />
              </div>

              {/* Photos upload */}
              <div>
                <span className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
                  Attach Photos (Optional, Max 4 - 1MB each)
                </span>
                <div className="grid grid-cols-4 gap-3">
                  {issueImages.map((img, idx) => (
                    <div key={idx} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 bg-white/5 group">
                      <Image src={img} alt={`Support attachment preview ${idx + 1}`} fill unoptimized className="object-cover" />
                      <button
                        type="button"
                        onClick={() => removeIssueImage(idx)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-red-600 flex items-center justify-center text-white opacity-85 hover:opacity-100 hover:scale-105 transition-all"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {issueImages.length < 4 && (
                    <label className="relative aspect-square flex flex-col items-center justify-center rounded-xl border border-dashed border-white/20 hover:border-yellow-500/40 hover:bg-white/5 cursor-pointer group transition-all">
                      <Camera size={20} className="text-white/40 group-hover:text-yellow-500/80 transition-colors" />
                      <span className="text-[9px] font-bold text-white/40 mt-1 uppercase">Add Photo</span>
                      <input
                        type="file"
                        multiple
                        accept="image/*"
                        onChange={handleIssueImagesChange}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              {submitError && (
                <p role="alert" className="text-xs font-semibold text-red-400">{submitError}</p>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-12 rounded-xl bg-yellow-500 px-5 text-sm font-black text-black hover:bg-yellow-600 transition disabled:opacity-50 active:scale-[0.99] duration-150 shadow-md"
              >
                {isSubmitting ? "Submitting Ticket..." : "Report Issue & Request Resolution"}
              </button>
            </form>
          </section>

          {/* Reported issues list */}
          <section>
            <h2 className="text-xs font-black uppercase tracking-widest text-white/40 mb-4">
              Your Support Tickets
            </h2>

            {loadingIssues ? (
              <div className="text-center py-10">
                <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-white/15 border-t-yellow-500" />
                <p className="mt-3 text-xs text-white/40 font-bold">Loading reported tickets...</p>
              </div>
            ) : issues.length === 0 ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-white/40 italic">
                You haven&apos;t reported any issues or support tickets yet.
              </div>
            ) : (
              <div className="space-y-4">
                {issues.map((issue) => (
                  <article key={issue.id} className="rounded-xl border border-white/5 bg-[#111111] p-5 shadow-lg">
                    <div className="flex justify-between items-start border-b border-white/5 pb-3">
                      <div>
                        <h3 className="font-bold text-white text-sm">
                          Ticket ID: {issue.id}
                        </h3>
                        <p className="text-[10px] text-white/50 mt-0.5">
                          Order Number: #{issue.orderNumber} · Reported on {formatDate(issue.createdAt)}
                        </p>
                      </div>
                      <span className={`rounded-md border px-2.5 py-1 text-xs font-black uppercase tracking-wider ${
                        issue.status === "refunded"
                          ? "border-green-500/20 bg-green-500/10 text-green-400"
                          : issue.status === "resolved"
                            ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                            : issue.status === "investigating"
                              ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-400 animate-pulse"
                              : "border-yellow-500/20 bg-yellow-500/10 text-yellow-500 animate-pulse"
                      }`}>
                        {issue.status}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-white/70">
                      <div>
                        <span className="font-bold text-white/40 uppercase tracking-wide text-[9px] mr-2">Category:</span>
                        <span className="text-yellow-500 font-bold">{issue.category.replace("_", " ")}</span>
                      </div>
                      <div>
                        <span className="font-bold text-white/40 uppercase tracking-wide text-[9px] mr-2">Resolution:</span>
                        <span className="text-white font-bold uppercase tracking-wide text-[10px]">{issue.desiredResolution}</span>
                      </div>
                      <p className="italic bg-black/25 p-3 rounded-lg border border-white/5 mt-2">
                        &ldquo;{issue.description}&rdquo;
                      </p>

                      {issue.images && issue.images.length > 0 && (
                        <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                          {issue.images.map((img, idx) => (
                            <div key={idx} className="relative h-12 w-12 rounded-lg overflow-hidden border border-white/10 bg-white/5 shrink-0">
                              <Image src={img} alt={`Ticket ${issue.id} attachment ${idx + 1}`} fill unoptimized className="object-cover" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {issue.resolutionDetails && (
                      <div className="mt-3 border-t border-white/5 pt-3 text-xs bg-yellow-500/[0.02] p-3 rounded-lg border border-yellow-500/10">
                        <span className="font-bold text-yellow-500/70 uppercase tracking-wide text-[9px] block">Resolution Update:</span>
                        <p className="mt-1 text-white/80 font-medium">{issue.resolutionDetails}</p>

                        {issue.refundStatus === "processed" && issue.refundAmount > 0 && (
                          <p className="mt-2 text-xs font-black text-green-400">
                            Razorpay processed a refund of {money(issue.refundAmount)}.
                          </p>
                        )}
                        {issue.refundStatus === "pending" && issue.refundAmount > 0 && (
                          <p className="mt-2 text-xs font-black text-amber-400">
                            Refund of {money(issue.refundAmount)} is awaiting Razorpay confirmation.
                          </p>
                        )}
                        {issue.refundStatus === "failed" && (
                          <p className="mt-2 text-xs font-black text-red-400">
                            Razorpay could not process this refund. Support will review it.
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      type="button"
                      onClick={() => {
                        const issueId = issue.id || issue._id;
                        const trackingToken = recentOrders.find(
                          (order) => order.id === issue.orderNumber
                        )?.trackingToken;
                        if (issueId && trackingToken) {
                          window.sessionStorage.setItem(
                            `al-arab-support-token:${issueId}`,
                            trackingToken
                          );
                        }
                        router.push(`/support/chat/${issueId}`);
                      }}
                      className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5 px-3 py-2 text-xs font-bold text-yellow-500 hover:bg-yellow-500/10 transition"
                    >
                      <MessageCircle size={14} />
                      Open Support Chat
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

        </div>
      </div>

      <Customer3DNav />
    </main>
  );
}
