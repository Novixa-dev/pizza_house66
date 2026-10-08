<div align="center">

# Novixa

**نبني برمجيات تحل مشكلة حقيقية — لا عروضًا توضيحية.**

**We build software that solves a real problem — not demos.**

</div>

---

<div dir="rtl">

## من نحن

**نوفكسا** استوديو تطوير برمجيات. نبني منصات ويب وأنظمة تشغيل للأعمال التي
تحتاج أدوات تعمل فعلًا في يوم عملها — لا واجهات جميلة تنهار عند أول طلب حقيقي.

نبدأ من المشكلة قبل أن نبدأ من الكود. نجلس مع صاحب العمل، نفهم كيف يعمل اليوم،
ثم نبني النظام الذي يجعل ذلك اليوم أسهل.

## ما نبنيه

- **منصات الطلب والتشغيل للمطاعم** — طلب مسبق، جدولة الاستلام، شاشة مطبخ،
  لوحة تحكم كاملة
- **لوحات التحكم وأنظمة الإدارة** — صلاحيات دقيقة، سجل تدقيق، تقارير تُقرأ
- **مواقع الأعمال والمتاجر** — عربية أولًا، سريعة، قابلة للأرشفة
- **الأنظمة الداخلية** — ما لا يراه العميل لكنه يشغّل العمل

## كيف نعمل

**العربية أولًا، لا لاحقًا.** كل ما نبنيه يبدأ من اليمين إلى اليسار. الترجمة
ليست طبقة نضيفها في النهاية — هي الأساس، والإنجليزية هي الإضافة.

**الوقت والمال لا يُترَكان للتخمين.** المبالغ أعداد صحيحة لا كسور عشرية.
المواعيد تُحسب بتوقيت المطعم لا بتوقيت الخادم. هذه تفاصيل لا يراها العميل حتى
تُخطئ، ثم يراها فقط.

**الخادم هو المرجع.** السعر يُحسب على الخادم دائمًا. المتصفح يقول ماذا يريد،
لا كم يكلف.

**نذكر الحدود بوضوح.** كل قرار معماري في مشاريعنا مكتوب مع تكلفته. ما لم
يُبنَ يُكتب أنه لم يُبنَ — لا يُترك ليُكتشف لاحقًا.

**نُسلّم موثقًا.** التوثيق جزء من التسليم لا ملحق به: معمارية، قرارات، نشر،
أمان، واختبارات، وقائمة مراجعة للإطلاق.

## للتواصل

مشروع في ذهنك؟ نسعد بالحديث عنه.

</div>

---

## Who we are

**Novixa** is a software studio. We build web platforms and operational
systems for businesses that need tools which hold up on a real working day —
not interfaces that look good and fall over on the first genuine order.

We start from the problem, not the stack. We sit with the owner, learn how
the day actually runs, and build the system that makes that day easier.

## What we build

- **Restaurant ordering and operations platforms** — order-ahead, pickup
  scheduling, kitchen display, a full admin panel
- **Dashboards and management systems** — real permissions, audit trails,
  reports someone actually reads
- **Business sites and storefronts** — Arabic-first, fast, indexable
- **Internal systems** — the part the customer never sees that runs the
  business

## How we work

**Arabic-first, not Arabic-later.** Everything we build starts right-to-left.
Localization is not a layer added at the end — it is the foundation, and
English is the addition.

**Time and money are never left to guesswork.** Amounts are integers, never
floats. Schedules are computed in the business's timezone, never the
server's. These are details nobody notices until they are wrong, and then
they are the only thing anyone notices.

**The server is the authority.** Prices are always computed server-side. The
browser says what it wants, never what it costs.

**We state our limits.** Every architectural decision in our projects is
written down with what it costs. What was not built is recorded as not built,
rather than left to be discovered.

**We hand over documented.** Documentation is part of delivery, not an
appendix to it: architecture, decisions, deployment, security, testing, and a
launch checklist.

---

## Selected work

### 🍕 Pizza House — Digital Ordering & Restaurant Operations

A bilingual ordering platform built around one idea: the customer chooses
**when they want to collect their food**, and the system works backwards to
decide **when the kitchen should start** — so the order is ready as they
arrive, not sitting under a lamp and not still in the oven.

```
 pickup 19:00  −  prep 25 min  =  kitchen starts 18:35
 ────────────────────────────────────────────────────
 16:00  order placed     → confirmed, invisible to the kitchen
 18:35  release          → appears on the kitchen display
 18:58  bagged           → customer notified
 19:00  customer arrives → collected
```

**Built with** Next.js 16 · React 19 · TypeScript · PostgreSQL · Prisma ·
Tailwind CSS v4

**Includes** slot-capacity accounting · timezone-correct scheduling ·
server-authoritative pricing · a 26-permission access matrix · bank-transfer
verification with audited receipt access · a nonce-based CSP · first-party
analytics · 480+ automated tests across unit, integration and end-to-end

---

## Get in touch

Have a project in mind? We would like to hear about it.

<div align="center">

**Novixa** · Building software that works on a Friday night.

</div>
