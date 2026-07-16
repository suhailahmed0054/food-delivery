import Link from "next/link";
import { ArrowLeft, CircleHelp } from "lucide-react";

const faqs = [
  {
    question: "How do I place an order?",
    answer: "Open the menu, add your dishes to the cart, choose a delivery address, and confirm the order from checkout."
  },
  {
    question: "Can I order half or full portions?",
    answer: "Yes. Items with multiple portions ask you to choose the portion before adding them to the cart."
  },
  {
    question: "How can I track my order?",
    answer: "Use My Orders or Track Order from the profile menu to view the latest order status."
  },
  {
    question: "What if I need help after ordering?",
    answer: "Use Help & Support from the profile menu to call or message the restaurant support team."
  }
];

export default function FaqsPage() {
  return (
    <main className="min-h-screen bg-background px-5 py-6 text-foreground">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link href="/" className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card transition hover:bg-foreground/5">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-2xl font-black">FAQs</h1>
          <div className="h-11 w-11" />
        </div>

        <div className="space-y-4">
          {faqs.map((faq) => (
            <article key={faq.question} className="rounded-2xl border border-border bg-card p-5">
              <div className="flex items-start gap-3">
                <CircleHelp className="mt-1 shrink-0 text-primary" size={20} />
                <div>
                  <h2 className="text-lg font-black">{faq.question}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{faq.answer}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
