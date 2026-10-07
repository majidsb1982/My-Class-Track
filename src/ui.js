/* ============================================================
   src/ui.js — DOM helpers, components, toast, dialog, datepicker
   All dynamic user content is rendered through safe DOM APIs.
   ============================================================ */

import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  todayJalali,
  toGregorian,
  jalaliMonthLength,
  formatJalali,
  isValidJalali,
  toPersianDigits,
  toLatinDigits,
} from './jalali.js';

/* ---------- Safe DOM builder ---------- */

/**
 * Create an element.
 * Text is always assigned via textContent (never innerHTML) — XSS safe.
 * Children may be nodes or strings (strings become text nodes).
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);

  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') {
      node.className = value;
    } else if (key === 'dataset') {
      Object.assign(node.dataset, value);
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(node.style, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === 'html') {
      // Only for trusted, app-authored static markup.
      node.innerHTML = value;
    } else if (value === true) {
      node.setAttribute(key, '');
    } else {
      node.setAttribute(key, value);
    }
  }

  appendChildren(node, children);
  return node;
}

function appendChildren(node, children) {
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    if (child == null || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

/** Clear all children of a node. */
export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

/**
 * Wrap `fn` so it only runs once `wait` ms have passed without another call.
 * Used for search boxes, where re-rendering on every keystroke is wasted work.
 */
export function debounce(fn, wait = 180) {
  let id = null;
  const wrapped = (...args) => {
    if (id) clearTimeout(id);
    id = setTimeout(() => { id = null; fn(...args); }, wait);
  };
  wrapped.cancel = () => { if (id) { clearTimeout(id); id = null; } };
  return wrapped;
}

/* ---------- Icons (inline SVG, no library) ---------- */

const ICONS = {
  home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9.5 21v-6h5v6"/>',
  attendance: '<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M2 21v-1a6 6 0 0 1 6-6h2a6 6 0 0 1 6 6v1"/><path d="M16 3.5a4 4 0 0 1 0 7"/><path d="M18 14a6 6 0 0 1 4 5.5V21"/>',
  payment: '<rect x="2.5" y="5.5" width="19" height="13" rx="3"/><path d="M2.5 10h19"/><path d="M6.5 14.5h4"/>',
  homework: '<path d="M6 3h9l5 5v13H6z"/><path d="M14.5 3v5.5H20"/><path d="M9 13h6"/><path d="M9 17h6"/>',
  members: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>',
  settings: '<path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
  theme: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.8.4-1 .9-1 1.7v.3"/><path d="M12 17h.01"/>',
  check: '<path d="M20 6.5 9.5 17 4 11.5"/>',
  close: '<path d="M18 6 6 18"/><path d="M6 6l12 12"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
  chevronRight: '<path d="m9 6 6 6-6 6"/>',
  chevronLeft: '<path d="m15 6-6 6 6 6"/>',
  phone: '<path d="M6.5 3.5h3l1.5 4-2 1.5a12 12 0 0 0 6 6l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.7 2 2 0 0 1 6.5 3.5Z"/>',
  plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
  cake: '<path d="M4 20h16"/><path d="M5 20v-6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v6"/><path d="M12 12V8"/><path d="M12 6.5a1.3 1.3 0 1 0 0-2.6 1.3 1.3 0 0 0 0 2.6Z"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  door: '<path d="M4 21h16"/><path d="M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17"/><path d="M14 12h.01"/>',
  sparkles: '<path d="M12 3.5 13.6 8 18 9.5 13.6 11 12 15.5 10.4 11 6 9.5 10.4 8Z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/>',
  camera: '<path d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1L9 4h6l1.5 2h1A2.5 2.5 0 0 1 20 8.5v9A2.5 2.5 0 0 1 17.5 20h-11A2.5 2.5 0 0 1 4 17.5Z"/><circle cx="12" cy="13" r="3.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  bell: '<path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 2 6H4c.5-.5 2-2 2-6Z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
  mapPin: '<path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/>',
  play: '<path d="M7 4.5v15l12-7.5Z"/>',
  trash: '<path d="M4 7h16"/><path d="M9 7V5h6v2"/><path d="M6 7l1 13h10l1-13"/><path d="M10 11v6"/><path d="M14 11v6"/>',
};

