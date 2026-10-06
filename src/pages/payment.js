/* ============================================================
   src/pages/payment.js — Session-based tuition tracking (phase 6)
   Fee is paid per session, before that session starts.
   ============================================================ */

import {
  el, icon, toast, pageHead, emptyState, formModal, createJalaliDatePicker,
} from '../ui.js';
import {
  getMembers, getSessions, ensureSession, getPayments, savePayment,
  getNextClass,
} from '../store.js';
import {
  todayJalali, formatJalali, jalaliWeekdayName, toPersianDigits,
} from '../jalali.js';
import { openReport, paymentsCsv, downloadCsv } from '../reports.js';

export function renderPayment(container, options = {}) {
  const { navigate = () => { } } = options;

  const sessions = getSessions();
  const date = pickDate(options.date, sessions);

  container.append(pageHead('شهریه', 'وضعیت پرداخت شهریه هر جلسه'));

  if (!getMembers().length) {
    container.append(el('div', { class: 'mt-4' }, [
      emptyState({
        icon: 'members',
        title: 'هنوز عضوی ثبت نشده است',
        text: 'برای پیگیری شهریه، ابتدا اعضای کلاس را اضافه کنید.',
        actionLabel: 'افزودن اعضا',
        onAction: () => navigate('members'),
      }),
    ]));
    return;
  }

  // Session picker
  const select = el('select', { class: 'select', 'aria-label': 'انتخاب جلسه' });
  const seen = new Set();
  const pushOption = (jy, jm, jd, label) => {
    const key = `${jy}/${jm}/${jd}`;
    if (seen.has(key)) return;
    seen.add(key);
    const opt = el('option', { value: `${jy}/${jm}/${jd}` }, label);
    if (jy === date.jy && jm === date.jm && jd === date.jd) opt.selected = true;
    select.append(opt);
  };

  const today = todayJalali();
  const next = getNextClass();
  pushOption(today.jy, today.jm, today.jd, `امروز — ${formatJalali(today.jy, today.jm, today.jd)}`);
  if (next) pushOption(next.jy, next.jm, next.jd, `جلسه بعدی — ${formatJalali(next.jy, next.jm, next.jd)}`);
  sessions.forEach((s) => pushOption(s.jy, s.jm, s.jd, formatJalali(s.jy, s.jm, s.jd)));
  if (!seen.size) pushOption(date.jy, date.jm, date.jd, formatJalali(date.jy, date.jm, date.jd));

  select.addEventListener('change', () => {
    const [jy, jm, jd] = select.value.split('/').map(Number);
    rerender({ ...options, date: { jy, jm, jd } });
  });

  container.append(el('div', { class: 'card' }, [
    el('div', { class: 'field' }, [
      el('span', { class: 'field__label' }, 'جلسه'),
      select,
    ]),
  ]));

  // The session must exist before payment rows can reference it.
  const session = ensureSession(date.jy, date.jm, date.jd);
  const payments = getPayments(session.id);
  const members = getMembers();
  const paidCount = payments.filter((p) => p.paid).length;
  const unpaid = members.filter((m) => !payments.some((p) => p.memberId === m.id));

  // Progress + warning
  const pct = members.length ? Math.round((paidCount / members.length) * 100) : 0;
  container.append(el('div', { class: 'card' }, [
    el('div', { class: 'row-between' }, [
      el('div', {}, [
        el('div', { class: 'session-label' }, `${jalaliWeekdayName(date.jy, date.jm, date.jd)} ${formatJalali(date.jy, date.jm, date.jd)}`),
        el('div', { class: 'muted' }, `${toPersianDigits(paidCount)} از ${toPersianDigits(members.length)} نفر پرداخت کرده‌اند`),
      ]),
      unpaid.length
        ? el('span', { class: 'badge badge--danger' }, `${toPersianDigits(unpaid.length)} نفر نداده‌اند`)
        : el('span', { class: 'badge badge--success' }, 'همه پرداخت کرده‌اند'),
    ]),
    el('div', { class: 'progress-wrap mt-4' }, [
      el('div', { class: 'progress-bar' }, [
        el('div', {
          class: 'progress-bar__fill',
          style: { width: `${pct}%`, background: unpaid.length ? 'var(--color-warning)' : 'linear-gradient(90deg, var(--color-primary), var(--color-primary-strong))' },
        }),
      ]),
    ]),
  ]));

  // Warning when the class is imminent and money is still missing.
  if (unpaid.length && isImminent(date)) {
    container.append(el('div', { class: 'banner banner--warning mt-4' }, [
      icon('info'),
      el('span', {}, `${toPersianDigits(unpaid.length)} نفر هنوز شهریه این جلسه را واریز نکرده‌اند و کلاس نزدیک است.`),
    ]));
  }

  // Actions
  container.append(el('div', { class: 'btn-row mt-4' }, [
    el('button', {
      type: 'button', class: 'btn btn--primary grow',
      onclick: () => openReport(session.id, 'payment'),
    }, [icon('check'), 'گزارش شهریه']),
    el('button', {
      type: 'button', class: 'btn btn--secondary grow',
      onclick: () => {
        downloadCsv(
          `My-Class-Track-shahrie-${date.jy}-${String(date.jm).padStart(2, '0')}-${String(date.jd).padStart(2, '0')}.csv`,
          paymentsCsv(session.id),
        );
        toast('فایل CSV شهریه دریافت شد.', 'success');
      },
    }, 'CSV شهریه'),
  ]));

  // Rows
  const list = el('ul', { class: 'list mt-4' });
  members.forEach((m) => list.append(renderPaymentRow(m, payments.find((p) => p.memberId === m.id), session, date, unpaid.length > 0, options)));
  container.append(list);
}

