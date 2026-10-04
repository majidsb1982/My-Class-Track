/* ============================================================
   src/pages/settings.js — Settings page (phases 3 & 6)
   Weekly class schedule, reports, appearance, backup/restore.
   ============================================================ */

import {
  el, icon, toast, confirmDialog, pageHead, formModal,
} from '../ui.js';
import { getSchedule, saveScheduleEntry, deleteScheduleEntry, getSessions, exportData, validateBackup, importData, clearAll } from '../store.js';
import { WEEKDAY_NAMES, toPersianDigits, formatTime, formatJalali, todayJalali } from '../jalali.js';
import { paymentsCsv, downloadCsv, openReport } from '../reports.js';

const APP_VERSION = 'v1.0.0';

/* ---------- Preferences (mirrors app.js; single source per key) ---------- */

const PREF_KEY = 'mct:prefs';

function loadPrefs() {
  try { return JSON.parse(localStorage.getItem(PREF_KEY)) || {}; } catch { return {}; }
}
function savePrefs(prefs) {
  try { localStorage.setItem(PREF_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
}

/** Render the settings page into the given container. */
export function renderSettings(container) {
  container.append(pageHead('تنظیمات', 'کلاس، ظاهر برنامه و مدیریت داده‌ها'));

  container.append(renderScheduleCard());
  container.append(renderReportsCard());
  container.append(renderAppearanceCard());
  container.append(renderDataCard());
  container.append(renderAboutCard());
}

/* ---------- Schedule ---------- */

function renderScheduleCard() {
  const card = el('section', { class: 'card' }, []);
  card.append(el('h3', { class: 'card__title' }, [icon('clock'), 'کلاس‌های هفتگی']));

  const list = getSchedule();
  const listWrap = el('div', {});

  if (!list.length) {
    listWrap.append(el('p', { class: 'muted' }, 'هنوز کلاسی تعریف نشده است. برای شمارش معکوس و تایمر پشت در، روز و ساعت کلاس را اضافه کنید.'));
  } else {
    const ul = el('ul', { class: 'list' });
    list
      .slice()
      .sort((a, b) => a.weekday - b.weekday)
      .forEach((c) => ul.append(renderScheduleItem(c)));
    listWrap.append(ul);
  }
  card.append(listWrap);

  card.append(el('div', { class: 'mt-4' }, [
    el('button', {
      type: 'button', class: 'btn btn--secondary btn--block',
      onclick: () => openScheduleForm(null),
    }, [icon('plus'), 'افزودن کلاس هفتگی']),
  ]));

  return card;
}

function renderScheduleItem(c) {
  const item = el('li', { class: 'list-item' }, [
    el('div', { class: 'list-item__body' }, [
      el('div', { class: 'list-item__title' }, WEEKDAY_NAMES[c.weekday] || '—'),
      el('div', { class: 'list-item__meta' }, `از ${formatTime(...parseTime(c.start))} تا ${formatTime(...parseTime(c.end))}`),
    ]),
    el('div', { class: 'list-item__actions' }, [
      el('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'ویرایش کلاس',
        onclick: () => openScheduleForm(c),
      }, icon('settings')),
      el('button', {
        type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': 'حذف کلاس',
        onclick: () => askDeleteSchedule(c),
      }, icon('close')),
    ]),
  ]);
  return item;
}

function parseTime(t) {
  const [h, m] = String(t).split(':').map(Number);
  return [h, m];
}

async function askDeleteSchedule(c) {
  const ok = await confirmDialog({
    title: 'حذف کلاس',
    text: `کلاس ${WEEKDAY_NAMES[c.weekday]} ساعت ${formatTime(...parseTime(c.start))} حذف شود؟`,
    confirmText: 'حذف کن',
    danger: true,
  });
  if (!ok) return;
  deleteScheduleEntry(c.id);
  toast('کلاس حذف شد.', 'success');
  rerender();
}

function openScheduleForm(entry) {
  const isEdit = !!entry;

  const weekdaySelect = el('select', { class: 'select' });
  WEEKDAY_NAMES.forEach((name, idx) => {
    const opt = el('option', { value: String(idx) }, name);
    if (entry && entry.weekday === idx) opt.selected = true;
    weekdaySelect.append(opt);
  });

  const startInput = el('input', { class: 'input', type: 'time', value: entry?.start || '19:00' });
  const endInput = el('input', { class: 'input', type: 'time', value: entry?.end || '21:00' });

  const startErr = el('span', { class: 'field__error', role: 'alert' }); startErr.hidden = true;
  const endErr = el('span', { class: 'field__error', role: 'alert' }); endErr.hidden = true;

  const body = el('div', {}, [
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, 'روز هفته'),
      weekdaySelect,
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, 'ساعت شروع'),
      startInput, startErr,
    ]),
    el('div', { class: 'field' }, [
      el('label', { class: 'field__label' }, 'ساعت پایان'),
      endInput, endErr,
    ]),
  ]);

  formModal({
    title: isEdit ? 'ویرایش کلاس' : 'افزودن کلاس هفتگی',
    body,
    submitLabel: isEdit ? 'ذخیره' : 'افزودن',
    onSubmit: () => {
      startErr.hidden = true; endErr.hidden = true;
      const result = saveScheduleEntry({
        id: entry?.id,
        weekday: Number(weekdaySelect.value),
        start: startInput.value,
        end: endInput.value,
      });
      if (!result.ok) {
        if (result.errors.start) { startErr.textContent = result.errors.start; startErr.hidden = false; }
        if (result.errors.end) { endErr.textContent = result.errors.end; endErr.hidden = false; }
        return result.errors;
      }
      toast(isEdit ? 'کلاس ویرایش شد.' : 'کلاس افزوده شد.', 'success');
      rerender();
      return null;
    },
  });
}

