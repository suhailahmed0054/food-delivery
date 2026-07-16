"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowLeft,
  Send,
  Camera,
  X,
  Clock,
  CheckCircle2,
  ShieldCheck,
  Loader2,
  MessageCircle
} from "lucide-react";
import { io, type Socket } from "socket.io-client";
import {
  SupportIssue,
  SupportMessage,
  getApiSocketUrl,
  fetchIssueMessages,
  sendIssueMessage,
  fetchSupportIssue
} from "@/lib/api";

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function SupportChatPage() {
  const params = useParams();
  const issueId = params.issueId as string;
  const [trackingToken, setTrackingToken] = useState("");
  const [credentialsReady, setCredentialsReady] = useState(false);

  const [issue, setIssue] = useState<SupportIssue | null>(null);
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatImages, setChatImages] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [showTicketInfo, setShowTicketInfo] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTrackingToken(
      window.sessionStorage.getItem(`al-arab-support-token:${issueId}`) ?? ""
    );
    setCredentialsReady(true);
  }, [issueId]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  // Load issue and messages
  useEffect(() => {
    async function load() {
      setIsLoading(true);
      try {
        const msgs = await fetchIssueMessages(issueId, trackingToken || undefined);
        setMessages(msgs);
        try {
          setIssue(await fetchSupportIssue(issueId, trackingToken || undefined));
        } catch {
          // Chat still works with just messages
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load chat");
      } finally {
        setIsLoading(false);
      }
    }
    if (issueId && credentialsReady) void load();
  }, [credentialsReady, issueId, trackingToken]);

  // Socket connection
  useEffect(() => {
    if (!credentialsReady) return;
    const socket = io(getApiSocketUrl(), {
      transports: ["websocket", "polling"],
      withCredentials: true
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      socket.emit("support:join", {
        issueId,
        trackingToken: trackingToken || undefined
      });
    });

    socket.on("support_message_sent", (data: { issueId: string; message: SupportMessage }) => {
      if (data.issueId === issueId) {
        setMessages(prev => {
          const exists = prev.some(m => (m.id || m._id) === (data.message.id || data.message._id));
          if (exists) return prev;
          return [...prev, data.message];
        });
        scrollToBottom();
      }
    });

    socket.on("support_agent_joined", (data: { issueId: string; agentName: string }) => {
      if (data.issueId === issueId) {
        setIssue(prev => prev ? { ...prev, chatStatus: "active", assignedAgentName: data.agentName } : prev);
      }
    });

    socket.on("support_issue_updated", (updatedIssue: SupportIssue) => {
      const uid = updatedIssue.id || updatedIssue._id;
      if (uid === issueId) {
        setIssue(updatedIssue);
      }
    });

    socket.on("support_issue_closed", (data: { issueId: string }) => {
      if (data.issueId === issueId) {
        setIssue(prev => prev ? { ...prev, chatStatus: "closed" } : prev);
      }
    });

    return () => {
      socket.emit("support:leave", {
        issueId,
        trackingToken: trackingToken || undefined
      });
      socket.disconnect();
    };
  }, [credentialsReady, issueId, scrollToBottom, trackingToken]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSend = async () => {
    if (!newMessage.trim() && chatImages.length === 0) return;
    setIsSending(true);
    try {
      const msg = await sendIssueMessage(issueId, {
        message: newMessage.trim() || (chatImages.length > 0 ? "📷 Image" : ""),
        images: chatImages.length > 0 ? chatImages : undefined
      }, trackingToken || undefined);
      setMessages(prev => {
        const exists = prev.some(m => (m.id || m._id) === (msg.id || msg._id));
        if (exists) return prev;
        return [...prev, msg];
      });
      setNewMessage("");
      setChatImages([]);
      scrollToBottom();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (chatImages.length + files.length > 4) {
      setError("Maximum 4 images per message");
      setTimeout(() => setError(""), 3000);
      return;
    }
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) continue;
      if (file.size > 1024 * 1024) {
        setError("Each support image must be 1MB or smaller");
        continue;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === "string") {
          setChatImages(prev => prev.length >= 4 ? prev : [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const chatStatus = issue?.chatStatus || "waiting";
  const isClosed = chatStatus === "closed";

  if (isLoading) {
    return (
      <main className="min-h-screen bg-[#080808] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
          <p className="text-white/50 text-sm">Loading support chat...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080808] flex flex-col" style={{ height: "100dvh" }}>
      {/* Header */}
      <header className="shrink-0 border-b border-white/10 bg-[#111111] px-4 py-3">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Link
            href="/support"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 transition"
          >
            <ArrowLeft size={18} className="text-white" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-bold text-white truncate">Support Chat</h1>
            <p className="text-[10px] text-white/40 truncate">Ticket: {issueId}</p>
          </div>
          <span className={`shrink-0 rounded-md px-2.5 py-1 text-[10px] font-black uppercase tracking-wider border ${
            chatStatus === "closed"
              ? "border-white/10 bg-white/5 text-white/40"
              : chatStatus === "active"
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-yellow-500/30 bg-yellow-500/10 text-yellow-500 animate-pulse"
          }`}>
            {chatStatus === "closed" ? "Resolved" : chatStatus === "active" ? "Agent Active" : "Waiting"}
          </span>
        </div>
      </header>

      {/* Ticket info collapsible */}
      {issue && (
        <div className="shrink-0 border-b border-white/5 bg-[#0c0c0c]">
          <button
            onClick={() => setShowTicketInfo(!showTicketInfo)}
            className="w-full px-4 py-2 flex items-center justify-between text-[10px] font-bold text-white/40 uppercase tracking-wider hover:bg-white/5 transition"
          >
            <span>Ticket Details — Order #{issue.orderNumber}</span>
            <span className="text-yellow-500">{showTicketInfo ? "Hide" : "Show"}</span>
          </button>
          {showTicketInfo && (
            <div className="px-4 pb-3 space-y-2 text-xs text-white/60">
              <div className="flex gap-4">
                <span><strong className="text-white/40">Category:</strong> {issue.category?.replace("_", " ")}</span>
                <span><strong className="text-white/40">Resolution:</strong> {issue.desiredResolution}</span>
              </div>
              <p className="italic">&ldquo;{issue.description}&rdquo;</p>
              {issue.images && issue.images.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {issue.images.map((img, i) => (
                    <button key={i} onClick={() => setLightboxImage(img)} className="relative h-12 w-12 rounded-lg overflow-hidden border border-white/10 hover:opacity-80 transition">
                      <Image src={img} alt="Ticket attachment" fill unoptimized className="object-cover" />
                    </button>
                  ))}
                </div>
              )}
              {issue.resolutionType && issue.resolutionType !== "none" && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-2.5">
                  <p className="text-[10px] font-bold text-yellow-500 uppercase">Decision: {issue.resolutionType.replace("_", " ")}</p>
                  {issue.decisionReason && <p className="mt-1 text-white/70">{issue.decisionReason}</p>}
                  {issue.refundApproved && issue.refundAmount > 0 && (
                    <p className="mt-1 text-green-400 font-bold">Refund: ₹{issue.refundAmount.toLocaleString("en-IN")}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Status banner */}
      {chatStatus === "waiting" && (
        <div className="shrink-0 px-4 py-2.5 bg-yellow-500/10 border-b border-yellow-500/20 flex items-center gap-2 text-xs text-yellow-500 font-semibold">
          <Clock size={14} className="animate-pulse" />
          Waiting for a support agent to join...
        </div>
      )}
      {chatStatus === "active" && issue?.assignedAgentName && (
        <div className="shrink-0 px-4 py-2.5 bg-green-500/10 border-b border-green-500/20 flex items-center gap-2 text-xs text-green-400 font-semibold">
          <ShieldCheck size={14} />
          Agent {issue.assignedAgentName} is assisting you
        </div>
      )}
      {isClosed && (
        <div className="shrink-0 px-4 py-2.5 bg-white/5 border-b border-white/10 flex items-center gap-2 text-xs text-white/50 font-semibold">
          <CheckCircle2 size={14} />
          This ticket has been resolved and closed
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <div className="mx-auto max-w-3xl space-y-3">
          {messages.length === 0 && !isLoading && (
            <div className="text-center py-12 text-white/30 text-sm">
              <MessageCircle size={32} className="mx-auto mb-3 opacity-40" />
              <p>No messages yet</p>
            </div>
          )}
          {messages.map((msg) => {
            const msgId = msg.id || msg._id || msg.createdAt;
            const isSystem = msg.senderType === "system";
            const isCustomerSide = msg.senderType === "customer" || msg.senderType === "guest";

            if (isSystem) {
              return (
                <div key={msgId} className="flex justify-center">
                  <div className="rounded-full bg-white/5 border border-white/10 px-4 py-1.5 text-[10px] text-white/40 font-medium text-center max-w-[85%]">
                    {msg.message}
                    <span className="ml-2 text-white/20">{formatTime(msg.createdAt)}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={msgId} className={`flex ${isCustomerSide ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                  isCustomerSide
                    ? "bg-yellow-500/20 border border-yellow-500/30 rounded-br-md"
                    : "bg-[#1a1a1a] border border-white/10 rounded-bl-md"
                }`}>
                  {!isCustomerSide && (
                    <p className="text-[10px] font-bold text-yellow-500 mb-1">
                      {msg.senderName} · {msg.senderType === "admin" ? "Admin" : "Agent"}
                    </p>
                  )}
                  {msg.message && <p className="text-sm text-white/90 leading-relaxed whitespace-pre-wrap">{msg.message}</p>}
                  {msg.images && msg.images.length > 0 && (
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      {msg.images.map((img, i) => (
                        <button key={i} onClick={() => setLightboxImage(img)} className="relative rounded-lg overflow-hidden border border-white/10 hover:opacity-80 transition aspect-square">
                          <Image src={img} alt="Message attachment" fill unoptimized className="object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                  <p className={`text-[9px] mt-1.5 ${isCustomerSide ? "text-yellow-500/50 text-right" : "text-white/25"}`}>
                    {formatTime(msg.createdAt)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="shrink-0 px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-xs text-red-400 font-semibold text-center">{error}</p>
        </div>
      )}

      {/* Image preview strip */}
      {chatImages.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-t border-white/5 bg-[#0c0c0c] flex gap-2">
          {chatImages.map((img, i) => (
            <div key={i} className="relative h-14 w-14 rounded-lg overflow-hidden border border-white/10">
              <Image src={img} alt="Attachment preview" fill unoptimized className="object-cover" />
              <button
                onClick={() => setChatImages(prev => prev.filter((_, idx) => idx !== i))}
                className="absolute top-0.5 right-0.5 h-4 w-4 rounded-full bg-red-600 flex items-center justify-center text-white"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input area */}
      {!isClosed ? (
        <div className="shrink-0 border-t border-white/10 bg-[#111111] px-4 py-3">
          <div className="mx-auto max-w-3xl flex items-end gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-white/40 hover:text-yellow-500 hover:border-yellow-500/30 transition"
            >
              <Camera size={18} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleImageSelect}
              className="hidden"
            />
            <div className="flex-1 relative">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                placeholder="Type your message..."
                rows={1}
                className="w-full rounded-xl border border-white/10 bg-black/40 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none resize-none focus:border-yellow-500/40 transition"
                style={{ maxHeight: 120, minHeight: 40 }}
              />
            </div>
            <button
              onClick={() => void handleSend()}
              disabled={isSending || (!newMessage.trim() && chatImages.length === 0)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-500 text-black hover:bg-yellow-600 disabled:opacity-40 disabled:cursor-not-allowed transition active:scale-95"
            >
              {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </div>
        </div>
      ) : (
        <div className="shrink-0 border-t border-white/10 bg-[#111111] px-4 py-4">
          <p className="text-center text-xs text-white/30 font-medium">This conversation has been closed</p>
        </div>
      )}

      {/* Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
            <Image
              src={lightboxImage}
              alt="Support attachment"
              width={1200}
              height={900}
              unoptimized
              className="max-h-[85vh] w-auto max-w-full rounded-lg border border-white/10 object-contain"
            />
            <button
              onClick={() => setLightboxImage(null)}
              className="absolute top-3 right-3 h-10 w-10 rounded-full bg-black/60 hover:bg-black/80 flex items-center justify-center text-white border border-white/20 transition"
            >
              <X size={20} />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
