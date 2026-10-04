/* ============================================================
   src/ui.js — DOM helpers, components, toast, dialog, datepicker
   All dynamic user content is rendered through safe DOM APIs.
   ============================================================ */

import {
  MONTH_NAMES,
  WEEKDAY_SHORT,
  todayJalali,
  toGregorian,
  toJalali,
  jalaliMonthLength,
  formatJalali,
  isValidJalali,
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
  }

  function onDocClick(e) {
    if (!root.contains(e.target)) close();
  }

  function onKey(e) {
    if (e.key === 'Escape') close();
  }

  function renderPopup() {
    clear(popup);

    const prevBtn = el('button', {
      type: 'button', class: 'datepicker__nav', 'aria-label': 'ماه قبل',
      onclick: () => {
        view.jm -= 1;
        if (view.jm < 1) { view.jm = 12; view.jy -= 1; }
        renderPopup();
      },
    }, icon('chevronRight'));

    const nextBtn = el('button', {
      type: 'button', class: 'datepicker__nav', 'aria-label': 'ماه بعد',
      onclick: () => {
        view.jm += 1;
        if (view.jm > 12) { view.jm = 1; view.jy += 1; }
        renderPopup();
      },
    }, icon('chevronLeft'));

    popup.append(el('div', { class: 'datepicker__head' }, [
      prevBtn,
      el('span', { class: 'datepicker__label' }, `${MONTH_NAMES[view.jm - 1]} ${view.jy}`),
      nextBtn,
    ]));

    // Weekday header (Saturday first)
    const grid = el('div', { class: 'datepicker__grid' });
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
        'aria-label': `${d} ${MONTH_NAMES[view.jm - 1]} ${view.jy}`,
        'aria-pressed': isSelected ? 'true' : 'false',
        onclick: () => { commit({ jy: view.jy, jm: view.jm, jd: d }); close(); },
      }, String(d));
      grid.append(btn);
    }
    popup.append(grid);

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
    // Keep popup inside the field root
    root.append(popup);
    document.addEventListener('click', onDocClick, true);
    document.addEventListener('keydown', onKey);
  });

  renderValue();

  return {
    root,
    getValue: () => (selected ? { ...selected } : null),
    setValue: (v) => { selected = v ? { ...v } : null; renderValue(); },
  };
}

/** Validate a Jalali y/m/d; returns an error message in Persian or null. */
export function jalaliError(jy, jm, jd) {
  if (!isValidJalali(jy, jm, jd)) return 'تاریخ وارد‌شده معتبر نیست.';
  return null;
}

export default {
  el,
  clear,
  icon,
  hydrateStaticIcons,
  toast,
  confirmDialog,
  emptyState,
  pageHead,
  createJalaliDatePicker,
  jalaliError,
};