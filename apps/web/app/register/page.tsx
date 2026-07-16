"use client";

import type { FormEvent } from "react";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { registerAccount } from "@/lib/api";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const auth = await registerAccount(name, email, password);
      window.localStorage.removeItem("al-arab-auth");
      window.localStorage.setItem("al-arab-user", JSON.stringify(auth.user));
      router.replace("/profile");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to create account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden p-4">
      <Image
        src="/images/al-arab-hero.png"
        alt=""
        fill
        priority
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/70" />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl">
        <h1 className="text-center text-4xl font-black text-black">Create Account</h1>
        <p className="mt-2 text-center font-medium text-gray-800">Join Al-Arab Restaurant</p>

        <form className="mt-8 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-bold text-gray-800">
            Full name
            <input
              required
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="mt-1 h-12 w-full rounded-lg border border-gray-400 px-4 text-black focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
          </label>

          <label className="block text-sm font-bold text-gray-800">
            Email address
            <input
              required
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 h-12 w-full rounded-lg border border-gray-400 px-4 text-black focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
            />
          </label>

          <label className="block text-sm font-bold text-gray-800">
            Password
            <input
              required
              type="password"
              minLength={8}
              maxLength={72}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 h-12 w-full rounded-lg border border-gray-400 px-4 text-black focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
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
            className="h-12 w-full rounded-lg bg-[#d4af37] font-bold text-black transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-gray-800">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-[#8a6f00] hover:underline">
            Login
          </Link>
        </p>
      </div>
    </main>
  );
}
