# النشر على خادم VPS (Contabo) | Deploying to your own server

كل شيء على خادم واحد: التطبيق + قاعدة البيانات + HTTPS تلقائي (Caddy) +
نسخ احتياطي ليلي. أمر واحد يثبّته، وأمر واحد يحدّثه.

*One server, one command to install, one to update: app, Postgres, automatic
HTTPS (Caddy), nightly backups.*

**العنوان:** `https://pizza-house66.novixa.dev` (أو `pizza-house.novixa.dev`
بتغيير `DOMAIN=` أدناه — اسم واحد فقط في كل مرة).

---

## ١. المتطلبات

| | |
|---|---|
| الخادم | Ubuntu 22.04/24.04 أو Debian 12 جديد، **٤ جيجا رام** فأكثر (يُبنى التطبيق على الخادم؛ بأقل من ٣٫٥ جيجا يضيف المثبّت ٢ جيجا swap) |
| الوصول | مستخدم `root` أو `sudo` |
| DNS | سجلّ **A** لـ `pizza-house66` ← عنوان IP الخادم، في مكان إدارة DNS لنطاق `novixa.dev` |
| المنافذ | ٨٠ و٤٤٣ مفتوحة (يفتحها المثبّت في `ufw`؛ وإن كانت لوحة Contabo تحجبها فافتحها منها أيضًا) |

> إن كان النطاق عند Cloudflare فاجعل السجلّ **DNS only** (سحابة رمادية) أثناء
> أول تثبيت؛ يمكن تفعيل الوكيل بعد صدور الشهادة.

## ٢. جلب الكود (المستودع خاص)

على الخادم، بمفتاح **قراءة فقط** يخصّ هذا المستودع:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/pizza_deploy -N "" -C pizza-house66-vps
cat ~/.ssh/pizza_deploy.pub
#  ← GitHub: Novixa-dev/pizza_house66 → Settings → Deploy keys → Add (اتركه Read-only)
printf 'Host github.com\n  IdentityFile ~/.ssh/pizza_deploy\n  IdentitiesOnly yes\n' >> ~/.ssh/config

git clone git@github.com:Novixa-dev/pizza_house66.git /opt/pizza-house
cd /opt/pizza-house
# قبل دمج الطلب #2 في main، استخدم الفرع الذي فيه العمل:
git checkout claude/lucid-bohr-kmmyyp
```

## ٣. التثبيت

```bash
sudo ADMIN_EMAIL=you@example.com ADMIN_NAME="اسمك" bash deploy/install.sh
# نطاق آخر:  DOMAIN=pizza-house.novixa.dev
```

المثبّت (آمن لإعادة التشغيل):

1. يثبّت Docker إن لم يكن موجودًا.
2. **يتحقق أن النطاق يشير إلى هذا الخادم** وإلا يتوقف — بدل أن يستنفد محاولات
   Let's Encrypt على اسم لا يمكن إثباته.
3. يفعّل جدار `ufw` (SSH و٨٠ و٤٤٣ فقط)، ويضيف swap عند الحاجة.
4. يولّد الأسرار في `deploy/.env` (صلاحية ٦٠٠) **مرة واحدة** ولا يكتب فوقها.
5. يبني التطبيق ويشغّله (قاعدة بيانات + تطبيق + Caddy + مُجدوِل الطلبات).
6. أول مرة فقط: ينشئ **حساب المالك** بكلمة مرور عشوائية تُعرض **مرة واحدة**،
   ويبدأ **الطلب موقوفًا** (انظر أدناه).
7. يجدول نسخة احتياطية ليلية (٠٣:١٠) ويشغّل فحص الدخان على الموقع.

### لماذا يبدأ الطلب موقوفًا
قاعدة البيانات الجديدة تحمل القائمة المبدئية (١٦ صنفًا من النموذج الأوّلي)، لا
قائمة المطعم (~١٨٤) وأسعارها تختلف عنها. زبون يطلب منها يُحاسَب بأسعار لم
يوافق عليها المطعم. حمّل القائمة الحقيقية ([`MENU-IMPORT.md`](MENU-IMPORT.md))
ثم اضغط «استئناف» في ترويسة لوحة الإدارة. للتشغيل فورًا رغم ذلك: `OPEN_ORDERING=1`.

## ٤. بعد التثبيت — بالترتيب

1. ادخل `https://pizza-house66.novixa.dev/admin` بحساب المالك، وغيّر كلمة المرور.
2. أنشئ حسابات الموظفين الحقيقية: **الإدارة ← الموظفون** (أو
   `docker compose exec app npm run staff:create -- --email … --name … --role CASHIER`).
