/* ============================================================
   src/app.js — Router, bootstrap, theme, service worker
   Phase 1: shell + navigation + theme + empty pages.
   Phase 2: Jalali calendar wired in (self-test + demo).
   ============================================================ */

import { el, clear, icon, hydrateStaticIcons, toast, confirmDialog, emptyState, pageHead } from './ui.js';
import { runSelfTest } from './jalali.js';

/* ---------- Routes ---------- */

const ROUTES = [
  { id: 'home', label: 'خانه', icon: 'home', title: 'خانه', subtitle: 'نمای کلی کلاس و کارهای امروز' },
  { id: 'attendance', label: 'حضور', icon: 'attendance', title: 'حضور', subtitle: 'پیگیری حضور در دو نوبت' },
  { id: 'payment', label: 'شهریه', icon: 'payment', title: 'شهریه', subtitle: 'وضعیت پرداخت هر جلسه' },
  { id: 'homework', label: 'تکالیف', icon: 'homework', title: 'تکالیف', subtitle: 'تکلیف هر هفته و آرشیو' },
  { id: 'members', label: 'اعضا', icon: 'members', title: 'اعضا', subtitle: 'فهرست اعضا و نقش‌ها' },
  { id: 'settings', label: 'تنظیمات', icon: 'settings', title: 'تنظیمات', subtitle: 'کلاس، تم و پشتیبان‌گیری' },
];

const DEFAULT_ROUTE = 'home';

/* Per-route empty-state configuration (phase 1 placeholders). */
const PLACEHOLDERS = {
  home: {
    icon: 'sparkles',
    title: 'به My-Class-Track خوش آمدید',
    text: 'اینجا خلاصه کلاس، کلاس بعدی، تولدهای نزدیک و میان‌برهای سریع نمایش داده می‌شود.',
    actionLabel: 'شروع از اعضا',
    actionRoute: 'members',
  },
  attendance: {
    icon: 'attendance',
    title: 'هنوز عضوی ثبت نشده است',
    text: 'برای پیگیری حضور، ابتدا اعضای کلاس را اضافه کنید.',
    actionLabel: 'افزودن اعضا',
    actionRoute: 'members',
  },
  payment: {
    icon: 'payment',
    title: 'وضعیت شهریه‌ای ثبت نشده',
    text: 'با ثبت اعضا و جلسات، وضعیت پرداخت شهریه هر جلسه اینجا نمایش داده می‌شود.',
    actionLabel: 'افزودن اعضا',
    actionRoute: 'members',
  },
  homework: {
    icon: 'homework',
    title: 'تکلیفی ثبت نشده است',
    text: 'تکلیف هر هفته را ثبت کنید و متن آماده واتساپ بگیرید.',
    actionLabel: 'تنظیمات کلاس',
    actionRoute: 'settings',
  },
  members: {
    icon: 'members',
    title: 'فهرست اعضا خالی است',
    text: 'اعضای کلاس را با نام، شماره تماس، تاریخ تولد و نقش‌ها اضافه کنید.',
    actionLabel: 'افزودن اولین عضو',
    actionRoute: null, // phase 3
  },
  settings: {
    icon: 'settings',
    title: 'تنظیمات کلاس',
    text: 'روز و ساعت کلاس‌های هفتگی، تم و اندازه فونت را اینجا تنظیم می‌کنید.',
    actionLabel: 'بازگشت به خانه',
    actionRoute: 'home',
  },
};

/* ---------- Theme & preferences ---------- */

const PREF_KEY = 'mct:prefs';

function loadPrefs() {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY)) || {};
  } catch {
    return {};
  }
}

function savePrefs(prefs) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    /* storage may be unavailable (private mode) — ignore */
  }
}

const prefs = loadPrefs();

function applyTheme(theme) {
  const resolved = theme === 'light' || theme === 'dark'
    ? theme
    : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', resolved === 'dark' ? '#101121' : '#5b5bd6');
  return resolved;
}

function currentResolvedTheme() {
  return document.documentElement.dataset.theme || 'light';
}

function toggleTheme() {
  const next = currentResolvedTheme() === 'dark' ? 'light' : 'dark';
  prefs.theme = next;
  savePrefs(prefs);
  applyTheme(next);
  updateThemeButton();
  toast(next === 'dark' ? 'تم تیره فعال شد.' : 'تم روشن فعال شد.', 'info', 1600);
}

function updateThemeButton() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', currentResolvedTheme() === 'dark' ? 'true' : 'false');
  btn.setAttribute('title', currentResolvedTheme() === 'dark' ? 'تغییر به تم روشن' : 'تغییر به تم تیره');
}

function applyFontSize(size) {
  if (size === 'small' || size === 'large') {
    document.documentElement.dataset.fontsize = size;
  } else {
    document.documentElement.removeAttribute('data-fontsize');
  }
}

/* ---------- Navigation ---------- */

function buildNav() {
  const nav = document.getElementById('bottom-nav');
  if (!nav) return;
  clear(nav);
  ROUTES.forEach((route) => {
    const link = el('button', {
      type: 'button',
      class: 'nav-link',
      dataset: { route: route.id },
      'aria-label': route.label,
      onclick: () => navigate(route.id),
    }, [icon(route.icon), el('span', {}, route.label)]);
    nav.append(el('li', { class: 'bottom-nav__item' }, link));
  });
}