/** Return an inline SVG icon element. */
export function icon(name) {
  const span = document.createElement('span');
  span.className = 'icon-slot';
  span.setAttribute('aria-hidden', 'true');
  span.innerHTML = `<svg viewBox="0 0 24 24" role="img">${ICONS[name] || ICONS.info}</svg>`;
  return span;
}

/** Fill every [data-icon] slot found in the document (static markup). */
export function hydrateStaticIcons(root = document) {
  root.querySelectorAll('.icon-slot[data-icon]').forEach((slot) => {
    const name = slot.dataset.icon;
    slot.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ICONS.info}</svg>`;
  });
}

/* ---------- Toast ---------- */

let toastRegion = null;

function ensureToastRegion() {
  if (toastRegion && document.body.contains(toastRegion)) return toastRegion;
  toastRegion = el('div', { class: 'toast-region', role: 'status', 'aria-live': 'polite' });
  document.body.append(toastRegion);
  return toastRegion;
}

/**
 * Show a toast message. type: 'success' | 'error' | 'info'.
 */
export function toast(message, type = 'success', duration = 2600) {
  const region = ensureToastRegion();
  const iconName = type === 'error' ? 'close' : type === 'info' ? 'info' : 'check';
  const node = el('div', { class: `toast toast--${type}` }, [
    icon(iconName),
    el('span', { class: 'grow' }, message),
  ]);
  region.append(node);

  const remove = () => {
    node.classList.add('toast--out');
    node.addEventListener('animationend', () => node.remove(), { once: true });
  };
  const timer = setTimeout(remove, duration);
  node.addEventListener('click', () => { clearTimeout(timer); remove(); });
  return node;
}

/* ---------- Confirm dialog ---------- */

/**
 * Show a confirm dialog. Returns a Promise<boolean>.
 * options: { title, text, confirmText, cancelText, danger }
 */
export function confirmDialog(options = {}) {
  const {
    title = 'تأیید عملیات',
    text = 'آیا مطمئن هستید؟',
    confirmText = 'تأیید',
    cancelText = 'انصراف',
    danger = false,
  } = options;

  return new Promise((resolve) => {
    let settled = false;
    const previouslyFocused = document.activeElement;

    const close = (value) => {
      if (settled) return;
      settled = true;
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
      resolve(value);
    };

    const onKey = (e) => {
      if (e.key === 'Escape') close(false);
    };

    const cancelBtn = el('button', {
      type: 'button', class: 'btn btn--secondary', onclick: () => close(false),
    }, cancelText);

    const confirmBtn = el('button', {
      type: 'button', class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, onclick: () => close(true),
    }, confirmText);

    const dialog = el('div', {
      class: 'dialog', role: 'alertdialog', 'aria-modal': 'true',
      'aria-labelledby': 'dialog-title', 'aria-describedby': 'dialog-text',
    }, [
      el('h2', { class: 'dialog__title', id: 'dialog-title' }, title),
      el('p', { class: 'dialog__text', id: 'dialog-text' }, text),
      el('div', { class: 'dialog__actions' }, [cancelBtn, confirmBtn]),
    ]);

    const backdrop = el('div', {
      class: 'dialog-backdrop',
      onclick: (e) => { if (e.target === backdrop) close(false); },
    }, dialog);

    document.addEventListener('keydown', onKey);
    document.body.append(backdrop);
    confirmBtn.focus();
  });
}

/* ---------- Empty state ---------- */

export function emptyState({ icon: iconName = 'sparkles', title, text, actionLabel, onAction } = {}) {
  return el('div', { class: 'empty-state' }, [
    el('div', { class: 'empty-state__icon' }, icon(iconName)),
    el('h3', { class: 'empty-state__title' }, title || ''),
    text ? el('p', { class: 'empty-state__text' }, text) : null,
    actionLabel
      ? el('button', { type: 'button', class: 'btn btn--primary', onclick: onAction }, actionLabel)
      : null,
  ]);
}

/* ---------- Page head ---------- */

export function pageHead(title, subtitle) {
  return el('div', { class: 'page-head' }, [
    el('div', { class: 'page-head__titles' }, [
      el('h2', { class: 'page-title' }, title),
      subtitle ? el('p', { class: 'page-subtitle' }, subtitle) : null,
    ]),
  ]);
}

/* ---------- Jalali date picker ---------- */

/**
 * Create a touch-friendly Jalali date picker field.
 *
 * @param {Object} options
 *   value:     current Jalali {jy,jm,jd} or null
 *   onChange:  (value|null) => void
 *   placeholder: string
 *   allowClear: boolean
 * @returns {HTMLElement} the field root element
 */
export function createJalaliDatePicker(options = {}) {
  const {
    value = null,
    onChange = () => { },
    placeholder = 'انتخاب تاریخ',
    allowClear = true,
  } = options;

  let selected = value ? { ...value } : null;
  const today = todayJalali();
  let view = selected ? { jy: selected.jy, jm: selected.jm } : { jy: today.jy, jm: today.jm };
  let open = false;

  // The year range depends on what the field is for. A birthday needs to reach
  // back decades (a 70-year-old is born around 1334), while a payment date only
  // ever looks a little way back. `range: 'birth'` widens the list; the default
  // stays short so the year dropdown is not a 100-item scroll for every field.
  const isBirth = options.range === 'birth';
  const MIN_YEAR = isBirth ? 1300 : today.jy - 15;
  const MAX_YEAR = today.jy + 10;
  // The year list is only ever rendered as a window around the current view,
  // so a 100-year span costs nothing (see the year select below).
  const YEARS_PER_PAGE = 25;

  const valueSpan = el('span', { class: 'date-trigger__value' });
  const trigger = el('button', {
    type: 'button',
    class: 'date-trigger',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
    'aria-label': 'انتخاب تاریخ شمسی',
  }, [valueSpan, icon('calendar')]);

  const popup = el('div', {
    class: 'datepicker',
    role: 'dialog',
    'aria-label': 'تقویم شمسی',
  });

  const root = el('div', { class: 'date-field' }, [trigger, popup]);

  function renderValue() {
    if (selected) {
      valueSpan.textContent = formatJalali(selected.jy, selected.jm, selected.jd);
      valueSpan.dataset.empty = 'false';
    } else {
      valueSpan.textContent = placeholder;
      valueSpan.dataset.empty = 'true';
    }
  }

  function commit(next) {
    selected = next;
    renderValue();
    onChange(selected ? { ...selected } : null);
  }

  function close() {
    open = false;
    popup.remove();
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('click', onDocClick, true);
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', positionPopup);
    window.removeEventListener('scroll', positionPopup, true);
  }

  /** Tear the picker down completely (used when a hosting dialog closes). */
  function destroy() {
    close();
    root.remove();
  }

  function onDocClick(e) {
    if (!root.contains(e.target) && !popup.contains(e.target)) close();
  }

  /**
   * Anchor the fixed-position popup under (or above) the trigger, clamped to the
   * viewport. Called on open, on scroll and on resize so it never drifts.
   */
  function positionPopup() {
    if (!open) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 8;
    const width = Math.min(340, window.innerWidth - 24);

    popup.style.width = `${width}px`;
    const height = popup.offsetHeight || 380;

    // Prefer below the trigger; flip above when there is not enough room.
    const spaceBelow = window.innerHeight - rect.bottom - gap;
    const openAbove = spaceBelow < height && rect.top > spaceBelow;

    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(12, Math.min(left, window.innerWidth - width - 12));

    const top = openAbove
      ? Math.max(12, rect.top - height - gap)
      : Math.min(rect.bottom + gap, window.innerHeight - height - 12);

    popup.style.left = `${left}px`;
    popup.style.top = `${Math.max(12, top)}px`;
  }

  /**
   * Keyboard support for the day grid: arrows move by a day or a week, PageUp /
   * PageDown by a month, Home / End to the ends of the month, Enter or Space to
   * pick. This is what makes the picker usable without a mouse or on a desktop.
   */
  function onKey(e) {
    if (e.key === 'Escape') { close(); trigger.focus(); return; }
    if (!open) return;

    const focused = popup.querySelector('.datepicker__day:focus');
    if (!focused) return;

    const day = Number(focused.dataset.day);
    const len = jalaliMonthLength(view.jy, view.jm);
    let next = null;
    let movedMonth = 0;

    switch (e.key) {
      case 'ArrowRight': next = day - 1; break;
      case 'ArrowLeft': next = day + 1; break;
      case 'ArrowUp': next = day - 7; break;
      case 'ArrowDown': next = day + 7; break;
      case 'PageUp': movedMonth = -1; next = day; break;
      case 'PageDown': movedMonth = 1; next = day; break;
      case 'Home': next = 1; break;
      case 'End': next = len; break;
      case 'Enter': case ' ':
        e.preventDefault();
        focused.click();
        return;
      default:
        return;
    }

    e.preventDefault();
    if (movedMonth) shiftMonth(movedMonth);

    // Carry the day over when it moves past the edge of the month.
    if (next < 1) { shiftMonth(-1); next = jalaliMonthLength(view.jy, view.jm); }
    else if (next > len) { shiftMonth(1); next = 1; }

    renderPopup();
    const target = popup.querySelector(`.datepicker__day[data-day="${next}"]`);
    if (target) target.focus();
  }

  /**
   * Move the visible month by `delta` months, carrying the year over.
   * Shared by the arrows and the keyboard shortcuts so they cannot drift apart.
   */
  function shiftMonth(delta) {
    const total = view.jy * 12 + (view.jm - 1) + delta;
    view.jy = Math.floor(total / 12);
    view.jm = (total % 12) + 1;
  }

  /** Jump the view (and the selection) to a specific year, keeping the month. */
  function goToYear(year) {
    view.jy = Math.min(MAX_YEAR, Math.max(MIN_YEAR, year));
  }

  function renderPopup() {
    clear(popup);
    positionPopup();

    const prevBtn = el('button', {
      type: 'button', class: 'datepicker__nav', 'aria-label': 'ماه قبل',
      onclick: () => { shiftMonth(-1); renderPopup(); },
    }, icon('chevronRight'));

    const nextBtn = el('button', {
      type: 'button', class: 'datepicker__nav', 'aria-label': 'ماه بعد',
      onclick: () => { shiftMonth(1); renderPopup(); },
    }, icon('chevronLeft'));

    // Month picker — jumping straight to a month beats tapping an arrow
    // repeatedly when the target is most of a year away.
    const monthSelect = el('select', {
      class: 'datepicker__select', 'aria-label': 'انتخاب ماه',
      onchange: (e) => { view.jm = Number(e.target.value); renderPopup(); },
    });
    MONTH_NAMES.forEach((name, idx) => {
      const opt = el('option', { value: String(idx + 1) }, name);
      if (idx + 1 === view.jm) opt.selected = true;
      monthSelect.append(opt);
    });

    // Year picker. For a birthday the allowed span is ~100 years, so the list
    // shows a 25-year window around the current view; the ±10-year buttons move
    // that window. Without this the dropdown would be a 100-item scroll.
    const yearSelect = el('select', {
      class: 'datepicker__select datepicker__select--year', 'aria-label': 'انتخاب سال',
      onchange: (e) => { goToYear(Number(e.target.value)); renderPopup(); },
    });

    const windowStart = Math.max(MIN_YEAR, view.jy - Math.floor(YEARS_PER_PAGE / 2));
    const windowEnd = Math.min(MAX_YEAR, windowStart + YEARS_PER_PAGE - 1);
    for (let y = windowEnd; y >= windowStart; y -= 1) {
      const opt = el('option', { value: String(y) }, toPersianDigits(y));
      if (y === view.jy) opt.selected = true;
      yearSelect.append(opt);
    }

    const decadeBack = el('button', {
      type: 'button', class: 'datepicker__jump', 'aria-label': 'ده سال قبل',
      title: 'ده سال قبل',
      onclick: () => { goToYear(view.jy - 10); renderPopup(); },
    }, '−۱۰');

    const decadeFwd = el('button', {
      type: 'button', class: 'datepicker__jump', 'aria-label': 'ده سال بعد',
      title: 'ده سال بعد',
      onclick: () => { goToYear(view.jy + 10); renderPopup(); },
    }, '+۱۰');

    // A decade button only moves 10 years; typing the year is far faster when
    // the target is a birth year decades away.
    const yearInput = el('input', {
      class: 'datepicker__year-input', type: 'text', inputmode: 'numeric',
      'aria-label': 'سال را بنویسید', placeholder: 'مثلاً ۱۳۵۰',
      value: toPersianDigits(view.jy),
    });
    yearInput.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      const parsed = Number(toLatinDigits(e.target.value).replace(/[^0-9]/g, ''));
      if (Number.isInteger(parsed) && parsed >= MIN_YEAR && parsed <= MAX_YEAR) {
        goToYear(parsed);
        renderPopup();
      } else {
        // Out of range: put the current year back so the field is never wrong.
        e.target.value = toPersianDigits(view.jy);
      }
    });

    popup.append(el('div', { class: 'datepicker__head' }, [
      prevBtn,
      el('div', { class: 'datepicker__selects' }, [monthSelect, yearSelect]),
      nextBtn,
    ]));
    popup.append(el('div', { class: 'datepicker__jumps' }, [decadeBack, yearInput, decadeFwd]));

    // Weekday header (Saturday first)
    const grid = el('div', { class: 'datepicker__grid', role: 'grid' });
    WEEKDAY_SHORT.forEach((w) => grid.append(el('div', { class: 'datepicker__dow' }, w)));

    // First day of month -> weekday offset (Saturday-based)
    const firstGreg = toGregorian(view.jy, view.jm, 1);
    const offset = (firstGreg.getDay() + 1) % 7; // 0 = Saturday
    for (let i = 0; i < offset; i += 1) {
      grid.append(el('div', { class: 'datepicker__day datepicker__day--muted', 'aria-hidden': 'true' }, ''));
    }

    const len = jalaliMonthLength(view.jy, view.jm);
    for (let d = 1; d <= len; d += 1) {
      const isToday = today.jy === view.jy && today.jm === view.jm && today.jd === d;
      const isSelected = selected && selected.jy === view.jy && selected.jm === view.jm && selected.jd === d;
      const classes = ['datepicker__day'];
      if (isToday) classes.push('datepicker__day--today');
      if (isSelected) classes.push('datepicker__day--selected');
      const btn = el('button', {
        type: 'button',
        class: classes.join(' '),
        role: 'gridcell',
        // tabindex 0 on the selected (or first) day makes the grid keyboard
        // reachable; arrow keys then move the focus inside it.
        tabindex: isSelected || (!selected && d === 1) ? '0' : '-1',
        'data-day': String(d),
        'aria-label': `${d} ${MONTH_NAMES[view.jm - 1]} ${toPersianDigits(view.jy)}`,
        'aria-selected': isSelected ? 'true' : 'false',
        onclick: () => { commit({ jy: view.jy, jm: view.jm, jd: d }); close(); },
      }, toPersianDigits(d));
      grid.append(btn);
    }
    popup.append(grid);
    popup.append(el('p', { class: 'datepicker__hint' }, 'با کلیدهای جهت‌دار جابه‌جا شوید؛ Enter انتخاب می‌کند.'));

    const footer = el('div', { class: 'datepicker__footer' });
    footer.append(el('button', {
      type: 'button', class: 'btn btn--secondary btn--sm',
      onclick: () => { commit({ ...today }); close(); },
    }, 'امروز'));
    if (allowClear && selected) {
      footer.append(el('button', {
        type: 'button', class: 'btn btn--ghost btn--sm',
        onclick: () => { commit(null); close(); },
      }, 'پاک کردن'));
    }
    popup.append(footer);
  }

  trigger.addEventListener('click', () => {
    if (open) { close(); return; }
    open = true;
    trigger.setAttribute('aria-expanded', 'true');
    renderPopup();
    // The popup is fixed to the viewport and lives on <body>, so it cannot be
    // clipped by the form dialog's scroll container.
    document.body.append(popup);
    positionPopup();
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKey);
    window.addEventListener('resize', positionPopup);
    window.addEventListener('scroll', positionPopup, true);
  });

  renderValue();

  const api = {
    root,
    destroy,
    getValue: () => (selected ? { ...selected } : null),
    setValue: (v) => { selected = v ? { ...v } : null; renderValue(); },
  };
  root.__picker = api; // lets a hosting dialog tear this picker down
  return api;
}

/** Validate a Jalali y/m/d; returns an error message in Persian or null. */
export function jalaliError(jy, jm, jd) {
  if (!isValidJalali(jy, jm, jd)) return 'تاریخ وارد‌شده معتبر نیست.';
  return null;
}

/* ---------- Form fields ---------- */

/**
 * Build a labelled field wrapper.
 * @param {string} label
 * @param {Node|Node[]} control
 * @param {string} [hint]
 */
export function field(label, control, hint) {
  const id = `f_${Math.random().toString(36).slice(2, 8)}`;
  const controls = Array.isArray(control) ? control : [control];
  const labelEl = el('label', { class: 'field__label', for: id }, label);
  controls.forEach((c) => { if (c && c.setAttribute && !c.id) c.id = id; });
  return el('div', { class: 'field' }, [
    labelEl,
    ...controls,
    hint ? el('span', { class: 'field__hint' }, hint) : null,
  ]);
}

/**
 * A text input with an inline error slot.
 * Returns { root, input, setError, getValue, setValue }.
 */
export function textField({ label, type = 'text', placeholder = '', value = '', hint = '', inputMode } = {}) {
  const input = el('input', {
    class: 'input', type, placeholder,
    value: value == null ? '' : String(value),
    autocomplete: 'off',
  });
  if (inputMode) input.setAttribute('inputmode', inputMode);
  const errorEl = el('span', { class: 'field__error', role: 'alert' });
  errorEl.hidden = true;

  const id = `f_${Math.random().toString(36).slice(2, 8)}`;
  input.id = id;
  const root = el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id }, label),
    input,
    hint ? el('span', { class: 'field__hint' }, hint) : null,
    errorEl,
  ]);

  return {
    root,
    input,
    getValue: () => input.value.trim(),
    setValue: (v) => { input.value = v == null ? '' : String(v); },
    setError: (msg) => {
      if (msg) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
        input.setAttribute('aria-invalid', 'true');
      } else {
        errorEl.textContent = '';
        errorEl.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    },
  };
}

/**
 * A multi-line textarea with an inline error slot.
 */
export function textAreaField({ label, placeholder = '', value = '', hint = '' } = {}) {
  const input = el('textarea', { class: 'textarea', placeholder });
  input.value = value == null ? '' : String(value);
  const errorEl = el('span', { class: 'field__error', role: 'alert' });
  errorEl.hidden = true;
  const id = `f_${Math.random().toString(36).slice(2, 8)}`;
  input.id = id;

  const root = el('div', { class: 'field' }, [
    el('label', { class: 'field__label', for: id }, label),
    input,
    hint ? el('span', { class: 'field__hint' }, hint) : null,
    errorEl,
  ]);

  return {
    root,
    input,
    getValue: () => input.value.trim(),
    setValue: (v) => { input.value = v == null ? '' : String(v); },
    setError: (msg) => {
      if (msg) {
        errorEl.textContent = msg;
        errorEl.hidden = false;
        input.setAttribute('aria-invalid', 'true');
      } else {
        errorEl.textContent = '';
        errorEl.hidden = true;
        input.removeAttribute('aria-invalid');
      }
    },
  };
}

/**
 * A group of role checkboxes rendered as touch-friendly chips.
 * @param {{key:string,label:string}[]} options
 * @param {string[]} selected
 */
export function checkboxChips(options, selected = []) {
  const root = el('div', { class: 'checkbox-row', role: 'group' });
  const inputs = new Map();
  options.forEach((opt) => {
    const input = el('input', { type: 'checkbox' });
    input.checked = selected.includes(opt.key);
    input.value = opt.key;
    const chip = el('label', { class: 'check-chip' }, [input, el('span', {}, opt.label)]);
    inputs.set(opt.key, input);
    root.append(chip);
  });
  return {
    root,
    getValue: () => [...inputs.entries()].filter(([, i]) => i.checked).map(([k]) => k),
    setValue: (keys) => { inputs.forEach((i, k) => { i.checked = keys.includes(k); }); },
  };
}

/* ---------- Form modal ---------- */

/**
 * Open a modal that hosts a form. The caller supplies the body node and a
 * submit handler that returns an errors map (or null/{} for success).
 *
 * @param {Object} options
 *   title, body (Node), submitLabel, cancelLabel,
 *   onSubmit: () => (errors|null)   — return errors to keep the dialog open
 *   onClose: () => void
 * @returns {{close:()=>void}}
 */
export function formModal(options = {}) {
  const {
    title = '',
    body,
    submitLabel = 'ذخیره',
    cancelLabel = 'انصراف',
    onSubmit = () => null,
    onClose = () => {},
  } = options;

  const previouslyFocused = document.activeElement;
  let closed = false;

  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKey);
    // Tear down any date pickers opened inside this dialog so their popups and
    // document-level listeners cannot outlive it.
    dialog.querySelectorAll('.date-field').forEach((f) => f.__picker?.destroy());
    backdrop.remove();
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    onClose();
  };

  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const form = el('form', { class: 'dialog__form', novalidate: true });

  const cancelBtn = el('button', {
    type: 'button', class: 'btn btn--secondary', onclick: close,
  }, cancelLabel);

  const submitBtn = el('button', {
    type: 'submit', class: 'btn btn--primary',
  }, submitLabel);

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const errors = onSubmit();
    if (errors && Object.keys(errors).length) return; // keep open, caller shows errors
    close();
  });

  form.append(body, el('div', { class: 'dialog__actions' }, [cancelBtn, submitBtn]));

  const dialog = el('div', {
    class: 'dialog dialog--form', role: 'dialog', 'aria-modal': 'true',
  }, [
    el('h2', { class: 'dialog__title' }, title),
    form,
  ]);

  const backdrop = el('div', {
    class: 'dialog-backdrop',
    onclick: (e) => { if (e.target === backdrop) close(); },
  }, dialog);

  document.addEventListener('keydown', onKey);
  document.body.append(backdrop);

  // Focus the first focusable control for keyboard users.
  const first = dialog.querySelector('input, textarea, select, button');
  if (first) first.focus();

  return { close };
}

export default {
  el,
  clear,
  debounce,
  icon,
  hydrateStaticIcons,
  toast,
  confirmDialog,
  emptyState,
  pageHead,
  createJalaliDatePicker,
  jalaliError,
  field,
  textField,
  textAreaField,
  checkboxChips,
  formModal,
};