# My-Class-Track

[![CI](https://github.com/majidsb1982/My-Class-Track/actions/workflows/ci.yml/badge.svg)](https://github.com/majidsb1982/My-Class-Track/actions/workflows/ci.yml)
[![Deploy](https://github.com/majidsb1982/My-Class-Track/actions/workflows/pages.yml/badge.svg)](https://github.com/majidsb1982/My-Class-Track/actions/workflows/pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-5b5bd6.svg)](LICENSE)
[![PWA](https://img.shields.io/badge/PWA-installable-158a5a.svg)](#نصب-روی-گوشی)
[![Dependencies](https://img.shields.io/badge/dependencies-0-158a5a.svg)](#-تصمیمهای-فنی)

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
- **روند حضور و سابقه هر عضو** — نمودار جلسات اخیر و کارنامه حضور هر نفر
- **عکس و آواتار اعضا** — عکس هر عضو با کوچک‌سازی خودکار، و در نبود عکس دایره رنگی با حروف اول نام
- **یادآور زمان و مکان** — با آلارم، ویبره و پیام تمام‌صفحه سر وقت
- **ضبط صدا** — پیوست یادداشت صوتی به وضعیت حضور هر عضو، تا یک دقیقه

برنامه کاملاً **کلاینت‌ساید و آفلاین** است؛ بک‌اند ندارد، داده‌ها روی همان دستگاه ذخیره می‌شوند و پس از نصب، بدون اینترنت هم کار می‌کند.

---

## ویژگی‌ها

| بخش | توضیح |
|---|---|
| **حضور** | دو نوبت مستقل با وضعیت‌های حاضر / تأخیر (با ساعت) / غایب (با علت) / مشکل (با توضیح) |
| **حالت پشت در** | تمام‌صفحه، کنتراست بالا، دکمه‌های ۶۶ پیکسلی، ثبت با یک لمس و دکمه «همه حاضرند» |
| **تایمر پشت در** | شمارش معکوس مقاوم به قفل صفحه، آلارم در ۱۵/۸/۵/۳ دقیقه و لحظه صفر |
| **روند حضور** | نمودار جلسات اخیر و مجموع حاضر/تأخیر/غایب/مشکل |
| **سابقه عضو** | کارنامه هر عضو با درصد حضور و تاریخچه جلسه‌به‌جلسه |
| **شهریه** | وضعیت پرداخت هر جلسه، تاریخ پرداخت شمسی و یادداشت فیش |
| **تکالیف** | ثبت با تاریخ شمسی، آرشیو قابل جستجو و متن واتساپ |
| **اعضا** | عکس/آواتار، نام، دو شماره تماس، نشانی، تاریخ تولد شمسی، نقش‌ها، آرشیو دوره‌ها |
| **یادآورها** | یادآور زمان و مکان با آلارم، ویبره و پیام تمام‌صفحه؛ انجام‌شده‌ها آرشیو می‌شوند |
| **ضبط صدا** | یادداشت صوتی تا یک دقیقه روی وضعیت هر عضو، با پخش و حذف |
| **گزارش** | متن فارسی مرتب، کپی، اشتراک‌گذاری، CSV سازگار با اکسل و چاپ PDF |
| **پشتیبان** | خروجی و بازیابی کامل JSON با تأیید دولایه |
| **تقویم** | تقویم شمسی دقیق با انتخابگر لمس‌پسند، همه اعداد فارسی |

---

## کیفیت و بررسی‌های خودکار

پروژه سه بررسی دارد که **هیچ وابستگی npm** لازم ندارند:

```bash
node tools/check-project.mjs   # ساختار فایل‌ها، سینتکس، پیش‌کش، گردش کامل داده
node tools/check-html.mjs      # تگ‌های PWA و manifest
node tools/smoke.mjs           # تست مرورگر واقعی با Chrome (آفلاین، تم، تقویم، پشت در)
```

بررسی اول و دوم روی هر push و PR در GitHub Actions اجرا می‌شوند (`.github/workflows/ci.yml`).
بررسی سوم به Chrome نیاز دارد و برای اجرای محلی در نظر گرفته شده است.

---

## اجرای برنامه

> **نکته:** این برنامه فایل نصب (`.exe` یا `.apk`) ندارد و از ابتدا این‌طور ساخته شده.
> یک **PWA** است: یعنی یک برنامه وب که در گوشی مثل برنامه نصب می‌شود و بدون اینترنت کار می‌کند.
> این طراحی عمدی است: حجم بسیار کمتر، بروزرسانی خودکار، و بدون نیاز به نصب هیچ چیزی روی گوشی.

### روش ۱ — یک‌دستی روی کامپیوتر (توصیه‌شده)

فایل `run.py` را کنار پروژه گذاشته‌ایم. کافی است:

```powershell
python run.py
```

مرورگر خودکار باز می‌شود و برنامه روی <http://localhost:8777> در دسترس است.
برای توقف، در همان پنجره `Ctrl+C` بزنید یا پنجره را ببندید.

### روش ۲ — بسته قابل‌حمل (بدون نصب، قابل انتقال)

اگر می‌خواهید برنامه را روی کامپیوتر دیگری هم اجرا کنید:

```powershell
python build-portable.py
```

سپس فایل `dist/My-Class-Track-v1.0.0-portable.zip` ساخته می‌شود. آن را از حالت فشرده خارج کنید و **شروع.bat** را دابل‌کلیک کنید. (در macOS/Linux فایل `start.sh` را اجرا کنید.)

> پیش‌نیاز هر دو روش: **Python 3** از [python.org](https://python.org) نصب شده باشد و گزینه *Add python.exe to PATH* تیک خورده باشد.

### روش ۳ — با Node.js (اگر Node دارید)

```powershell
npx serve . -l 8777
```

### روش ۴ — باز کردن مستقیم فایل

کار **نمی‌کند**. ماژول‌های ES برای اجرا به یک سرور وب نیاز دارند و از طریق `file://` بارگذاری نمی‌شوند.

### استفاده در گوشی

سرور کامپیوتر شما فقط روی همان کامپیوتر در دسترس است. برای استفاده در گوشی، یکی از این دو راه را انتخاب کنید:

1. **پیشنهادی — انتشار روی اینترنت:** کد را به GitHub بفرستید تا روی GitHub Pages منتشر شود، سپس نشانی سایت را در گوشی باز کنید و آن را نصب کنید (بخش انتشار پایین همین فایل).
2. **شبکه محلی:** هنگام اجرای برنامه با گزینه `--host 0.0.0.0` آن را در شبکه باز کنید:
   ```powershell
   python run.py --host 0.0.0.0
   ```
   سپس نشانی IP کامپیوترتان (مثلاً `http://192.168.1.5:8777`) را در گوشی وارد کنید. گوشی و کامپیوتر باید به یک وای‌فای وصل باشند.

---

## نصب روی اندروید

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
├─ sw.js                   سرویس‌ورکر (کش نسخه‌دار + اعلان به‌روزرسانی)
├─ run.py                  سرور محلی برای اجرا با یک دستور
├─ build-portable.py       ساخت بسته قابل‌حمل ویندوز
├─ icons/                  آیکون‌های PNG و SVG
├─ tools/
│  ├─ check-project.mjs    بررسی ساختار، سینتکس، پیش‌کش و گردش داده
│  ├─ check-html.mjs       بررسی تگ‌های PWA و manifest
│  ├─ smoke.mjs            تست مرورگر واقعی با Chrome
│  └─ build-icons.mjs      تولید آیکون‌های PNG بدون وابستگی
├─ .github/
│  └─ workflows/
│     ├─ ci.yml            اجرای بررسی‌ها روی هر push و PR
│     └─ pages.yml         انتشار روی GitHub Pages
└─ src/
   ├─ styles.css           Design System، تم روشن/تیره، استایل چاپ
   ├─ jalali.js            تقویم شمسی (تبدیل دوطرفه، فرمت، پارس)
   ├─ prefs.js             تنظیمات کاربر (تنها نویسنده mct:prefs)
   ├─ media.js             آواتار (کوچک‌سازی تصویر) و ضبط صدا
   ├─ reminders.js         صفحه و زمان‌بند یادآورها
   ├─ store.js             لایه داده روی localStorage (نسخه‌بندی و مهاجرت)
   ├─ ui.js                ابزارهای DOM، کامپوننت‌ها، تقویم شمسی
   ├─ reports.js           تولید متن گزارش و فایل CSV
   ├─ timer.js             تایمر پشت در و آلارم‌ها
   ├─ app.js               روتر، بوت‌استرپ، تم، سرویس‌ورکر
   └─ pages/
      ├─ home.js           صفحه خانه و شمارش معکوس
      ├─ attendance.js     حضور نوبت ۱ + روند جلسات
      ├─ door.js           حالت پشت در (نوبت ۲)
      ├─ payment.js        شهریه
      ├─ homework.js       تکالیف
      ├─ members.js        اعضا، نقش‌ها، سابقه عضو
      ├─ reminders.js      یادآورهای زمان و مکان
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

ابزارهای کمکی (فقط با Node یا Python اجرا می‌شوند و به برنامه وارد نمی‌شوند):

```powershell
# تولید آیکون‌های PNG (بدون هیچ وابستگی)
node tools/build-icons.mjs

# بررسی سلامت پروژه: فایل‌ها، نحو، پیش‌کش، manifest، تست تقویم و گردش داده
node tools/check-project.mjs

# بررسی تگ‌های PWA در index.html و manifest
node tools/check-html.mjs

# تست مرورگر واقعی (نیازمند Chrome نصب‌شده)
node tools/smoke.mjs

# ساخت بسته قابل‌حمل ZIP
python build-portable.py
```

پس از هر تغییر در کش سرویس‌ورکر، مقدار `VERSION` در `sw.js` را افزایش دهید تا کاربران نسخه جدید را دریافت کنند.

---

## مشارکت و مجوز

قوانین پروژه، راه‌اندازی محیط و دستورهای بررسی در [CONTRIBUTING.md](CONTRIBUTING.md) آمده است.
برای گزارش آسیب‌پذیری امنیتی، لطفاً از [SECURITY.md](SECURITY.md) استفاده کنید و آن را در Issue عمومی نگذارید.

این پروژه تحت مجوز [MIT](LICENSE) منتشر شده است.

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
- Attendance trends across recent sessions, plus a per-member history view with an attendance rate
- Backup and restore of all data as JSON, with two-step confirmation for destructive actions
- Installable on Android and fully functional offline — no backend, no dependencies, no build step

**Quality gates**: `tools/check-project.mjs` (structure, syntax, precache integrity, calendar self-test and a full data round-trip against an in-memory storage shim), `tools/check-html.mjs` (PWA markup) and `tools/smoke.mjs` (a real-Chrome end-to-end pass). The first two run on every push and pull request via GitHub Actions.

**Tech**: vanilla JavaScript (ES modules), modern CSS with light/dark themes, service worker with a versioned cache, and a dependency-free Jalali calendar implementation with 16 built-in correctness tests.

**Note**: all data lives in `localStorage` on the device. Export a JSON backup regularly, especially before clearing browser data or switching phones.