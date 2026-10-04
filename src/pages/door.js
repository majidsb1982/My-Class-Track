/* ============================================================
   src/pages/door.js — At-the-door mode (round 2, phase 4)
   Full-screen, high contrast, one-tap recording.
   Designed to be used standing up, in a hurry, one-handed.
   ============================================================ */

import { el, icon } from '../ui.js';
import {
  ATTENDANCE_STATUS, STATUS_KEYS,
  getMembers, getSession, setAttendance, attendanceProgress,
} from '../store.js';
import { formatJalali, jalaliWeekdayName, toPersianDigits } from '../jalali.js';
import { reportPanel } from '../reports.js';

/**
 * Mount the full-screen at-the-door mode on <body>.
 * @param {Object} options { date, session, onExit }
 */
export function renderDoorMode(options = {}) {
  const { date, onExit = () => {} } = options;
  const sessionId = options.session.id;

  // Mount on <body> so this full-screen mode is not torn down by page re-renders.
  document.querySelector('.door-screen')?.remove();

  const screen = el('div', { class: 'door-screen' });
  document.body.append(screen);

  // --- Top bar ---
  const doneCount = el('span', { class: 'door__count' });
  const topbar = el('div', { class: 'door__topbar' }, [
    el('button', {
      type: 'button', class: 'icon-btn door__exit', 'aria-label': 'خروج از حالت پشت در',
      onclick: () => onExit(),
    }, icon('close')),
    el('div', { class: 'door__title' }, [
      el('div', { class: 'door__title-main' }, 'حالت پشت در'),
      el('div', { class: 'door__title-sub' }, `${jalaliWeekdayName(date.jy, date.jm, date.jd)} ${formatJalali(date.jy, date.jm, date.jd)}`),
    ]),
    doneCount,
  ]);
  screen.append(topbar);

  // --- List ---
  const listWrap = el('div', { class: 'door__list' });
  screen.append(listWrap);

  // --- Footer ---
  screen.append(el('div', { class: 'door__footer' }, [
    el('button', {
      type: 'button', class: 'btn btn--primary btn--lg btn--block',
      onclick: () => {
        showRound2Report();
      },
    }, [icon('check'), 'گزارش این نوبت']),
  ]));

  renderList();

  /* ---------- Round 2 report ---------- */

  /**
   * Show the round-2 report as a full-screen sheet over the door mode: big,
   * selectable text plus copy / share / CSV / print.
   */
  function showRound2Report() {
    document.querySelector('.door-report')?.remove();
    const panel = reportPanel(sessionId, 'attendance', 2);
    panel.classList.add('door-report');
    const sheet = el('div', { class: 'door-report__sheet' }, [
      el('div', { class: 'door-report__bar' }, [
        el('button', {
          type: 'button', class: 'icon-btn', 'aria-label': 'بستن گزارش',
          onclick: () => sheet.remove(),
        }, icon('close')),
      ]),
      panel,
    ]);
    document.body.append(sheet);
  }

  /* ---------- Rendering ---------- */

  function renderList() {
    const members = getMembers();
    const session = getSession(sessionId);
    const slot2 = session?.slots?.['2'] || {};
    const slot1 = session?.slots?.['1'] || {};

    doneCount.textContent = `${toPersianDigits(attendanceProgress(session, 2))}/${toPersianDigits(members.length)}`;

    listWrap.replaceChildren();

    if (!members.length) {
      listWrap.append(el('p', { class: 'door__empty' }, 'عضوی برای پیگیری نیست.'));
      return;
    }

    // Members without a round-2 decision come first — those are the calls to make.
    const sorted = [...members].sort((a, b) => {
      const aDone = slot2[a.id] ? 1 : 0;
      const bDone = slot2[b.id] ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return 0;
    });

    sorted.forEach((m) => listWrap.append(renderDoorCard(m, slot2[m.id], slot1[m.id])));
  }

  function renderDoorCard(member, record, previous) {
    const card = el('div', { class: `door-card${record ? ' is-done' : ''}` });

    // Name + previous round badge + call button
    const head = el('div', { class: 'door-card__head' }, [
      el('div', { class: 'door-card__name' }, member.name),
      el('div', { class: 'door-card__head-right' }, [
        previous?.status
          ? el('span', {
            class: `badge badge--${ATTENDANCE_STATUS[previous.status].tone}`,
            title: 'وضعیت نوبت ۱',
          }, `${ATTENDANCE_STATUS[previous.status].icon} ${ATTENDANCE_STATUS[previous.status].label}`)
          : el('span', { class: 'badge' }, 'ثبت‌نشده'),
        member.phone
          ? el('a', {
            class: 'door-card__call', href: `tel:${member.phone}`,
            rel: 'noopener', 'aria-label': `تماس با ${member.name}`,
          }, icon('phone'))
          : null,
      ]),
    ]);
    card.append(head);

    // Four big one-tap status buttons
    const row = el('div', { class: 'door-card__actions' });
    STATUS_KEYS.forEach((key) => {
      const st = ATTENDANCE_STATUS[key];
      const active = record?.status === key;
      const btn = el('button', {
        type: 'button',
        class: `door-btn door-btn--${st.tone}${active ? ' is-active' : ''}`,
        'aria-pressed': active ? 'true' : 'false',
        'aria-label': `${member.name}: ${st.label}`,
        onclick: () => {
          if (active) {
            setAttendance(sessionId, 2, member.id, null);
          } else {
            const entry = { status: key };
            if (key === 'late') entry.lateTime = record?.lateTime || '19:30';
            if (record?.note) entry.note = record.note;
            setAttendance(sessionId, 2, member.id, entry);
          }
          if (navigator.vibrate) { try { navigator.vibrate(35); } catch { /* ignore */ } }
          renderList();
        },
      }, [
        el('span', { class: 'door-btn__icon', 'aria-hidden': 'true' }, st.icon),
        el('span', { class: 'door-btn__label' }, st.label),
      ]);
      row.append(btn);
    });
    card.append(row);

    if (record?.status) {
      card.append(el('div', { class: 'door-card__recorded' }, [
        'ثبت شد: ',
        `${ATTENDANCE_STATUS[record.status].icon} ${ATTENDANCE_STATUS[record.status].label}`,
        record.lateTime ? ` (حدود ${toPersianDigits(record.lateTime)})` : '',
      ]));
    }

    return card;
  }
}

export default { renderDoorMode };