3. حمّل القائمة الحقيقية، وأكّد ساعة الإغلاق (٢٣:٠٠ أم ٢٣:٣٠).
4. اضغط «استئناف الطلب».
5. **انسخ النسخ الاحتياطية خارج الخادم** (قسم ٦).
6. جرّب بطلب حقيقي صغير: [`TEST-GUIDE.md`](TEST-GUIDE.md).

## ٥. التشغيل اليومي

```bash
cd /opt/pizza-house
sudo bash deploy/update.sh        # نسخة احتياطية ← سحب الكود ← بناء ← تشغيل ← فحص
sudo bash deploy/rollback.sh      # العودة للصورة السابقة (قاعدة البيانات لا تتراجع)
cd deploy && docker compose ps    # الحالة
docker compose logs -f app        # سجلّ التطبيق   (caddy / db / scheduler كذلك)
```

القائمة والأسعار والموظفون تُغيَّر من لوحة الإدارة أو المستورِد فقط. **إعادة
تشغيل الخادم أو التطبيق لا تمسّ بياناتك**: التهيئة الأولى تجري مرة واحدة على
قاعدة فارغة (`npm run db:bootstrap`؛ السبب في
`src/server/bootstrap.ts`).

## ٦. النسخ الاحتياطي

- **تلقائي:** كل ليلة `deploy/backups/pizzahouse-*.dump` (يُحتفظ بآخر ٣٠)، ويُفحَص
  كل ملف بقراءته قبل اعتماده.
- **يدوي:** `sudo bash deploy/backup.sh`
- **الاسترجاع:** `sudo bash deploy/restore.sh deploy/backups/<ملف>` — يحفظ نسخة من
  الحالة الحالية أولًا.
- **خارج الخادم (ضروري):** نسخة على نفس الخادم لا تحمي من فقدان الخادم. من
  حاسوبك مثلًا: `scp root@SERVER:/opt/pizza-house/deploy/backups/pizzahouse-*.dump ./` ،
  أو فعّل لقطات Contabo (Snapshots) من لوحتهم.

## ٧. الأمان — ما هو مكشوف وما لا

| | |
|---|---|
| مكشوف | المنفذان ٨٠/٤٤٣ (Caddy فقط) + SSH |
| غير مكشوف | Postgres والتطبيق: على شبكة Docker الداخلية فقط |
| الأسرار | `deploy/.env` بصلاحية ٦٠٠، خارج git |
| IP الزبون | Caddy يستبدل `X-Forwarded-For` بالعنوان الحقيقي، وهو ما يقرؤه محدِّد المعدّل |
| موصى به | دخول SSH بمفتاح فقط (`PasswordAuthentication no`)، و`apt install fail2ban unattended-upgrades` |

## ٨. أعطال شائعة

| العَرَض | السبب والحلّ |
|---|---|
| المثبّت: «does not resolve yet» | سجلّ A غير منشور بعد؛ انتظر دقائق وأعد التشغيل |
| الموقع لا يفتح بـHTTPS | `docker compose logs caddy` — غالبًا DNS خاطئ أو ٨٠/٤٤٣ محجوبان في لوحة Contabo |
| التطبيق «unhealthy» | `docker compose logs --tail 100 app` — فشل ترحيل أو اتصال قاعدة |
| تغيير `DB_PASSWORD` بعد التشغيل | لا يغيّر كلمة المرور **داخل** قاعدة قائمة؛ غيّرها بـ`ALTER USER pizza PASSWORD '…'` ثم في `.env` |
| الصور بلا ظهور | الخادم يجلب صور Unsplash/Wikimedia؛ تحقق من خروج الشبكة |
