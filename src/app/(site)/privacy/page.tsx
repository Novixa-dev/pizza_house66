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
    title: t.pages.privacyTitle,
    description: t.pages.privacyLead,
    path: "/privacy",
    locale,
  });
}

export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const locale = await getLocale();
  const t = getDictionary(locale);
  const restaurant = await getRestaurant();
  const name = pick(locale, restaurant.nameAr, restaurant.name);

  return (
    <LegalPage
      title={t.pages.privacyTitle}
      lead={t.pages.privacyLead}
      updated={UPDATED}
      updatedLabel={t.pages.lastUpdated}
    >
      {locale === "ar" ? (
        <>
          <p>
            هذه الصفحة تصف ما يجمعه موقع {name} فعليًا. القاعدة التي بُني عليها: لا نطلب بيانات
            لا يحتاجها الطلب.
          </p>

          <h2>ما نجمعه</h2>
          <ul>
            <li>
              <strong>اسمك ورقم جوالك.</strong> لا يمكن تسليم طلب بلا اسم يُنادى به ورقم يُتصل
              عليه عند الحاجة.
            </li>
            <li>
              <strong>تفاصيل الطلب.</strong> الأصناف، الوقت، المبلغ، وملاحظاتك إن كتبت.
            </li>
            <li>
              <strong>إيصال التحويل</strong> إن اخترت الدفع تحويلًا. يُعرض على موظف المطعم
              للمراجعة فقط.
            </li>
            <li>
              <strong>إحصاءات تصفح مجهولة.</strong> أي الصفحات زُرِرت وأي الأصناف أُضيفت للسلة،
              دون اسم أو رقم مرتبط بها.
            </li>
          </ul>

          <h2>ما لا نجمعه</h2>
          <ul>
            <li>لا نطلب بريدًا إلكترونيًا ولا عنوان سكن ولا تاريخ ميلاد.</li>
            <li>لا نحفظ أي بيانات بطاقة بنكية — الموقع لا يستقبل مدفوعات بالبطاقة أصلًا.</li>
            <li>لا نضع إعلانات ولا متتبعات إعلانية من أطراف أخرى.</li>
          </ul>

          <h2>أين تُحفظ وكم تبقى</h2>
          <p>
            تُحفظ الطلبات في قاعدة بيانات المطعم ما دامت لازمة للسجل التجاري والمحاسبة. تُحذف
            صور الإيصالات بعد مراجعتها بمدة معقولة. أما قائمة «طلباتي» فتُحفظ في متصفحك أنت
            وحدك، ولا نراها ولا نستطيع الوصول إليها، وتختفي إذا مسحت بيانات الموقع.
          </p>

          <h2>من يطّلع عليها</h2>
          <p>
            موظفو المطعم فقط، وكل منهم بحسب دوره: المطبخ يرى الأصناف، والكاشير يرى الدفع، وصاحب
            المطعم يرى الكل. كل اطّلاع على إيصال دفع يُسجَّل باسم الموظف ووقته.
          </p>

          <h2>حقوقك</h2>
          <p>
            تواصل معنا هاتفيًا أو عبر واتساب لطلب نسخة من بياناتك أو حذفها. سنفعل ذلك ما لم يمنعنا
            التزام محاسبي.
          </p>
        </>
      ) : (
        <>
          <p>
            This page describes what the {name} site actually collects. The rule it was built on:
            we do not ask for data the order does not need.
          </p>

          <h2>What we collect</h2>
          <ul>
            <li>
              <strong>Your name and phone number.</strong> An order cannot be handed over without
              a name to call out and a number to ring if something is wrong.
            </li>
            <li>
              <strong>The order itself.</strong> Items, time, amount, and any note you write.
            </li>
            <li>
              <strong>A transfer receipt</strong> if you pay that way. It is shown to a member of
              staff for checking, and nothing else.
            </li>
            <li>
              <strong>Anonymous usage counts.</strong> Which pages were viewed and which items
              were added to a basket, with no name or number attached.
            </li>
          </ul>

          <h2>What we do not collect</h2>
          <ul>
            <li>No email address, home address or date of birth.</li>
            <li>No card details — the site does not take card payments at all.</li>
            <li>No advertising, and no third-party ad trackers.</li>
          </ul>

          <h2>Where it is kept, and for how long</h2>
          <p>
            Orders are stored in the restaurant&rsquo;s own database for as long as its trading and
            accounting records need them. Receipt images are deleted a reasonable time after they
            have been checked. The My orders list is stored in your browser alone — we cannot see
            it or reach it, and it disappears if you clear the site&rsquo;s data.
          </p>

          <h2>Who sees it</h2>
          <p>
            Restaurant staff only, each according to their role: the kitchen sees the items, the
            cashier sees the payment, the owner sees everything. Every time a payment receipt is
            opened, the member of staff and the time are recorded.
          </p>

          <h2>Your rights</h2>
          <p>
            Contact us by phone or WhatsApp to ask for a copy of your data or to have it deleted.
            We will do so unless an accounting obligation prevents it.
          </p>
        </>
      )}
    </LegalPage>
  );
}
