# My-Class-Track

<div dir="rtl">

## معرفی

**My-Class-Track** یک اپ وب پیشرفته (PWA) فارسی و راست‌به‌چپ برای **مسئولان پیگیری یک کلاس گروه‌درمانی هفتگی** است.

این برنامه کارهای تکراری و پرتنش پیگیری کلاس را ساده می‌کند:

- **پیگیری حضور در دو نوبت** — نوبت ۱ (پیش‌تماس) با فهرست تماس، و نوبت ۲ (پشت در) با ثبت یک‌لمسی
- **یادآور زمان پشت در** — آلارم صوتی، ویبره و پیام بزرگ در ۱۵ / ۸ / ۵ / ۳ دقیقه مانده به شروع کلاس
- **گزارش آماده واتساپ** برای حامی‌ها (حضور و شهریه)
- **پیگیری شهریه** هر جلسه به‌صورت جداگانه، با هشدار نزدیک شروع کلاس
- **تکالیف هفتگی** با متن آماده کپی برای واتساپ
- **تولدهای نزدیک** و خلاصه وضعیت کلاس در صفحه خانه

برنامه کاملاً **کلاینت‌ساید و آفلاین** است؛ بک‌اند ندارد، داده‌ها روی همان دستگاه ذخیره می‌شوند و پس از نصب، بدون اینترنت هم کار می‌کند.

---

## ویژگی‌ها

| بخش | توضیح |
|---|---|
| **حضور** | دو نوبت مستقل با وضعیت‌های حاضر / تأخیر (با ساعت) / غایب (با علت) / مشکل (با توضیح) |
| **حالت پشت در** | تمام‌صفحه، کنتراست بالا، دکمه‌های ۶۶ پیکسلی و ثبت با یک لمس |
| **تایمر پشت در** | شمارش معکوس مقاوم به قفل صفحه، آلارم در ۱۵/۸/۵/۳ دقیقه و لحظه صفر |
| **شهریه** | وضعیت پرداخت هر جلسه، تاریخ پرداخت شمسی و یادداشت فیش |
| **تکالیف** | ثبت با تاریخ شمسی، آرشیو قابل جستجو و متن واتساپ |
| **اعضا** | نام، تماس، تاریخ تولد شمسی، نقش‌ها، آرشیو دوره‌ها |
| **گزارش** | متن فارسی مرتب، کپی، اشتراک‌گذاری، CSV سازگار با اکسل و چاپ PDF |
| **پشتیبان** | خروجی و بازیابی کامل JSON با تأیید دولایه |
| **تقویم** | تقویم شمسی دقیق با انتخابگر لمس‌پسند، همه اعداد فارسی |

---

## نصب و اجرا

برنامه با ماژول‌های ES نوشته شده، پس باید از طریق یک سرور وب اجرا شود (باز کردن مستقیم فایل با `file://` کار نمی‌کند).

### اجرای محلی

```powershell
cd "My-Class-Track"
python -m http.server 8777
```

سپس در مرورگر باز کنید: <http://localhost:8777>

> اگر پایتون ندارید، می‌توانید از `npx serve .` یا هر سرور ساکن دیگری استفاده کنید.

### نصب روی اندروید

1. سایت منتشرشده را در **Chrome** باز کنید.
2. از منو ⋮ گزینه **Add to Home screen** (یا **Install app**) را بزنید.
3. برنامه با نام و آیکون **My-Class-Track** نصب می‌شود و تمام‌صفحه اجرا می‌شود.

پس از نصب، برنامه **کاملاً آفلاین** کار می‌کند.

---

## انتشار روی GitHub Pages

ورک‌فلوی `.github/workflows/pages.yml` به‌صورت خودکار شاخه `main` را منتشر می‌کند.

1. کد را به مخزن `majidsb1982/My-Class-Track` push کنید.
2. در GitHub به **Settings → Pages** بروید.
3. در بخش **Build and deployment**، منبع را روی **GitHub Actions** تنظیم کنید.
4. پس از اجرای ورک‌فلو، آدرس سایت در همان صفحه نمایش داده می‌شود.

---

## ساختار پروژه

