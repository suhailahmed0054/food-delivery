"use client";

import { Suspense } from "react";
import { EmailOtpAuthForm } from "@/components/EmailOtpAuthForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={null}>
      <EmailOtpAuthForm source="register" />
    </Suspense>
  );
}
