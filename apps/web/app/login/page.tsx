"use client";

import { Suspense } from "react";
import { EmailOtpAuthForm } from "@/components/EmailOtpAuthForm";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <EmailOtpAuthForm source="login" />
    </Suspense>
  );
}
