/* ============================================================
   src/pages/attendance.js — Attendance page (phase 4)
   Two rounds: round 1 (pre-call list) and round 2 (at the door).
   The door mode is full-screen, one-tap, high contrast.
   ============================================================ */

import {
  el, icon, toast, pageHead, emptyState, formModal,
} from '../ui.js';
import {
  ATTENDANCE_STATUS, STATUS_KEYS,
  getMembers, getSessions, ensureSession, getSession,
  setAttendance, attendanceProgress,
  getNextClass,
} from '../store.js';
import { todayJalali, formatJalali, jalaliWeekdayName, toPersianDigits, toGregorian } from '../jalali.js';
import { renderDoorMode } from './door.js';
import { renderTimer } from '../timer.js';
import { openReport } from '../reports.js';

/* ---------- Helpers ---------- */

/** The session date to work on: the next class day, else today. */
function defaultSessionDate() {
  const next = getNextClass();
  if (next) return { jy: next.jy, jm: next.jm, jd: next.jd };
  return todayJalali();
}

function sessionLabel(date) {
  const weekday = jalaliWeekdayName(date.jy, date.jm, date.jd);
  return `${weekday} ${formatJalali(date.jy, date.jm, date.jd)}`;
}

/* ---------- Page ---------- */

export function renderAttendance(container, options = {}) {
  const { navigate = () => { } } = options;

  const date = options.date || defaultSessionDate();
  const session = ensureSession(date.jy, date.jm, date.jd);
  const members = getMembers();

  container.append(pageHead('حضور', 'پیگیری حضور در دو نوبت'));

  // Opened straight from the home shortcut — go to the door without a tap.
  // The flag is cleared so exiting the door does not re-open it.
  if (options.door) {
    const { door, ...rest } = options;
    openDoorMode(container, date, rest);
  }

  // Session header
  container.append(el('div', { class: 'card' }, [
    el('div', { class: 'row-between' }, [
      el('div', {}, [
        el('div', { class: 'session-label' }, sessionLabel(date)),
        el('div', { class: 'muted' }, `${toPersianDigits(members.length)} عضو فعال`),
      ]),
      el('button', {
        type: 'button', class: 'btn btn--ghost btn--sm',
        onclick: () => openSessionPicker(container, date, options),
      }, 'تغییر جلسه'),
    ]),
  ]));

  if (!members.length) {
    container.append(el('div', { class: 'mt-4' }, [
      emptyState({
        icon: 'members',
        title: 'هنوز عضوی ثبت نشده است',
        text: 'برای پیگیری حضور، ابتدا اعضای کلاس را اضافه کنید.',
        actionLabel: 'افزودن اعضا',
        onAction: () => navigate('members'),
      }),
    ]));
    return;
  }

  // Big shortcuts
  container.append(el('div', { class: 'btn-row btn-row--grid mt-4' }, [
    el('button', {
      type: 'button', class: 'btn btn--primary btn--lg',
      onclick: () => navigate('attendance', { round: 1 }),
    }, [icon('attendance'), 'شروع نوبت ۱']),
    el('button', {
      type: 'button', class: 'btn btn--danger btn--lg',
      onclick: () => openDoorMode(container, date, options),
    }, [icon('door'), 'حالت پشت در']),
  ]));

  container.append(el('div', { class: 'mt-4' }, [
    el('button', {
      type: 'button', class: 'btn btn--secondary btn--block btn--lg',
      onclick: () => openTimer(container, options),
    }, [icon('clock'), 'تایمر پشت در']),
  ]));

  // Round 1 list
  const fresh = getSession(session.id) || session;
  const round1 = el('section', { class: 'section mt-6' });
  round1.append(el('h3', { class: 'section__title' }, [icon('attendance'), 'نوبت ۱ — پیش‌تماس']));
  round1.append(renderProgress(fresh, 1, members.length));
  round1.append(el('button', {
    type: 'button', class: 'btn btn--secondary btn--block no-print',
    onclick: () => openReport(fresh.id, 'attendance', 1),
  }, 'گزارش نوبت ۱'));
  round1.append(renderRoundList(fresh, 1, members, container, date, options));
  container.append(round1);
}

