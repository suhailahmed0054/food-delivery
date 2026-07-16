"use client";

import { type ChangeEvent, useEffect, useId, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  ImageUp,
  LoaderCircle,
  QrCode,
  RefreshCw,
  ShieldCheck,
  X
} from "lucide-react";
import { resolveTableQr } from "@/lib/api";
import {
  parseTableQrPayload,
  persistTableSession,
  type TableSession
} from "@/lib/table-session";

type ScannerStatus = "starting" | "scanning" | "verifying" | "error";

type DineInScannerProps = {
  open: boolean;
  onClose: () => void;
  onTableResolved: (session: TableSession) => void;
};

function getCameraErrorMessage(error: unknown) {
  const errorName =
    error && typeof error === "object" && "name" in error
      ? String(error.name)
      : "";
  const errorMessage = error instanceof Error ? error.message : String(error ?? "");

  if (/secure context|media devices unavailable/i.test(errorMessage)) {
    return "Live scanning needs HTTPS or localhost. If you opened the site on your phone using an IP address, use Take QR photo below.";
  }

  if (errorName === "NotAllowedError" || /permission|notallowed/i.test(errorMessage)) {
    return "Camera access is blocked. Allow camera permission in your browser, then try again.";
  }

  if (errorName === "NotFoundError" || /notfound|no camera/i.test(errorMessage)) {
    return "No camera was found on this device.";
  }

  if (errorName === "NotReadableError" || /notreadable|could not start video/i.test(errorMessage)) {
    return "The camera is busy in another app. Close it there, then try again.";
  }

  return "The camera could not start. Check browser permission and try again.";
}