function setActiveNav(routeId) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    if (link.dataset.route === routeId) {
      link.setAttribute('aria-current', 'page');
    } else {
      link.removeAttribute('aria-current');
    }
  });
}

function currentRouteFromHash() {
  const id = (location.hash || '').replace(/^#\/?/, '');
  return ROUTES.some((r) => r.id === id) ? id : DEFAULT_ROUTE;
}

/* ---------- Rendering ---------- */

function renderPlaceholder(main, route) {
  const cfg = PLACEHOLDERS[route.id] || {};
  main.append(pageHead(route.title, route.subtitle));
  main.append(emptyState({
    icon: cfg.icon,
    title: cfg.title,
    text: cfg.text,
    actionLabel: cfg.actionLabel,
    onAction: cfg.actionRoute
      ? () => navigate(cfg.actionRoute)
      : () => toast('این بخش در فاز بعدی تکمیل می‌شود.', 'info'),
  }));
}

function renderRoute(routeId) {
  const main = document.getElementById('main-content');
  if (!main) return;
  const route = ROUTES.find((r) => r.id === routeId) || ROUTES[0];

  clear(main);
  main.append(el('div', { class: 'page-enter' }, []));
  const page = main.firstElementChild;

  // Render into a wrapper for the page-enter animation
  const holder = document.createDocumentFragment();
  const temp = el('div', {}, []);
  renderPlaceholder(temp, route);
  while (temp.firstChild) holder.append(temp.firstChild);
  page.append(holder);

  // Home also gets a phase-2 calendar demo card (removable later)
  if (route.id === 'home') {
    page.append(buildCalendarDemoCard());
  }

  setActiveNav(route.id);
  document.title = `${route.title} — My-Class-Track`;
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

function navigate(routeId) {
  const target = ROUTES.some((r) => r.id === routeId) ? routeId : DEFAULT_ROUTE;
  if (currentRouteFromHash() === target) {
    renderRoute(target);
    return;
  }
  location.hash = `#/${target}`;
}

/* ---------- Phase 2: calendar demo card ---------- */

function buildCalendarDemoCard() {
  const card = el('section', { class: 'card mt-4' }, []);
  card.append(el('h3', { class: 'card__title' }, [icon('calendar'), 'تقویم شمسی']));
  card.append(el('p', { class: 'muted' }, 'یک تاریخ را انتخاب کنید تا درستی تقویم شمسی را ببینید. این کارت نمونه است و در فازهای بعد جای آن را صفحه‌های اصلی می‌گیرند.'));

  const field = document.createElement('div');
  field.className = 'mt-4';
  import('./ui.js').then(({ createJalaliDatePicker }) => {
    const picker = createJalaliDatePicker({
      placeholder: 'انتخاب تاریخ نمونه',
      onChange: (v) => {
        if (v) toast(`تاریخ انتخابی ثبت شد.`, 'success', 1600);
      },
    });
    field.append(picker.root);
  });

  card.append(field);
  return card;
}

/* ---------- Quick help ---------- */

function showQuickHelp() {
  confirmDialog({
    title: 'راهنمای سریع',
    text: 'این برنامه برای پیگیری حضور، شهریه و تکالیف یک کلاس گروه‌درمانی هفتگی ساخته شده است. از نوار پایین بین بخش‌ها جابه‌جا شوید. این نسخه در حال ساخت است و بخش‌ها به‌تدریج کامل می‌شوند.',
    confirmText: 'متوجه شدم',
    cancelText: 'بستن',
  });
}

/* ---------- Service worker ---------- */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {
      /* Offline support is best-effort; never break the app because of it. */
    });
  });
}

/* ---------- Self test (phase 2) ---------- */

function reportSelfTest() {
  try {
    const { ok, results } = runSelfTest();
    const box = document.getElementById('selftest');
    if (!box) return;
    const failed = results.filter((r) => !r.pass);
    box.dataset.ok = String(ok);
    box.hidden = ok;
    if (!ok) {
      box.textContent = 'خطا در تبدیل تقویم: ' + failed.map((r) => `${r.name} (${r.actual})`).join(' ، ');
      console.error('[jalali self-test] failed', failed);
    }
  } catch (err) {
    console.error('[jalali self-test] error', err);
  }
}

/* ---------- Bootstrap ---------- */

function init() {
  applyTheme(prefs.theme);
  applyFontSize(prefs.fontSize);
  hydrateStaticIcons();
  updateThemeButton();

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const helpBtn = document.getElementById('quick-help');
  if (helpBtn) helpBtn.addEventListener('click', showQuickHelp);

  buildNav();

  window.addEventListener('hashchange', () => renderRoute(currentRouteFromHash()));
  renderRoute(currentRouteFromHash());

  // Follow OS theme changes only while the user has not chosen explicitly.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!prefs.theme) { applyTheme(undefined); updateThemeButton(); }
  });

  reportSelfTest();
  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}