/* ---------- Progress ---------- */

function renderProgress(session, slot, total) {
  const done = attendanceProgress(session, slot);
  const pct = total ? Math.round((done / total) * 100) : 0;
  return el('div', { class: 'progress-wrap' }, [
    el('div', { class: 'progress-text' }, `${toPersianDigits(done)} از ${toPersianDigits(total)} نفر ثبت شد`),
    el('div', { class: 'progress-bar', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, [
      el('div', { class: 'progress-bar__fill', style: { width: `${pct}%` } }),
    ]),
  ]);
}

/* ---------- Round 1 list ---------- */

function renderRoundList(session, slot, members, container, date, options) {
  const list = el('ul', { class: 'list' });
  const slotMap = session.slots?.[String(slot)] || {};

  members.forEach((m) => {
    list.append(renderMemberRow(m, slotMap[m.id], session, slot, container, date, options));
  });
  return list;
}

function renderMemberRow(member, record, session, slot, container, date, options) {
  const card = el('li', { class: 'attend-card' });

  const head = el('div', { class: 'attend-card__head' }, [
    el('div', { class: 'attend-card__name' }, member.name),
    member.phone
      ? el('a', {
        class: 'btn btn--secondary btn--sm', href: `tel:${member.phone}`,
        rel: 'noopener', 'aria-label': `تماس با ${member.name}`,
      }, [icon('phone'), 'تماس'])
      : null,
  ]);
  card.append(head);

  if (record?.status) {
    card.append(el('div', { class: `badge badge--${ATTENDANCE_STATUS[record.status].tone}` }, [
      `${ATTENDANCE_STATUS[record.status].icon} ${ATTENDANCE_STATUS[record.status].label}`,
      record.lateTime ? ` — حدود ${toPersianDigits(record.lateTime)}` : '',
      record.note ? ` — ${record.note}` : '',
    ]));
  }

  // Status buttons
  const btnRow = el('div', { class: 'status-row' });
  STATUS_KEYS.forEach((key) => {
    const st = ATTENDANCE_STATUS[key];
    const active = record?.status === key;
    const btn = el('button', {
      type: 'button',
      class: `status-btn status-btn--${st.tone}${active ? ' is-active' : ''}`,
      'aria-pressed': active ? 'true' : 'false',
      onclick: () => onStatusClick(key),
    }, [`${st.icon} ${st.label}`]);
    btnRow.append(btn);
  });
  card.append(btnRow);

  // Late-time + note fields (only relevant for late / problem)
  const extras = el('div', { class: 'attend-extras' });
  card.append(extras);

  function refreshExtras() {
    extras.replaceChildren();
    const rec = (getSession(session.id)?.slots?.[String(slot)] || {})[member.id];
    if (!rec) return;

    if (rec.status === 'late') {
      const input = el('input', {
        class: 'input', type: 'time', value: rec.lateTime || '19:30',
        'aria-label': 'ساعت تقریبی تأخیر',
      });
      input.addEventListener('change', () => {
        setAttendance(session.id, slot, member.id, { status: 'late', lateTime: input.value, note: rec.note });
        toast('ساعت تأخیر ثبت شد.', 'success', 1200);
      });
      extras.append(el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, 'ساعت تقریبی تأخیر'),
        input,
      ]));
    }

    if (rec.status === 'absent' || rec.status === 'problem') {
      const input = el('input', {
        class: 'input', type: 'text', value: rec.note || '',
        placeholder: rec.status === 'absent' ? 'علت غیبت (اختیاری)' : 'توضیح مشکل',
        'aria-label': 'یادداشت',
      });
      input.addEventListener('change', () => {
        setAttendance(session.id, slot, member.id, { status: rec.status, note: input.value, lateTime: rec.lateTime });
        toast('یادداشت ذخیره شد.', 'success', 1200);
      });
      extras.append(el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, rec.status === 'absent' ? 'علت غیبت' : 'توضیح مشکل'),
        input,
      ]));
    }
  }

  function onStatusClick(key) {
    const current = (getSession(session.id)?.slots?.[String(slot)] || {})[member.id];
    if (current?.status === key) {
      // Tapping the active status clears it.
      setAttendance(session.id, slot, member.id, null);
    } else {
      const entry = { status: key };
      if (key === 'late') entry.lateTime = current?.lateTime || '19:30';
      if (current?.note) entry.note = current.note;
      setAttendance(session.id, slot, member.id, entry);
    }
    rerender(container, date, options);
  }

  refreshExtras();
  return card;
}