function renderPaymentRow(member, record, session, date, urgent, options) {
  const paid = !!record;
  const card = el('li', { class: `pay-row${paid ? ' is-paid' : ''}${!paid && urgent ? ' is-urgent' : ''}` });

  const head = el('div', { class: 'pay-row__head' }, [
    el('span', { class: `dot ${paid ? 'dot--success' : 'dot--danger'}` }),
    el('div', { class: 'grow' }, [
      el('div', { class: 'pay-row__name' }, member.name),
      el('div', { class: 'pay-row__meta' }, paid
        ? `پرداخت شد${record.dateJy ? ` — ${formatJalali(record.dateJy.jy, record.dateJy.jm, record.dateJy.jd)}` : ''}${record.note ? ` — ${record.note}` : ''}`
        : 'پرداخت نشده'),
    ]),
  ]);
  card.append(head);

  const actions = el('div', { class: 'pay-row__actions' }, [
    el('button', {
      type: 'button',
      class: `btn btn--sm ${paid ? 'btn--secondary' : 'btn--primary'}`,
      onclick: () => openPaymentForm(member, session, date, options),
    }, paid ? 'ویرایش' : 'ثبت پرداخت'),
    paid
      ? el('button', {
        type: 'button', class: 'btn btn--ghost btn--sm',
        onclick: () => {
          savePayment({ sessionId: session.id, memberId: member.id, paid: false });
          toast('پرداخت لغو شد.', 'info');
          rerender({ ...options, date });
        },
      }, 'لغو پرداخت')
      : null,
  ]);
  card.append(actions);

  return card;
}

function openPaymentForm(member, session, date, options) {
  const existing = getPayments(session.id).find((p) => p.memberId === member.id);
  const noteInput = el('input', {
    class: 'input', type: 'text',
    value: existing?.note || '',
    placeholder: 'مثلاً عکس فیش در واتساپ',
    'aria-label': 'یادداشت فیش',
  });

  const picker = createJalaliDatePicker({
    value: existing?.dateJy || { ...date },
    placeholder: 'انتخاب تاریخ پرداخت',
  });

  formModal({
    title: `ثبت پرداخت — ${member.name}`,
    body: el('div', {}, [
      el('div', { class: 'field' }, [el('span', { class: 'field__label' }, 'تاریخ پرداخت'), picker.root]),
      el('div', { class: 'field' }, [el('span', { class: 'field__label' }, 'یادداشت فیش'), noteInput]),
    ]),
    submitLabel: 'ثبت',
    onSubmit: () => {
      savePayment({
        sessionId: session.id,
        memberId: member.id,
        paid: true,
        dateJy: picker.getValue(),
        note: noteInput.value,
      });
      toast('پرداخت ثبت شد.', 'success');
      rerender({ ...options, date });
      return null;
    },
  });
}

/** True when the selected session is today or the next class day. */
function isImminent(date) {
  const today = todayJalali();
  const next = getNextClass();
  const sameAsToday = date.jy === today.jy && date.jm === today.jm && date.jd === today.jd;
  const sameAsNext = next && date.jy === next.jy && date.jm === next.jm && date.jd === next.jd;
  return sameAsToday || sameAsNext;
}

function pickDate(preferred, sessions) {
  if (preferred) return preferred;
  const next = getNextClass();
  if (next) return { jy: next.jy, jm: next.jm, jd: next.jd };
  const latest = sessions[0];
  if (latest) return { jy: latest.jy, jm: latest.jm, jd: latest.jd };
  return todayJalali();
}

function rerender(options = {}) {
  const main = document.getElementById('main-content');
  if (!main) return;
  const page = main.firstElementChild;
  if (!page) return;
  page.dispatchEvent(new CustomEvent('mct:destroy', { bubbles: true }));
  page.replaceChildren();
  renderPayment(page, options);
}

export default { renderPayment };