import Link from "next/link";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const privacyItems = [
  "We use your name, phone number, and delivery address only to place and deliver orders.",
  "Order history is stored locally in this demo app so the admin dashboard can show live orders.",
  "Location access is optional and used only when you choose to detect your delivery location.",
  "Payment data is handled by the selected payment provider and is not stored in this app."
];

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-6 text-foreground">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card transition hover:bg-foreground/5">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black">Privacy Policy</h1>
          <div className="h-11 w-11" />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <ShieldCheck className="text-primary" size={30} />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Your personal details should be used only to complete restaurant ordering, support, and delivery workflows.
          </p>
          <div className="mt-6 space-y-3">
            {privacyItems.map((item) => (
              <p key={item} className="rounded-xl border border-border bg-background p-4 text-sm font-semibold text-foreground/90">
                {item}
              </p>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