/* ---------- Session picker ---------- */

function openSessionPicker(container, currentDate, options) {
  const sessions = getSessions();
  const list = el('ul', { class: 'list' });

  // Today + next class as quick options, plus past sessions.
  const quick = new Set();
  const today = todayJalali();
  const next = getNextClass();
  const quickDates = [today];
  if (next) quickDates.push({ jy: next.jy, jm: next.jm, jd: next.jd });

  quickDates.forEach((d) => {
    const key = `${d.jy}/${d.jm}/${d.jd}`;
    if (quick.has(key)) return;
    quick.add(key);
    list.append(sessionOption(d, currentDate, container, options));
  });

  sessions.forEach((s) => {
    const key = `${s.jy}/${s.jm}/${s.jd}`;
    if (quick.has(key)) return;
    quick.add(key);
    list.append(sessionOption(s, currentDate, container, options, true));
  });

  formModal({
    title: 'انتخاب جلسه',
    body: list,
    submitLabel: 'بستن',
    cancelLabel: 'بستن',
    onSubmit: () => null,
  });
}

function sessionOption(date, currentDate, container, options, isPast = false) {
  const isCurrent = date.jy === currentDate.jy && date.jm === currentDate.jm && date.jd === currentDate.jd;
  const item = el('li', { class: `list-item${isCurrent ? ' list-item--active' : ''}` }, [
    el('div', { class: 'list-item__body' }, [
      el('div', { class: 'list-item__title' }, sessionLabel(date)),
      isPast ? el('div', { class: 'list-item__meta' }, 'جلسه گذشته') : null,
    ]),
  ]);
  item.append(el('button', {
    type: 'button', class: 'btn btn--ghost btn--sm',
    onclick: () => {
      document.querySelector('.dialog-backdrop')?.remove();
      rerender(container, date, options);
    },
  }, isCurrent ? 'فعلی' : 'انتخاب'));
  return item;
}

/* ---------- Door mode ---------- */

function openDoorMode(container, date, options) {
  const session = ensureSession(date.jy, date.jm, date.jd);
  renderDoorMode({
    date,
    session,
    onExit: () => {
      document.querySelector('.door-screen')?.remove();
      rerender(container, date, options);
    },
  });
}

/* ---------- Timer ---------- */

function openTimer(container, options) {
  renderTimer(container, {
    getStartTime: () => {
      const next = getNextClass();
      if (!next) return null;
      // Build a Date for the next class start from its Jalali date + time.
      const [h, m] = next.start.split(':').map(Number);
      const g = toGregorian(next.jy, next.jm, next.jd);
      g.setHours(h, m, 0, 0);
      return g;
    },
    onBack: () => {
      document.querySelector('.timer-screen')?.remove();
      const main = document.getElementById('main-content');
      if (main) rerender(main, options?.date || defaultSessionDate(), options);
    },
  });
}

/* ---------- Re-render ---------- */

function rerender(container, date, options) {
  const main = document.getElementById('main-content');
  if (!main) return;
  const page = main.firstElementChild;
  const target = page || container;
  target.replaceChildren();
  renderAttendance(target, { ...options, date });
}

export default { renderAttendance };