/* ============================================================
   src/app.js — Router, bootstrap, theme, service worker
   Phase 1: shell + navigation + theme + empty pages.
   Phase 2: Jalali calendar wired in (self-test + demo).
   ============================================================ */

import { el, clear, icon, hydrateStaticIcons, toast, confirmDialog, emptyState, pageHead } from './ui.js';
import { runSelfTest } from './jalali.js';
import { load as loadStore, subscribe as subscribeStore } from './store.js';
import {
  getPrefs, setPrefs, getTheme, getFontSize, applyTheme, applyFontSize,
} from './prefs.js';
import { renderMembers } from './pages/members.js';
import { renderSettings } from './pages/settings.js';
import { renderAttendance } from './pages/attendance.js';
import { renderPayment } from './pages/payment.js';
import { renderHomework } from './pages/homework.js';
import { renderHome } from './pages/home.js';

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

/* Per-route empty-state fallback for any page without an implementation yet. */
const PLACEHOLDERS = {};

/* Routes that have a real implementation (phase 3+). Each page receives the
   container and a small context object (navigate + route options). */
const PAGES = {
  home: (container, ctx) => renderHome(container, ctx),
  members: (container) => renderMembers(container),
  settings: (container) => renderSettings(container),
  attendance: (container, ctx) => renderAttendance(container, ctx),
  payment: (container, ctx) => renderPayment(container, ctx),
  homework: (container, ctx) => renderHomework(container, ctx),
};

/* ---------- Theme & preferences ---------- */

function currentResolvedTheme() {
  return document.documentElement.dataset.theme || 'light';
}

function toggleTheme() {
  const next = currentResolvedTheme() === 'dark' ? 'light' : 'dark';
  setPrefs({ theme: next });
  applyTheme(next);
  updateThemeButton();
  toast(next === 'dark' ? 'تم تیره فعال شد.' : 'تم روشن فعال شد.', 'info', 1600);
}

function updateThemeButton() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isDark = currentResolvedTheme() === 'dark';
  btn.setAttribute('aria-pressed', isDark ? 'true' : 'false');
  btn.setAttribute('aria-label', isDark ? 'تغییر به تم روشن' : 'تغییر به تم تیره');
  btn.setAttribute('title', isDark ? 'تغییر به تم روشن' : 'تغییر به تم تیره');
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

function renderRoute(routeId, { keepOptions = false } = {}) {
  const main = document.getElementById('main-content');
  if (!main) return;
  const route = ROUTES.find((r) => r.id === routeId) || ROUTES[0];

  // Let the outgoing page release timers/listeners before its DOM disappears.
  main.dispatchEvent(new CustomEvent('mct:destroy', { bubbles: true }));
  clear(main);
  main.append(el('div', { class: 'page-enter' }, []));
  const page = main.firstElementChild;

  const renderPage = PAGES[route.id];
  if (renderPage) {
    renderPage(page, { navigate, ...routeOptions });
    if (!keepOptions) routeOptions = {};
  } else {
    // Render into a wrapper for the page-enter animation
    const holder = document.createDocumentFragment();
    const temp = el('div', {}, []);
    renderPlaceholder(temp, route);
    while (temp.firstChild) holder.append(temp.firstChild);
    page.append(holder);
  }

  setActiveNav(route.id);
  document.title = `${route.title} — My-Class-Track`;
  const status = document.getElementById('route-status');
  if (status) status.textContent = `صفحه ${route.title} باز شد`;
  main.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

let routeOptions = {};
let lastNavigateTarget = null;

function navigate(routeId, options) {
  const target = ROUTES.some((r) => r.id === routeId) ? routeId : DEFAULT_ROUTE;
  routeOptions = options || {};
  lastNavigateTarget = target;
  if (currentRouteFromHash() === target) {
    renderRoute(target);
    return;
  }
  location.hash = `#/${target}`;
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

/* ---------- Offline indicator ---------- */

function initOfflineIndicator() {
  const banner = el('div', {
    class: 'offline-banner', id: 'offline-banner', role: 'status', hidden: true,
  }, [
    icon('info'),
    el('span', {}, 'حالت آفلاین — اطلاعات شما روی همین دستگاه ذخیره شده است.'),
  ]);
  const header = document.querySelector('.app-header');
  if (header) header.after(banner);

  const update = () => { banner.hidden = navigator.onLine; };
  window.addEventListener('online', () => { update(); toast('اتصال اینترنت برقرار شد.', 'success', 1800); });
  window.addEventListener('offline', () => { update(); toast('حالت آفلاین فعال شد. برنامه همچنان کار می‌کند.', 'info', 2400); });
  update();
}

/* ---------- Service worker ---------- */

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').then((reg) => {
      // A newly deployed worker takes control as soon as it activates (sw.js
      // calls skipWaiting), so offer a one-tap reload instead of waiting for
      // every tab to be closed.
      reg.addEventListener('updatefound', () => {
        const incoming = reg.installing;
        if (!incoming) return;
        incoming.addEventListener('statechange', () => {
          if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
            promptForUpdate();
          }
        });
      });
      // Check for a new version on every launch, so a long-lived install
      // does not stay on an old build.
      reg.update().catch(() => {});
    }).catch(() => {
      /* Offline support is best-effort; never break the app because of it. */
    });
  });
}

