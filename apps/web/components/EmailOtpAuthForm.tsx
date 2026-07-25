"use client";

import type { FormEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  requestCustomerEmailOtp,
  verifyCustomerEmailOtp
} from "@/lib/api";
import { getSafeReturnTo, isCheckoutReturnPath } from "@/lib/auth-navigation";

type EmailOtpAuthFormProps = {
  source: "login" | "register";
};

export function EmailOtpAuthForm({ source }: EmailOtpAuthFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedReturnTo = searchParams.get("returnTo");
  const returnTo = useMemo(
    () => getSafeReturnTo(requestedReturnTo),
    [requestedReturnTo]
  );
  const isCheckoutRedirect = isCheckoutReturnPath(requestedReturnTo);
  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const sendOtp = async () => {
    setError("");
    setStatus("");
    setIsSubmitting(true);
    try {
      const result = await requestCustomerEmailOtp(email);
      setStep("otp");
      setOtp("");
      setResendSeconds(result.resendAfterSeconds || 60);
      setStatus("We sent a six-digit verification code to your email.");
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "We couldn't send the code. Please try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEmailSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await sendOtp();
  };

  const handleOtpSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setStatus("");
    setIsSubmitting(true);
    try {
      const auth = await verifyCustomerEmailOtp(email, otp);
      window.localStorage.removeItem("al-arab-auth");
      window.localStorage.setItem("al-arab-user", JSON.stringify(auth.user));
      router.replace(returnTo);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The code is incorrect or expired."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const changeEmail = () => {
    setStep("email");
    setOtp("");
    setError("");
    setStatus("");
    setResendSeconds(0);
  };

  const alternatePath = source === "login" ? "/register" : "/login";
  const alternateHref = requestedReturnTo
    ? `${alternatePath}?returnTo=${encodeURIComponent(returnTo)}`
    : alternatePath;

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))]">
      <Image
        src="/images/al-arab-hero.png"
        alt=""
        fill
        priority
        className="object-cover object-[68%_center]"
      />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white/95 p-6 shadow-2xl backdrop-blur sm:p-8">
        <h1 className="text-center text-3xl font-black leading-tight text-black sm:text-4xl">
          {source === "login" ? "Welcome Back" : "Join Al-Arab"}
        </h1>
        <p className="mt-2 text-center font-medium text-gray-800">
          Sign in or create your account with an email code
        </p>

        {isCheckoutRedirect && (
          <p
            role="status"
            className="mt-5 rounded-lg border border-[#d4af37]/50 bg-[#d4af37]/10 px-3 py-2 text-center text-sm font-bold text-[#6f5900]"
          >
            Please sign in to continue to checkout.
          </p>
        )}

        {step === "email" ? (
          <form className="mt-7 space-y-4" onSubmit={handleEmailSubmit}>
            <label className="block text-sm font-bold text-gray-800">
              Email address
              <input
                required
                type="email"
                autoComplete="email"
                inputMode="email"
                maxLength={320}
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setError("");
                }}
                placeholder="customer@example.com"
                className="mt-1 h-12 w-full rounded-lg border border-gray-400 px-4 text-base text-black outline-none placeholder:text-gray-500 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30"
              />
            </label>

            {error && (
              <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-12 w-full rounded-lg bg-[#d4af37] px-4 py-3 font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Sending code..." : "Send OTP"}
            </button>
          </form>
        ) : (
          <form className="mt-7 space-y-4" onSubmit={handleOtpSubmit}>
            <div className="rounded-lg bg-gray-100 px-3 py-2 text-center text-sm text-gray-700">
              Code sent to <strong className="break-all">{email.trim().toLowerCase()}</strong>
            </div>

            <label className="block text-sm font-bold text-gray-800">
              Six-digit verification code
              <input
                required
                autoFocus
                type="text"
                autoComplete="one-time-code"
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={otp}
                onChange={(event) => {
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 6));
                  setError("");
                }}
                placeholder="000000"
                className="mt-1 h-14 w-full rounded-lg border border-gray-400 px-4 text-center text-2xl font-black tracking-[0.45em] text-black outline-none placeholder:text-gray-400 focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30"
              />
            </label>

            {status && (
              <p aria-live="polite" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {status}
              </p>
            )}
            {error && (
              <p role="alert" className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isSubmitting || otp.length !== 6}
              className="min-h-12 w-full rounded-lg bg-[#d4af37] px-4 py-3 font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Verifying..." : "Verify and Continue"}
            </button>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                disabled={isSubmitting || resendSeconds > 0}
                onClick={() => void sendOtp()}
                className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : "Resend OTP"}
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={changeEmail}
                className="min-h-11 rounded-lg border border-gray-300 px-3 py-2 text-sm font-bold text-gray-800 disabled:opacity-50"
              >
                Change email
              </button>
            </div>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-gray-700">
          {source === "login" ? "New to Al-Arab?" : "Already started signing in?"}{" "}
          <Link href={alternateHref} className="font-bold text-[#806700] hover:underline">
            {source === "login" ? "Create account" : "Go to login"}
          </Link>
        </p>
      </div>
    </main>
  );
}