export function DineInScanner({
  open,
  onClose,
  onTableResolved
}: DineInScannerProps) {
  const reactId = useId();
  const scannerElementId = `dine-in-scanner-${reactId.replace(/:/g, "")}`;
  const fileScannerElementId = `${scannerElementId}-file`;
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const decodeHandlerRef = useRef<((decodedText: string) => Promise<void>) | null>(null);
  const [status, setStatus] = useState<ScannerStatus>("starting");
  const [message, setMessage] = useState("Starting camera...");
  const [cameraStartFailed, setCameraStartFailed] = useState(false);
  const [scannerAttempt, setScannerAttempt] = useState(0);

  useEffect(() => {
    if (!open) return;

    const previousBodyOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousBodyOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    let isHandlingResult = false;
    let resetTimer: number | null = null;
    let scannerStarted = false;
    let scanner: import("html5-qrcode").Html5Qrcode | null = null;

    setStatus("starting");
    setMessage("Starting camera...");
    setCameraStartFailed(false);

    const stopScanner = async () => {
      if (!scanner) return;

      if (scannerStarted) {
        try {
          await scanner.stop();
        } catch {
          // The stream may already be closing while the sheet unmounts.
        }
      }

      try {
        scanner.clear();
      } catch {
        // The scanner element can disappear before the library finishes cleanup.
      }

      scannerStarted = false;
    };

    const resumeAfterError = (errorMessage: string) => {
      setStatus("error");
      setMessage(errorMessage);
      resetTimer = window.setTimeout(() => {
        if (cancelled) return;
        isHandlingResult = false;
        setStatus("scanning");
        setMessage("Point the camera at the QR code on your table.");
      }, 1800);
    };

    const handleDecodedText = async (decodedText: string) => {
      if (cancelled || isHandlingResult) return;

      const tableInput = parseTableQrPayload(decodedText, window.location.origin);
      if (!tableInput) {
        isHandlingResult = true;
        resumeAfterError("That is not an Al-Arab table QR code. Try the code placed on your table.");
        return;
      }

      isHandlingResult = true;
      setStatus("verifying");
      setMessage("Table found. Verifying...");

      try {
        const table = await resolveTableQr(tableInput);
        if (cancelled) return;

        const resolvedToken = tableInput.token ?? table.token;
        const session = resolvedToken ? persistTableSession(table, resolvedToken) : null;
        if (!session) throw new Error("This table QR code could not be verified.");

        setMessage(`${session.label} detected.`);
        await stopScanner();
        if (cancelled) return;

        onTableResolved(session);
        onClose();
      } catch (error) {
        if (cancelled) return;
        resumeAfterError(
          error instanceof Error
            ? error.message
            : "This table QR code is invalid or inactive."
        );
      }
    };
    decodeHandlerRef.current = handleDecodedText;

    const startScanner = async () => {
      try {
        const {
          Html5Qrcode,
          Html5QrcodeSupportedFormats
        } = await import("html5-qrcode");
        if (cancelled) return;

        if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
          throw new Error("Secure context media devices unavailable");
        }

        const cameras = await Html5Qrcode.getCameras();
        if (cancelled) return;
        if (cameras.length === 0) throw new Error("No camera found");

        const preferredCamera =
          cameras.find((camera) => /back|rear|environment|world/i.test(camera.label)) ??
          cameras.at(-1)!;

        scanner = new Html5Qrcode(scannerElementId, {
          formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
          verbose: false
        });

        await scanner.start(
          preferredCamera.id,
          {
            fps: 10,
            qrbox: (viewfinderWidth, viewfinderHeight) => {
              const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.68);
              return { width: size, height: size };
            }
          },
          (decodedText) => {
            void handleDecodedText(decodedText);
          },
          undefined
        );

        scannerStarted = true;
        if (cancelled) {
          await stopScanner();
          return;
        }

        setStatus("scanning");
        setMessage("Point the camera at the QR code on your table.");
      } catch (error) {
        if (cancelled) return;
        setCameraStartFailed(true);
        setStatus("error");
        setMessage(getCameraErrorMessage(error));
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      if (resetTimer !== null) window.clearTimeout(resetTimer);
      if (decodeHandlerRef.current === handleDecodedText) decodeHandlerRef.current = null;
      void stopScanner();
    };
  }, [onClose, onTableResolved, open, scannerAttempt, scannerElementId]);

  const handleImageSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    let fileScanner: import("html5-qrcode").Html5Qrcode | null = null;
    setStatus("verifying");
    setMessage("Reading the QR code from your photo...");

    try {
      const {
        Html5Qrcode,
        Html5QrcodeSupportedFormats
      } = await import("html5-qrcode");

      fileScanner = new Html5Qrcode(fileScannerElementId, {
        formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
        verbose: false
      });
      const decodedText = await fileScanner.scanFile(file, false);
      const decodeHandler = decodeHandlerRef.current;
      if (!decodeHandler) throw new Error("Scanner is not ready");
      await decodeHandler(decodedText);
    } catch {
      setStatus("error");
      setMessage("No readable table QR was found in that photo. Move closer and try again.");
    } finally {
      try {
        fileScanner?.clear();
      } catch {
        // The hidden file scanner may already have cleared its temporary canvas.
      }
      event.target.value = "";
    }
  };

  if (!open) return null;

  const StatusIcon =
    status === "verifying"
      ? LoaderCircle
      : status === "scanning"
        ? Camera
        : status === "error"
          ? QrCode
          : LoaderCircle;

  return (
    <div className="fixed inset-0 z-[260] flex items-end justify-center bg-black/75 px-0 backdrop-blur-md sm:items-center sm:px-5">
      <button
        type="button"
        aria-label="Close dine-in scanner"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="dine-in-scanner-title"
        aria-describedby="dine-in-scanner-description"
        className="customer-sheet-3d relative w-full max-w-md overflow-hidden rounded-t-[30px] border border-border bg-card shadow-2xl sm:rounded-[30px]"
      >
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 pb-4 pt-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
              Dine-in
            </p>
            <h2 id="dine-in-scanner-title" className="mt-1 text-xl font-black text-foreground">
              Scan your table
            </h2>
            <p id="dine-in-scanner-description" className="mt-1 text-xs font-semibold text-muted-foreground">
              Use the QR code placed on your table.
            </p>
          </div>
          <button
            type="button"
            aria-label="Close scanner"
            onClick={onClose}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background/70 text-foreground transition hover:border-primary/40 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X size={20} aria-hidden="true" />
          </button>
        </header>

        <div className="p-5">
          <div className="relative aspect-square overflow-hidden rounded-[26px] border border-primary/30 bg-black shadow-inner">
            <div
              id={scannerElementId}
              className="h-full w-full overflow-hidden [&>canvas]:!hidden [&>video]:!h-full [&>video]:!w-full [&>video]:!object-cover"
            />
            <div aria-hidden="true" className="pointer-events-none absolute inset-[16%]">
              <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-xl border-l-[3px] border-t-[3px] border-primary" />
              <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-xl border-r-[3px] border-t-[3px] border-primary" />
              <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-xl border-b-[3px] border-l-[3px] border-primary" />
              <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-xl border-b-[3px] border-r-[3px] border-primary" />
              {status === "scanning" && (
                <span className="absolute left-2 right-2 top-1/2 h-px bg-primary shadow-[0_0_14px_2px_hsl(var(--primary))]" />
              )}
            </div>

            {(status === "starting" || status === "verifying") && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/45 backdrop-blur-[2px]">
                {status === "verifying" ? (
                  <CheckCircle2 size={42} className="text-primary" aria-hidden="true" />
                ) : (
                  <LoaderCircle size={38} className="animate-spin text-primary" aria-hidden="true" />
                )}
              </div>
            )}
          </div>

          <div
            role={status === "error" ? "alert" : "status"}
            aria-live="polite"
            className={`mt-4 flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 ${
              status === "error"
                ? "border-red-500/30 bg-red-500/10 text-red-200"
                : "border-primary/25 bg-primary/10 text-foreground"
            }`}
          >
            <StatusIcon
              size={19}
              className={`shrink-0 text-primary ${
                status === "starting" || status === "verifying" ? "animate-spin" : ""
              }`}
              aria-hidden="true"
            />
            <p className="text-xs font-bold leading-relaxed">{message}</p>
          </div>

          <div className={`mt-3 grid gap-2 ${cameraStartFailed ? "grid-cols-2" : "grid-cols-1"}`}>
            {cameraStartFailed && (
              <button
                type="button"
                onClick={() => setScannerAttempt((attempt) => attempt + 1)}
                className="flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-3 text-xs font-black text-foreground transition hover:border-primary/45 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              >
                <RefreshCw size={16} aria-hidden="true" />
                Try camera
              </button>
            )}

            <label className="flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-primary px-3 text-xs font-black text-primary-foreground shadow-md shadow-primary/15 transition hover:brightness-105 focus-within:ring-2 focus-within:ring-primary focus-within:ring-offset-2 focus-within:ring-offset-card">
              <ImageUp size={16} aria-hidden="true" />
              Take QR photo
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="sr-only"
                onChange={(event) => {
                  void handleImageSelected(event);
                }}
              />
            </label>
          </div>

          <div id={fileScannerElementId} className="hidden" aria-hidden="true" />

          <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold text-muted-foreground">
            <ShieldCheck size={14} className="text-primary" aria-hidden="true" />
            Only verified restaurant table codes are accepted
          </div>
        </div>
      </section>
    </div>
  );
}