/* ---------- Reports ---------- */

function renderReportsCard() {
  const card = el('section', { class: 'card' }, []);
  card.append(el('h3', { class: 'card__title' }, [icon('attendance'), 'گزارش‌ها']));

  const sessions = getSessions();
  if (!sessions.length) {
    card.append(el('p', { class: 'muted' }, 'هنوز جلسه‌ای ثبت نشده است. پس از ثبت حضور، گزارش هر جلسه اینجا در دسترس خواهد بود.'));
    return card;
  }

  const select = el('select', { class: 'select', 'aria-label': 'انتخاب جلسه' });
  sessions.forEach((s) => {
    const label = `${formatJalali(s.jy, s.jm, s.jd)}`;
    select.append(el('option', { value: s.id }, label));
  });

  const actions = el('div', { class: 'btn-row mt-3' }, [
    el('button', {
      type: 'button', class: 'btn btn--secondary grow',
      onclick: () => openReport(select.value, 'payment'),
    }, 'گزارش شهریه'),
    el('button', {
      type: 'button', class: 'btn btn--secondary grow',
      onclick: () => {
        const s = sessions.find((x) => x.id === select.value) || sessions[0];
        downloadCsv(`shahrie-${String(s.jy)}-${String(s.jm).padStart(2, '0')}-${String(s.jd).padStart(2, '0')}.csv`, paymentsCsv(s.id));
        toast('فایل CSV شهریه دریافت شد.', 'success');
      },
    }, 'CSV شهریه'),
  ]);

  card.append(el('div', { class: 'field' }, [
    el('span', { class: 'field__label' }, 'جلسه'),
    select,
  ]));
  card.append(actions);
  return card;
}

/* ---------- Appearance ---------- */

function renderAppearanceCard() {
  const prefs = loadPrefs();
  const card = el('section', { class: 'card' }, []);
  card.append(el('h3', { class: 'card__title' }, [icon('theme'), 'ظاهر برنامه']));

  // Theme segmented control
  const currentTheme = document.documentElement.dataset.theme || 'light';
  card.append(el('div', { class: 'field' }, [
    el('span', { class: 'field__label' }, 'تم'),
    segmented([
      { key: 'light', label: 'روشن' },
      { key: 'dark', label: 'تیره' },
    ], currentTheme, (key) => {
      document.documentElement.dataset.theme = key;
      prefs.theme = key;
      savePrefs(prefs);
      const meta = document.querySelector('meta[name="theme-color"]');
      if (meta) meta.setAttribute('content', key === 'dark' ? '#101121' : '#5b5bd6');
      toast(key === 'dark' ? 'تم تیره فعال شد.' : 'تم روشن فعال شد.', 'info', 1400);
    }),
  ]));

  // Font size segmented control
  const currentFont = document.documentElement.dataset.fontsize || 'medium';
  card.append(el('div', { class: 'field' }, [
    el('span', { class: 'field__label' }, 'اندازه فونت'),
    segmented([
      { key: 'small', label: 'کوچک' },
      { key: 'medium', label: 'متوسط' },
      { key: 'large', label: 'بزرگ' },
    ], currentFont, (key) => {
      if (key === 'medium') document.documentElement.removeAttribute('data-fontsize');
      else document.documentElement.dataset.fontsize = key;
      prefs.fontSize = key === 'medium' ? undefined : key;
      savePrefs(prefs);
      toast('اندازه فونت ذخیره شد.', 'success', 1400);
    }),
  ]));

  return card;
}