```
My-Class-Track/
├─ index.html              اسکلت برنامه
├─ offline.html            صفحه آفلاین
├─ manifest.webmanifest    تعریف PWA
├─ sw.js                   سرویس‌ورکر (کش نسخه‌دار)
├─ icons/                  آیکون‌های PNG و SVG
├─ tools/
│  └─ build-icons.mjs      تولید آیکون‌های PNG بدون وابستگی
└─ src/
   ├─ styles.css           Design System، تم روشن/تیره، استایل چاپ
   ├─ jalali.js            تقویم شمسی (تبدیل دوطرفه، فرمت، پارس)
   ├─ store.js             لایه داده روی localStorage (نسخه‌بندی و مهاجرت)
   ├─ ui.js                ابزارهای DOM، کامپوننت‌ها، تقویم شمسی
   ├─ reports.js           تولید متن گزارش و فایل CSV
   ├─ timer.js             تایمر پشت در و آلارم‌ها
   ├─ app.js               روتر، بوت‌استرپ، تم، سرویس‌ورکر
   └─ pages/
      ├─ home.js           صفحه خانه
      ├─ attendance.js     صفحه حضور (نوبت ۱)
      ├─ door.js           حالت پشت در (نوبت ۲)
      ├─ payment.js        شهریه
      ├─ homework.js       تکالیف
      ├─ members.js        اعضا
      └─ settings.js       تنظیمات و پشتیبان‌گیری
```

---

## فناوری‌ها

- **بدون فریم‌ورک و بدون Build** — جاوااسکریپت خالص با ES Modules
- **بدون node_modules** — تنها وابستگی، فونت Vazirmatn از CDN است که در نبود اینترنت به فونت سیستمی برمی‌گردد
- **بدون بک‌اند** — همه داده‌ها در `localStorage` ذخیره می‌شوند
- **PWA** — قابل نصب روی اندروید و کارکرد کامل آفلاین
- **تقویم شمسی** — پیاده‌سازی مستقل الگوریتم jalaali با ۱۶ تست داخلی

---

## نکات مهم

- **داده‌ها فقط روی همین دستگاه ذخیره می‌شوند.** با پاک کردن داده‌های مرورگر یا تعویض گوشی از بین می‌روند.
- **پشتیبان JSON را مرتب بگیرید** — از تنظیمات → «دریافت فایل پشتیبان». پیش از پاک کردن حافظه یا تعویض گوشی حتماً یک فایل بگیرید.
- **آلارم صوتی** فقط پس از اولین لمس در برنامه فعال می‌شود (محدودیت مرورگرها)؛ دکمه شروع تایمر همین لمس را انجام می‌دهد.
- **مجوز اعلان** برای یادآوری روی صفحه قفل لازم است و از صفحه تایمر قابل فعال‌سازی است.

---

## توسعه

ابزار تولید آیکون‌های PNG (بدون هیچ وابستگی، فقط Node):

```powershell
node tools/build-icons.mjs
```

پس از هر تغییر در کش سرویس‌ورکر، مقدار `VERSION` در `sw.js` را افزایش دهید تا کاربران نسخه جدید را دریافت کنند.

</div>

---

## English summary

**My-Class-Track** is a Persian (RTL) Progressive Web App for the volunteers who track attendance, tuition and weekly homework in a group-therapy class.

**Highlights**

- Two-round attendance tracking: a pre-call list with dial buttons, and a full-screen "at the door" mode with one-tap status buttons
- Door countdown timer with sound, vibration and a large Persian message at 15 / 8 / 5 / 3 minutes before class start
- Per-session tuition tracking with an imminent-class warning
- Ready-to-send WhatsApp reports, Excel-friendly CSV export (UTF-8 BOM) and clean print/PDF output
- Full Jalali (Solar Hijri) calendar with a touch-friendly date picker and Persian digits everywhere
- Backup and restore of all data as JSON, with two-step confirmation for destructive actions
- Installable on Android and fully functional offline — no backend, no dependencies, no build step

**Tech**: vanilla JavaScript (ES modules), modern CSS with light/dark themes, service worker with a versioned cache, and a dependency-free Jalali calendar implementation with 16 built-in correctness tests.

**Note**: all data lives in `localStorage` on the device. Export a JSON backup regularly, especially before clearing browser data or switching phones.