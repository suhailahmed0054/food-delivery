"use client";

import { type FormEvent, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  CircleCheck,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  LockKeyhole,
  Mail,
  ShieldCheck,
  UserRound,
  UserRoundPlus
} from "lucide-react";
import { loginAdmin, registerAdmin } from "@/lib/api";

type AdminAuthMode = "login" | "register";

export default function AdminLoginPage() {
  const router = useRouter();
  const isDevelopment = process.env.NODE_ENV !== "production";
  const [mode, setMode] = useState<AdminAuthMode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState(isDevelopment ? "admin@alarab.local" : "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSignupCode, setShowSignupCode] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectMode = (nextMode: AdminAuthMode) => {
    if (isSubmitting) return;
    setMode(nextMode);
    setError("");
    setSuccess("");
    setPassword("");
    setConfirmPassword("");
    setSignupCode("");
    setEmail(nextMode === "login" && isDevelopment ? "admin@alarab.local" : "");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);

    try {
      const session = mode === "login"
        ? await loginAdmin(email, password)
        : await registerAdmin({
            name,
            email,
            password,
            confirmPassword,
            signupCode
          });
      if (session.user.role !== "admin") {
        throw new Error("This account does not have admin access");
      }
      if (mode === "register") {
        setSuccess("Administrator profile created. Opening the dashboard...");
        await new Promise((resolve) => window.setTimeout(resolve, 500));
      }
      router.replace("/admin");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : mode === "register"
            ? "Unable to create the administrator profile"
            : "Unable to sign in"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-x-hidden overflow-y-auto bg-[#080b09] p-4 py-6 text-foreground">
      <Image
        src="/images/al-arab-hero.png"
        alt=""
        fill
        priority
        className="object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_10%,rgba(223,177,61,0.16),transparent_38%),linear-gradient(to_bottom,rgba(8,11,9,0.62),#080b09_82%)]" />

      <section className="relative z-10 w-full max-w-lg overflow-hidden rounded-[30px] border border-primary/25 bg-card/95 shadow-2xl backdrop-blur-xl">
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
            {mode === "login" ? "Admin Login" : "Create Admin Profile"}
          </h1>
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            {mode === "login"
              ? "Sign in with an authorized administrator account."
              : "Securely create the restaurant's first administrator account."}
          </p>
        </header>

        <div
          className="mx-7 mt-6 grid grid-cols-2 rounded-xl border border-border bg-background/60 p-1"
          aria-label="Administrator authentication options"
        >
          <button
            type="button"
            aria-pressed={mode === "login"}
            onClick={() => selectMode("login")}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition ${
              mode === "login"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShieldCheck size={16} />
            Existing admin
          </button>
          <button
            type="button"
            aria-pressed={mode === "register"}
            onClick={() => selectMode("register")}
            className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-3 text-xs font-black transition ${
              mode === "register"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <UserRoundPlus size={16} />
            Create profile
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-7" aria-busy={isSubmitting}>
          {mode === "register" && (
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                Full name
              </span>
              <span className="relative block">
                <UserRound
                  size={17}
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
                />
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="min-h-12 w-full rounded-xl border border-border bg-background pl-11 pr-4 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                  placeholder="Administrator name"
                />
              </span>
            </label>
          )}

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
                autoComplete={mode === "login" ? "username" : "email"}
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
                minLength={mode === "register" ? 12 : 1}
                maxLength={72}
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-border bg-background pl-11 pr-12 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                placeholder={mode === "login" ? "Enter your password" : "At least 12 characters"}
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

          {mode === "register" && (
            <>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Confirm password
                </span>
                <span className="relative block">
                  <LockKeyhole
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
                  />
                  <input
                    required
                    minLength={12}
                    maxLength={72}
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-border bg-background pl-11 pr-12 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                    placeholder="Repeat your password"
                  />
                  <button
                    type="button"
                    aria-label={showConfirmPassword ? "Hide confirmed password" : "Show confirmed password"}
                    onClick={() => setShowConfirmPassword((visible) => !visible)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-foreground/5 hover:text-primary"
                  >
                    {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                  Admin setup code
                </span>
                <span className="relative block">
                  <KeyRound
                    size={17}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-primary"
                  />
                  <input
                    required
                    maxLength={256}
                    type={showSignupCode ? "text" : "password"}
                    autoComplete="off"
                    spellCheck={false}
                    value={signupCode}
                    onChange={(event) => setSignupCode(event.target.value)}
                    className="min-h-12 w-full rounded-xl border border-border bg-background pl-11 pr-12 text-sm font-bold text-foreground outline-none transition focus:border-primary"
                    placeholder="Enter the private setup code"
                  />
                  <button
                    type="button"
                    aria-label={showSignupCode ? "Hide setup code" : "Show setup code"}
                    onClick={() => setShowSignupCode((visible) => !visible)}
                    className="absolute right-2 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-foreground/5 hover:text-primary"
                  >
                    {showSignupCode ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
            </>
          )}

          {error && (
            <p
              role="alert"
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-bold text-red-400"
            >
              {error}
            </p>
          )}

          {success && (
            <p
              role="status"
              className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-bold text-emerald-400"
            >
              <CircleCheck size={16} className="mt-0.5 shrink-0" />
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105 disabled:cursor-wait disabled:opacity-60"
          >
            {isSubmitting ? (
              <LoaderCircle size={18} className="animate-spin" />
            ) : mode === "register" ? (
              <UserRoundPlus size={18} />
            ) : (
              <ShieldCheck size={18} />
            )}
            {isSubmitting
              ? mode === "register" ? "Creating profile..." : "Verifying..."
              : mode === "register" ? "Create admin profile" : "Sign in to dashboard"}
          </button>

          {isDevelopment && mode === "login" && (
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
