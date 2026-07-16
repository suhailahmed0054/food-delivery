"use client";

import { type FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Eye,
  EyeOff,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck
} from "lucide-react";
import { loginAdmin } from "@/lib/api";

export default function AdminLoginPage() {
  const router = useRouter();
  const isDevelopment = process.env.NODE_ENV !== "production";
  const [email, setEmail] = useState(isDevelopment ? "admin@alarab.local" : "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const session = await loginAdmin(email, password);
      if (session.user.role !== "admin") {
        throw new Error("This account does not have admin access");
      }
      router.replace("/admin");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Unable to sign in"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#080b09] p-4 text-foreground">
      <Image
        src="/images/al-arab-hero.png"
        alt=""
        fill
        priority
        className="object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(223,177,61,0.16),transparent_38%),linear-gradient(to_bottom,rgba(8,11,9,0.62),#080b09_82%)]" />

      <section className="relative z-10 w-full max-w-md overflow-hidden rounded-[30px] border border-primary/25 bg-card/95 shadow-2xl backdrop-blur-xl">
        <header className="border-b border-border px-7 pb-6 pt-8 text-center">
          <Image
            src="/images/logo-watermark.png"
            alt="Al-Arab Restaurant"
            width={72}
            height={72}
            className="mx-auto h-16 w-auto object-contain"
          />
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-primary">
            <ShieldCheck size={13} />
            Secure administration
          </div>
          <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">
            Admin Login
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Sign in with an authorized administrator account.
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-5 p-7">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Email address
            </span>
            <span className="relative block">
              <Mail
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
              />
              <input
                required
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                placeholder="admin@example.com"
              />
            </span>
          </label>

          <label className="block">
            <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-muted-foreground">
              Password
            </span>
            <span className="relative block">
              <LockKeyhole
                size={17}
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
              />
              <input
                required
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-border bg-background pl-11 pr-12 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                placeholder="Enter your password"
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-foreground/5 hover:text-primary"
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </span>
          </label>

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : (
              <ShieldCheck size={18} />
            )}
            {isSubmitting ? "Verifying..." : "Sign in to dashboard"}
          </button>

          {isDevelopment && (
            <p className="rounded-xl border border-primary/15 bg-primary/[0.05] px-4 py-3 text-center text-[11px] font-semibold leading-5 text-muted-foreground">
              Local demo: <strong className="text-foreground">admin@alarab.local</strong>
              <br />
              Password: <strong className="text-foreground">Admin@123</strong>
            </p>
          )}
        </form>
      </section>
    </main>
  );
}
