import type { Metadata } from "next";
import { getLocale } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { buildMetadata } from "@/lib/seo";
import { SectionHeading } from "@/components/ui";
import { ChevronIcon } from "@/components/ui/icons";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return buildMetadata({
    title: t.pages.faqTitle,
    description: t.pages.faqLead,
    path: "/faq",
    locale,
  });
}

export default async function FaqPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);

  const faqs = [
    { q: t.faq.q1, a: t.faq.a1 },
    { q: t.faq.q2, a: t.faq.a2 },
    { q: t.faq.q3, a: t.faq.a3 },
    { q: t.faq.q4, a: t.faq.a4 },
    { q: t.faq.q5, a: t.faq.a5 },
    { q: t.faq.q6, a: t.faq.a6 },
    { q: t.faq.q7, a: t.faq.a7 },
  ];

  return (
    <div className="container-page max-w-3xl py-10">
      <SectionHeading level={1} title={t.pages.faqTitle} subtitle={t.pages.faqLead} />

      {/* Native <details>, so the answers open with JavaScript unavailable
          and are in the page for a search engine to read. */}
      <div className="space-y-2.5">
        {faqs.map((faq) => (
          <details
            key={faq.q}
            className="group rounded-[var(--radius)] border border-line bg-surface px-5 open:border-brand/30"
          >
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 font-semibold text-ink">
              {faq.q}
              <ChevronIcon className="shrink-0 text-ink-muted transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:-rotate-90" />
            </summary>
            <p className="pb-5 leading-relaxed text-ink-soft">{faq.a}</p>
          </details>
        ))}
      </div>

      {/* The same questions and answers, in the shape Google reads. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((faq) => ({
              "@type": "Question",
              name: faq.q,
              acceptedAnswer: { "@type": "Answer", text: faq.a },
            })),
          }),
        }}
      />
    </div>
  );
}
