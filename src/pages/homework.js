/* ============================================================
   src/pages/homework.js — Weekly homework (phase 6)
   A short text per session, plus an archive with search.
   ============================================================ */

import {
  el, icon, toast, pageHead, emptyState, formModal, textAreaField,
  createJalaliDatePicker, confirmDialog, debounce,
} from '../ui.js';
import { copyText } from '../reports.js';
import { getHomeworks, saveHomework, deleteHomework, getNextClass } from '../store.js';
import {
  todayJalali, formatJalali, jalaliWeekdayName,
} from '../jalali.js';

let searchTerm = '';

export function renderHomework(container, options = {}) {
  const { navigate = () => { } } = options;

  container.append(pageHead('تکالیف', 'تکلیف هر جلسه و آرشیو'));

  container.append(el('div', { class: 'btn-row mb-4' }, [
    el('button', {
      type: 'button', class: 'btn btn--primary grow',
      onclick: () => openHomeworkForm(null),
    }, [icon('plus'), 'ثبت تکلیف']),
    el('button', {
      type: 'button', class: 'btn btn--secondary',
      onclick: () => navigate('settings'),
    }, [icon('settings'), 'تنظیمات کلاس']),
  ]));

  const searchInput = el('input', {
    class: 'input', type: 'search', placeholder: 'جستجو در تکالیف…',
    value: searchTerm, 'aria-label': 'جستجوی تکالیف',
  });
  const listWrap = el('div', {});

  const rerenderList = debounce(() => renderList(listWrap, options), 160);
  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim();
    rerenderList();
  });

  container.append(el('div', { class: 'field' }, [searchInput]));
  container.append(listWrap);
  renderList(listWrap, options);
}

function renderList(wrap, options) {
  wrap.replaceChildren();
  const all = getHomeworks();

  if (!all.length) {
    wrap.append(emptyState({
      icon: 'homework',
      title: 'تکلیفی ثبت نشده است',
      text: 'تکلیف هر هفته را ثبت کنید و متن آماده را برای واتساپ کپی کنید.',
      actionLabel: 'ثبت اولین تکلیف',
      onAction: () => openHomeworkForm(null, options),
    }));
    return;
  }

  const term = searchTerm.toLowerCase();
  const filtered = term
    ? all.filter((h) => h.text.toLowerCase().includes(term))
    : all;

  if (!filtered.length) {
    wrap.append(el('p', { class: 'muted center mt-4' }, 'تکلیفی با این عبارت پیدا نشد.'));
    return;
  }

  const list = el('ul', { class: 'list' });
  filtered.forEach((h) => list.append(renderItem(h, options)));
  wrap.append(list);
}

function renderItem(hw, options) {
  const card = el('li', { class: 'card hw-card' });

  card.append(el('div', { class: 'row-between' }, [
    el('div', {}, [
      el('div', { class: 'hw-card__date' },
        `${jalaliWeekdayName(hw.jy, hw.jm, hw.jd)} ${formatJalali(hw.jy, hw.jm, hw.jd)}`),
    ]),
    el('div', { class: 'list-item__actions' }, [
      el('button', {
        type: 'button', class: 'icon-btn', 'aria-label': 'ویرایش تکلیف',
        onclick: () => openHomeworkForm(hw, options),
      }, icon('settings')),
      el('button', {
        type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': 'حذف تکلیف',
        onclick: () => removeHomework(hw),
      }, icon('close')),
    ]),
  ]));

  card.append(el('pre', { class: 'hw-card__text' }, hw.text));

  card.append(el('div', { class: 'btn-row mt-3 no-print' }, [
    el('button', {
      type: 'button', class: 'btn btn--primary btn--sm',
      onclick: () => copyHomework(hw),
    }, 'کپی متن برای واتساپ'),
  ]));

  return card;
}

function whatsappText(hw) {
  return `تکلیف جلسه ${jalaliWeekdayName(hw.jy, hw.jm, hw.jd)} ${formatJalali(hw.jy, hw.jm, hw.jd)}\n\n${hw.text}`;
}

async function copyHomework(hw) {
  await copyText(whatsappText(hw), 'متن تکلیف کپی شد.', 'متن را از کارت انتخاب کنید.');
}

async function removeHomework(hw) {
  const ok = await confirmDialog({
    title: 'حذف تکلیف',
    text: 'این تکلیف از آرشیو حذف می‌شود. ادامه می‌دهید؟',
    confirmText: 'حذف کن',
    danger: true,
  });
  if (!ok) return;
  deleteHomework(hw.id);
  toast('تکلیف حذف شد.', 'success');
  rerender();
}

function openHomeworkForm(hw, options) {
  const isEdit = !!hw;
  const next = getNextClass();
  const fallback = next
    ? { jy: next.jy, jm: next.jm, jd: next.jd }
    : todayJalali();

  const textField = textAreaField({
    label: 'متن تکلیف',
    placeholder: 'تکلیف این هفته را بنویسید…',
    value: hw?.text || '',
  });

  const picker = createJalaliDatePicker({
    value: hw ? { jy: hw.jy, jm: hw.jm, jd: hw.jd } : fallback,
    placeholder: 'انتخاب تاریخ جلسه',
  });

  formModal({
    title: isEdit ? 'ویرایش تکلیف' : 'ثبت تکلیف',
    body: el('div', {}, [
      el('div', { class: 'field' }, [el('span', { class: 'field__label' }, 'تاریخ جلسه'), picker.root]),
      textField.root,
    ]),
    submitLabel: isEdit ? 'ذخیره' : 'ثبت',
    onSubmit: () => {
      const date = picker.getValue();
      const result = saveHomework({
        id: hw?.id,
        jy: date?.jy, jm: date?.jm, jd: date?.jd,
        text: textField.getValue(),
      });
      if (!result.ok) {
        textField.setError(result.errors.text);
        return result.errors;
      }
      toast(isEdit ? 'تکلیف ذخیره شد.' : 'تکلیف ثبت شد.', 'success');
      rerender(options);
      return null;
    },
  });
}

function rerender(options = {}) {
  const main = document.getElementById('main-content');
  if (!main) return;
  const page = main.firstElementChild;
  if (!page) return;
  page.dispatchEvent(new CustomEvent('mct:destroy', { bubbles: true }));
  page.replaceChildren();
  renderHomework(page, options);
}

export default { renderHomework };