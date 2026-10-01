import type { Metadata } from "next";
import { getLocale, pick } from "@/lib/i18n/locale";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { getRestaurant } from "@/server/restaurant";
import { buildMetadata } from "@/lib/seo";
import { LegalPage } from "@/components/legal-page";

const UPDATED = "2026-09-30";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getDictionary(locale);
  return buildMetadata({
    title: t.pages.termsTitle,
    description: t.pages.termsLead,
    path: "/terms",
    locale,
  });
}

export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const name = pick(locale, restaurant.nameAr, restaurant.name);

  return (
    <LegalPage
      title={t.pages.termsTitle}
      lead={t.pages.termsLead}
      updated={UPDATED}
      updatedLabel={t.pages.lastUpdated}
    >
      {locale === "ar" ? (
        <>
          <p>
            باستخدامك هذا الموقع لطلب الطعام من {name} فإنك توافق على الشروط أدناه. هي مكتوبة
            لتكون مفهومة، لا لتحمي المطعم من زبائنه.
          </p>

          <h2>الطلب والاستلام</h2>
          <ul>
            <li>الطلب عبر الموقع هو طلب استلام من المطعم. لا نقدّم توصيلًا عبر هذا الموقع.</li>
            <li>
              وقت الاستلام الذي تختاره هو وعد نحاول الالتزام به، ولا يُعرض عليك وقت لا يستطيع
              المطبخ الوفاء به. قد يتأخر الطلب في أوقات الضغط، ونعتذر عن ذلك سلفًا.
            </li>
            <li>
              يُحفظ طلبك باسمك ورقم جوالك. إن تأخرت عن موعدك تواصل معنا وسنرتّب الاستلام.
            </li>
          </ul>

          <h2>الأسعار والدفع</h2>
          <ul>
            <li>الأسعار بالريال اليمني، وتشمل ما هو معروض في صفحة المنتج.</li>
            <li>
              تُحتسب قيمة الطلب على الخادم لحظة تأكيده، لا في متصفحك. المبلغ الظاهر في صفحة
              التأكيد هو المبلغ المستحق.
            </li>
            <li>
              عند اختيار التحويل، لا يبدأ التحضير قبل مراجعة الإيصال من موظف المطعم.
            </li>
          </ul>

          <h2>الكوبونات والعروض</h2>
          <ul>
            <li>لكل كوبون شروطه المعروضة بجانبه: حد أدنى للطلب، أو سقف للخصم، أو تاريخ انتهاء.</li>
            <li>
              الكوبون الممنوح لك شخصيًا مرتبط برقم جوالك ويُستخدم مرة واحدة. لا يعمل مع رقم آخر.
            </li>
            <li>لا يُجمع أكثر من كوبون على الطلب الواحد.</li>
            <li>
              للمطعم أن يوقف أي عرض في أي وقت. الطلبات التي اكتملت قبل الإيقاف لا تتأثر.
            </li>
          </ul>

          <h2>الإلغاء</h2>
          <p>
            يمكنك إلغاء الطلب ما لم يكن المطبخ قد بدأ تحضيره. بعد ذلك تواصل معنا هاتفيًا ونتصرف
            حسب الحالة.
          </p>

          <h2>الحساب والبيانات</h2>
          <p>
            لا يتطلب الطلب إنشاء حساب. ما نحتفظ به وكيف، موضح في{" "}
            <a href="/privacy" className="inline-flex min-h-6 items-center font-semibold text-brand underline underline-offset-4">
              سياسة الخصوصية
            </a>
            .
          </p>
        </>
      ) : (
        <>
          <p>
            By using this site to order from {name}, you agree to the terms below. They are
            written to be understood, not to protect the restaurant from its customers.
          </p>

          <h2>Ordering and collection</h2>
          <ul>
            <li>An order through this site is a collection order. We do not deliver through it.</li>
            <li>
              The pickup time you choose is a promise we try to keep, and you are never offered a
              time the kitchen cannot meet. Busy evenings can still run late, and we are sorry in
              advance when they do.
            </li>
            <li>
              Your order is held under your name and phone number. If you are late, contact us and
              we will arrange collection.
            </li>
          </ul>

          <h2>Prices and payment</h2>
          <ul>
            <li>Prices are in Yemeni rial and include what the product page shows.</li>
            <li>
              Totals are calculated on the server when you confirm, not in your browser. The
              amount on the confirmation page is the amount due.
            </li>
            <li>
              When paying by transfer, preparation does not begin until a member of staff has
              checked the receipt.
            </li>
          </ul>

          <h2>Coupons and offers</h2>
          <ul>
            <li>
              Every coupon carries its own conditions, shown beside it: a minimum order, a cap on
              the discount, or an expiry date.
            </li>
            <li>
              A coupon issued to you personally is tied to your phone number and works once. It
              will not work on another number.
            </li>
            <li>Only one coupon applies per order.</li>
            <li>
              The restaurant may end any offer at any time. Orders already placed are unaffected.
            </li>
          </ul>

          <h2>Cancellation</h2>
          <p>
            You can cancel while the kitchen has not started your order. After that, call us and we
            will do what we can.
          </p>

          <h2>Accounts and data</h2>
          <p>
            Ordering needs no account. What we keep, and how, is set out in the{" "}
            <a href="/privacy" className="inline-flex min-h-6 items-center font-semibold text-brand underline underline-offset-4">
              privacy policy
            </a>
            .
          </p>
        </>
      )}
    </LegalPage>
  );
}