/** A touch-friendly segmented control. */
function segmented(options, selectedKey, onChange) {
  const root = el('div', { class: 'segmented', role: 'radiogroup' });
  options.forEach((opt) => {
    const btn = el('button', {
      type: 'button',
      class: `segmented__item${opt.key === selectedKey ? ' is-active' : ''}`,
      role: 'radio',
      'aria-checked': opt.key === selectedKey ? 'true' : 'false',
      onclick: () => {
        root.querySelectorAll('.segmented__item').forEach((b) => {
          b.classList.remove('is-active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('is-active');
        btn.setAttribute('aria-checked', 'true');
        onChange(opt.key);
      },
    }, opt.label);
    root.append(btn);
  });
  return root;
}

/* ---------- Backup / restore ---------- */

function renderDataCard() {
  const card = el('section', { class: 'card' }, []);
  card.append(el('h3', { class: 'card__title' }, [icon('payment'), 'پشتیبان‌گیری و بازیابی']));
  card.append(el('p', { class: 'muted' },
    'داده‌ها فقط روی همین دستگاه ذخیره می‌شوند. پیش از پاک کردن حافظه مرورگر یا تعویض گوشی، حتماً یک فایل پشتیبان بگیرید.'));

  const fileInput = el('input', {
    type: 'file', accept: 'application/json,.json', class: 'visually-hidden',
    'aria-label': 'انتخاب فایل پشتیبان',
  });
  fileInput.addEventListener('change', () => handleRestore(fileInput));

  card.append(el('div', { class: 'btn-row mt-4' }, [
    el('button', {
      type: 'button', class: 'btn btn--primary grow',
      onclick: exportBackup,
    }, 'دریافت فایل پشتیبان'),
    el('button', {
      type: 'button', class: 'btn btn--secondary grow',
      onclick: () => fileInput.click(),
    }, 'بازیابی از فایل'),
    el('button', {
      type: 'button', class: 'btn btn--danger',
      onclick: clearEverything,
    }, 'پاک کردن همه داده‌ها'),
  ]));
  card.append(fileInput);
  return card;
}

function exportBackup() {
  const data = exportData();
  const t = todayJalali();
  const stamp = `${t.jy}-${String(t.jm).padStart(2, '0')}-${String(t.jd).padStart(2, '0')}`;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = el('a', { href: url, download: `My-Class-Track-backup-${stamp}.json` });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('فایل پشتیبان ساخته شد.', 'success');
}

async function handleRestore(input) {
  const file = input.files?.[0];
  input.value = ''; // allow re-picking the same file
  if (!file) return;

  let payload;
  try {
    payload = JSON.parse(await file.text());
  } catch {
    toast('فایل انتخاب‌شده یک JSON معتبر نیست.', 'error');
    return;
  }

  const check = validateBackup(payload);
  if (!check.ok) {
    toast(check.errors[0] || 'فایل پشتیبان معتبر نیست.', 'error');
    return;
  }
  check.warnings.forEach((w) => toast(w, 'info', 3200));

  const ok = await confirmDialog({
    title: 'بازیابی پشتیبان',
    text: 'داده‌های فعلی با محتوای فایل جایگزین می‌شوند. ادامه می‌دهید؟',
    confirmText: 'بازیابی کن',
    danger: true,
  });
  if (!ok) return;

  const result = importData(payload);
  toast(result.ok ? 'بازیابی انجام شد.' : 'بازیابی ناموفق بود.', result.ok ? 'success' : 'error');
}

async function clearEverything() {
  // Two-step confirmation: the second step requires typing the word «پاک».
  const first = await confirmDialog({
    title: 'پاک کردن همه داده‌ها',
    text: 'همه اعضا، جلسات، پرداخت‌ها و تکالیف حذف می‌شوند. این کار قابل بازگشت نیست.',
    confirmText: 'ادامه',
    cancelText: 'انصراف',
    danger: true,
  });
  if (!first) return;

  const second = await confirmDialog({
    title: 'تأیید نهایی',
    text: 'برای اطمینان، تأیید کنید که می‌خواهید همه داده‌ها برای همیشه پاک شود.',
    confirmText: 'بله، پاک کن',
    cancelText: 'انصراف',
    danger: true,
  });
  if (!second) return;

  clearAll();
  toast('همه داده‌ها پاک شد.', 'success');
}

/* ---------- About ---------- */

function renderAboutCard() {
  return el('section', { class: 'card' }, [
    el('h3', { class: 'card__title' }, [icon('info'), 'درباره برنامه']),
    el('p', { class: 'muted' }, 'My-Class-Track — دستیار پیگیری حضور، شهریه و تکالیف کلاس گروه‌درمانی هفتگی.'),
    el('p', { class: 'muted mt-2' }, `نسخه: ${toPersianDigits(APP_VERSION)}`),
  ]);
}

/* ---------- Utilities ---------- */

function rerender() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const page = main.firstElementChild;
  if (!page) return;
  page.replaceChildren();
  renderSettings(page);
}

export default { renderSettings };