/** Offer to reload when a newer build has been installed in the background. */
let updatePrompted = false;
function promptForUpdate() {
  if (updatePrompted) return;
  updatePrompted = true;
  confirmDialog({
    title: 'نسخه جدید آماده است',
    text: 'نسخه تازه‌ای از برنامه دانلود شد. برای استفاده از آن، برنامه بازنشانی شود؟',
    confirmText: 'به‌روزرسانی کن',
    cancelText: 'بعداً',
  }).then((ok) => {
    if (ok) window.location.reload();
    else updatePrompted = false;
  });
}

/* ---------- Self test (phase 2) ---------- */

function reportSelfTest() {
  try {
    const { ok, results } = runSelfTest();
    const failed = results.filter((r) => !r.pass);
    if (!ok) {
      console.error('[jalali self-test] failed', failed);
      console.table(failed.map((r) => ({ name: r.name, expected: r.expected, actual: r.actual })));
    } else if (getPrefs().debug) {
      console.table(results.map((r) => ({ name: r.name, expected: r.expected, actual: r.actual, pass: r.pass })));
    }
  } catch (err) {
    console.error('[jalali self-test] error', err);
  }
}

/* ---------- Bootstrap ---------- */

function init() {
  applyTheme(getTheme());
  applyFontSize(getFontSize());
  hydrateStaticIcons();
  updateThemeButton();

  loadStore();
  // Re-render the current page whenever stored data changes — but never while a
  // full-screen mode (door / timer) owns the screen, since it manages itself.
  subscribeStore(() => {
    if (!document.getElementById('main-content')) return;
    if (document.querySelector('.door-screen, .timer-screen')) return;
    renderRoute(currentRouteFromHash());
  });

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  // Settings changes the theme through the shared prefs module; keep the
  // header button's pressed state in sync with it.
  document.addEventListener('mct:theme-change', updateThemeButton);

  const helpBtn = document.getElementById('quick-help');
  if (helpBtn) helpBtn.addEventListener('click', showQuickHelp);

  buildNav();

  // Route options are only meaningful for the navigation that set them, so they
  // are consumed once. A hashchange triggered BY navigate() must keep them.
  window.addEventListener('hashchange', () => {
    const hashChangedByNavigate = location.hash.startsWith(`#/${lastNavigateTarget}`);
    renderRoute(currentRouteFromHash(), { keepOptions: hashChangedByNavigate });
  });
  renderRoute(currentRouteFromHash());

  // Follow OS theme changes only while the user has not chosen explicitly.
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (!getTheme()) { applyTheme(undefined); updateThemeButton(); }
  });

  reportSelfTest();
  initOfflineIndicator();
  registerServiceWorker();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}