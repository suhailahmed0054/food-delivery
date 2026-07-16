import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

const terms = [
  "Orders are confirmed after checkout is completed.",
  "Delivery timing can vary based on distance, traffic, and kitchen load.",
  "Prices, availability, and offers can change without prior notice.",
  "For dine-in table orders, customers should remain near the selected table until service is completed.",
  "Refunds or cancellations are handled by restaurant support based on order status."
];

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-6 text-foreground">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card transition hover:bg-foreground/5">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black">Terms & Conditions</h1>
          <div className="h-11 w-11" />
        </div>

        <section className="rounded-2xl border border-border bg-card p-6">
          <FileText className="text-primary" size={28} />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            These terms apply to orders placed through the Al-Arab Restaurant website and customer app.
          </p>
          <ul className="mt-6 space-y-3">
            {terms.map((term) => (
              <li key={term} className="rounded-xl border border-border bg-background p-4 text-sm font-semibold text-foreground/90">
                {term}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
