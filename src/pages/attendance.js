/* ============================================================
   src/pages/attendance.js — Attendance page (phase 4)
   Two rounds: round 1 (pre-call list) and round 2 (at the door).
   The door mode is full-screen, one-tap, high contrast.
   ============================================================ */

import {
  el, icon, toast, pageHead, emptyState, formModal,
} from '../ui.js';
import { canRecord, createRecorder, formatDuration, avatarNode } from '../media.js';
import {
  ATTENDANCE_STATUS, STATUS_KEYS,
  getMembers, getSessions, ensureSession, getSession,
  setAttendance, attendanceProgress,
  getNextClass, getAttendanceTrend,
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

  // History of past sessions (only once something has been recorded).
  const trend = renderTrendSection();
  if (trend) container.append(trend);
}

/* ---------- Trend / history ---------- */

/**
 * A compact bar chart of attendance per session, oldest first.
 * Returns null when there is nothing worth showing yet.
 */
function renderTrendSection() {
  const trend = getAttendanceTrend().filter((t) => t.total > 0);
  if (trend.length < 2) return null;

  const section = el('section', { class: 'section mt-6' });
  section.append(el('h3', { class: 'section__title' }, [icon('clock'), 'روند حضور جلسات']));

  // Only the most recent sessions, so the chart stays readable on a phone.
  const recent = trend.slice(-8);
  const max = Math.max(...recent.map((t) => t.total), 1);

  const chart = el('div', { class: 'trend', role: 'img',
    'aria-label': 'نمودار حضور در جلسات اخیر' });

  recent.forEach((t) => {
    const attended = t.present + t.late;
    const pct = (attended / max) * 100;
    const bar = el('div', { class: 'trend__bar', style: { height: `${pct}%` } }, [
      el('span', { class: 'trend__count' }, toPersianDigits(attended)),
    ]);
    chart.append(el('div', { class: 'trend__col' }, [
      bar,
      el('span', { class: 'trend__label' }, toPersianDigits(t.jd)),
    ]));
  });
  section.append(chart);

  // Totals across every recorded session.
  const totals = trend.reduce((acc, t) => ({
    present: acc.present + t.present,
    late: acc.late + t.late,
    absent: acc.absent + t.absent,
    problem: acc.problem + t.problem,
  }), { present: 0, late: 0, absent: 0, problem: 0 });

  section.append(el('div', { class: 'stat-grid mt-4' }, [
    trendStat('حاضر', totals.present, 'success'),
    trendStat('تأخیر', totals.late, 'warning'),
    trendStat('غایب', totals.absent, 'danger'),
    trendStat('مشکل', totals.problem, 'problem'),
  ]));

  return section;
}

function trendStat(label, value, tone) {
  return el('div', { class: `stat stat--${tone}` }, [
    el('div', {}, [
      el('div', { class: 'stat__value' }, toPersianDigits(value)),
      el('div', { class: 'stat__label' }, label),
    ]),
  ]);
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
    el('div', { class: 'attend-card__who' }, [
      avatarNode(member, { size: 'sm' }),
      el('div', { class: 'attend-card__name' }, member.name),
    ]),
    member.phone
      ? el('a', {
        class: 'btn btn--secondary btn--sm', href: `tel:${member.phone}`,
        'aria-label': `تماس با ${member.name}`,
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
        setAttendance(session.id, slot, member.id, {
          status: rec.status, note: input.value, lateTime: rec.lateTime, voice: rec.voice, voiceMs: rec.voiceMs,
        });
        toast('یادداشت ذخیره شد.', 'success', 1200);
      });
      extras.append(el('div', { class: 'field' }, [
        el('label', { class: 'field__label' }, rec.status === 'absent' ? 'علت غیبت' : 'توضیح مشکل'),
        input,
      ]));
    }

    // A voice note is often faster than typing on a phone, and it keeps the
    // member's own words (reason for absence, a new phone number, …).
    extras.append(renderVoiceNote(session, slot, member, rec));
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

/* ---------- Voice note ---------- */

/**
 * The record / play / delete control for one attendance entry.
 * Returns null when the browser cannot record and there is nothing to play.
 */
function renderVoiceNote(session, slot, member, rec) {
  const supported = canRecord();
  if (!supported && !rec.voice) return null;

  const wrap = el('div', { class: 'voice-note-wrap mt-2' });

  const render = (current) => {
    wrap.replaceChildren();

    // Playback of an existing clip.
    if (current.voice) {
      const audio = el('audio', { controls: true, preload: 'metadata', src: current.voice });
      wrap.append(el('div', { class: 'voice-note' }, [
        audio,
        current.voiceMs
          ? el('span', { class: 'voice-note__meta' }, formatDuration(current.voiceMs))
          : null,
        el('button', {
          type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': 'حذف صدا',
          onclick: () => save({ ...current, voice: '', voiceMs: 0 }),
        }, icon('trash')),
      ]));
    }

    if (!supported) return;

    // Record / stop control.
    const label = el('span', {}, current.voice ? 'ضبط مجدد' : 'ضبط صدا');
    const indicator = el('span', { class: 'recording-indicator', hidden: true }, [
      el('span', { class: 'recording-indicator__dot' }),
      el('span', { class: 'rec-time' }, '۰:۰۰'),
    ]);

    const btn = el('button', {
      type: 'button', class: 'btn btn--secondary btn--sm',
    }, [icon('mic'), label]);

    const recorder = createRecorder({
      onTick: (ms) => { indicator.querySelector('.rec-time').textContent = formatDuration(ms); },
      onStop: (dataUrl, ms) => {
        indicator.hidden = true;
        btn.replaceChildren(icon('mic'), label);
        label.textContent = 'ضبط مجدد';
        if (!dataUrl) {
          toast('ضبط صدایی ذخیره نشد.', 'info', 1600);
          return;
        }
        save({ ...current, voice: dataUrl, voiceMs: ms });
        toast('صدا ذخیره شد.', 'success', 1400);
      },
    });

    btn.addEventListener('click', async () => {
      if (recorder.isRecording()) { recorder.stop(); return; }
      const res = await recorder.start();
      if (!res.ok) { toast(res.error, 'error'); return; }
      indicator.hidden = false;
      btn.replaceChildren(icon('close'), 'توقف ضبط');
      label.textContent = 'توقف ضبط';
    });

    wrap.append(el('div', { class: 'btn-row mt-2' }, [btn, indicator]));
    wrap.append(el('span', { class: 'field__hint' }, 'حداکثر یک دقیقه. صدا فقط روی همین دستگاه ذخیره می‌شود.'));
  };

  /** Persist a changed voice note on the current attendance record. */
  function save(next) {
    const result = setAttendance(session.id, slot, member.id, {
      status: rec.status,
      lateTime: rec.lateTime,
      note: rec.note,
      voice: next.voice,
      voiceMs: next.voiceMs,
    });
    if (result.ok) {
      rec.voice = next.voice;
      rec.voiceMs = next.voiceMs;
      render(rec);
    }
  }

  render(rec);
  return wrap;
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
  renderTimer({
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
  target.dispatchEvent(new CustomEvent('mct:destroy', { bubbles: true }));
  target.replaceChildren();
  renderAttendance(target, { ...options, date });
}

export default { renderAttendance };