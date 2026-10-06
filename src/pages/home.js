/* ============================================================
   src/pages/home.js — Home dashboard (phase 6)
   Next class + live countdown, upcoming birthdays, status summary
   and the two big shortcuts used in a rush.
   ============================================================ */

import { el, icon, pageHead, emptyState } from '../ui.js';
import {
  getMembers, getNextClass, getUpcomingBirthdays, ensureSession,
  attendanceProgress, getPayments, getUpcomingEvents, EVENT_TYPES,
} from '../store.js';
import {
  todayJalali, formatJalali, jalaliWeekdayName, toPersianDigits, toGregorian,
} from '../jalali.js';

export function renderHome(container, options = {}) {
  const { navigate = () => { } } = options;
  const members = getMembers();
  const next = getNextClass();

  container.append(pageHead('خانه', 'نمای کلی کلاس و کارهای امروز'));

  if (!members.length) {
    container.append(emptyState({
      icon: 'sparkles',
      title: 'به My-Class-Track خوش آمدید',
      text: 'برای شروع، اعضای کلاس و ساعت کلاس هفتگی را ثبت کنید.',
      actionLabel: 'افزودن اعضا',
      onAction: () => navigate('members'),
    }));
    return;
  }

  if (!next) {
    container.append(el('div', { class: 'banner banner--warning mb-4' }, [
      icon('info'),
      el('span', {}, 'کلاس هفتگی تعریف نشده است. برای شمارش معکوس و تایمر پشت در، روز و ساعت کلاس را ثبت کنید.'),
      el('button', {
        type: 'button', class: 'btn btn--sm btn--secondary',
        onclick: () => navigate('settings'),
      }, 'تنظیمات'),
    ]));
    // Birthdays, the summary and the shortcuts are still useful without a
    // schedule, so they must not be skipped on this branch.
    container.append(renderEvents());
    container.append(renderBirthdays());
    container.append(renderSummary(null));
    container.append(renderShortcuts(navigate));
    return;
  }

  container.append(renderNextClass(next));
  container.append(renderEvents());
  container.append(renderBirthdays());
  container.append(renderSummary(next));
  container.append(renderShortcuts(navigate));
}

/* ---------- Next class + live countdown ---------- */

function renderNextClass(next) {
  const timeEl = el('div', { class: 'home-countdown__value' }, '—');
  const progressEl = el('div', { class: 'home-countdown__progress' });
  const card = el('section', { class: 'card home-countdown' }, [
    el('div', { class: 'home-countdown__label' }, 'کلاس بعدی'),
    el('div', { class: 'home-countdown__date' },
      `${jalaliWeekdayName(next.jy, next.jm, next.jd)} ${formatJalali(next.jy, next.jm, next.jd)}`),
    el('div', { class: 'home-countdown__time' },
      `ساعت ${toPersianDigits(next.start)} تا ${toPersianDigits(next.end)}`),
    timeEl,
    progressEl,
  ]);

  const target = toGregorian(next.jy, next.jm, next.jd);
  target.setHours(...next.start.split(':').map(Number), 0, 0);
  const totalMs = Math.max(1, target.getTime() - Date.now());

  let timerId = null;
  // 1s ticks only when the class is under an hour away; otherwise 30s is plenty.
  let fastTick = false;

  /** Stop ticking. Called at zero and when the card is torn down. */
  function stop() {
    if (timerId) { clearInterval(timerId); timerId = null; }
  }

  /** Start (or restart) the interval with the cadence that fits the remaining time. */
  function schedule() {
    stop();
    const remaining = target.getTime() - Date.now();
    if (remaining <= 0) return;
    fastTick = remaining < 3600000;
    timerId = setInterval(() => {
      const left = target.getTime() - Date.now();
      if (left <= 0) { tick(); stop(); return; }
      tick();
      // Crossing the one-hour mark changes the cadence; restart once.
      const wantFast = left < 3600000;
      if (wantFast !== fastTick) schedule();
    }, fastTick ? 1000 : 30000);
  }

  const tick = () => {
    const remaining = target.getTime() - Date.now();
    if (remaining <= 0) {
      timeEl.textContent = 'کلاس شروع شده';
      timeEl.classList.add('is-done');
      progressEl.replaceChildren();
      return;
    }

    // Under an hour, show whole minutes so the value visibly moves each second.
    const totalMinutes = Math.floor(remaining / 60000);
    timeEl.textContent = totalMinutes < 60
      ? `${toPersianDigits(totalMinutes)} دقیقه مانده`
      : countdownText(remaining);

    const pct = Math.min(100, Math.max(0, (1 - remaining / totalMs) * 100));
    progressEl.replaceChildren(el('div', {
      class: 'home-countdown__bar',
      style: { width: `${pct.toFixed(1)}%` },
    }));
  };

  tick();
  schedule();

  // The card can be removed at any time (route change, data re-render); a leaked
  // interval would keep running forever, so tear it down with the node.
  card.addEventListener('mct:destroy', stop);
  return card;
}

/** «۳ روز و ۲ ساعت و ۵ دقیقه» style countdown with Persian digits. */
function countdownText(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  const parts = [];
  if (days > 0) parts.push(`${toPersianDigits(days)} روز`);
  if (hours > 0 || days > 0) parts.push(`${toPersianDigits(hours)} ساعت`);
  parts.push(`${toPersianDigits(minutes)} دقیقه`);

  return `${parts.join(' و ')} مانده`;
}

/* ---------- Upcoming events ---------- */

/**
 * The next 30 days of seminars, gatherings and celebrations. Returns an empty
 * node when there is nothing scheduled, so the dashboard stays uncluttered.
 */
function renderEvents() {
  const upcoming = getUpcomingEvents(30);
  if (!upcoming.length) return el('div', {});

  const card = el('section', { class: 'card' }, [
    el('h3', { class: 'card__title' }, [icon('calendar'), 'برنامه‌های پیش رو']),
  ]);

  const list = el('ul', { class: 'list' });
  upcoming.slice(0, 4).forEach((e) => {
    const meta = EVENT_TYPES[e.type] || EVENT_TYPES.gathering;
    const bits = [];
    if (e.start) bits.push(`ساعت ${toPersianDigits(e.start)}`);
    if (e.place) bits.push(e.place);

    list.append(el('li', { class: 'list-item' }, [
      el('span', { class: `event-type event-type--${meta.tone}` }, meta.icon),
      el('div', { class: 'list-item__body' }, [
        el('div', { class: 'list-item__title' }, e.title),
        el('div', { class: 'list-item__meta' },
          `${jalaliWeekdayName(e.jy, e.jm, e.jd)} ${formatJalali(e.jy, e.jm, e.jd)}${bits.length ? ` • ${bits.join(' • ')}` : ''}`),
      ]),
      el('span', { class: `badge badge--${e.daysLeft <= 2 ? 'danger' : 'primary'}` },
        e.daysLeft === 0 ? 'امروز!' : e.daysLeft === 1 ? 'فردا' : `${toPersianDigits(e.daysLeft)} روز`),
    ]));
  });
  card.append(list);
  return card;
}

/* ---------- Birthdays ---------- */

function renderBirthdays() {
  const upcoming = getUpcomingBirthdays(7);
  if (!upcoming.length) return el('div', {});

  const card = el('section', { class: 'card' }, [
    el('h3', { class: 'card__title' }, [icon('cake'), 'تولدهای نزدیک']),
  ]);
  const list = el('ul', { class: 'list' });
  upcoming.forEach((b) => {
    list.append(el('li', { class: 'list-item' }, [
      el('span', { class: 'home-bday__icon' }, icon('cake')),
      el('div', { class: 'list-item__body' }, [
        el('div', { class: 'list-item__title' }, b.member.name),
        el('div', { class: 'list-item__meta' }, formatJalali(b.jy, b.jm, b.jd, { withMonthName: true })),
      ]),
      el('span', { class: `badge badge--${b.daysLeft === 0 ? 'danger' : 'primary'}` },
        b.daysLeft === 0 ? 'امروز!' : `${toPersianDigits(b.daysLeft)} روز دیگر`),
    ]));
  });
  card.append(list);
  return card;
}

/* ---------- Summary ---------- */

function renderSummary(next) {
  const members = getMembers();
  const date = next || todayJalali();
  const session = ensureSession(date.jy, date.jm, date.jd);
  const done1 = attendanceProgress(session, 1);
  const done2 = attendanceProgress(session, 2);
  const unpaid = members.length - getPayments(session.id).filter((p) => p.paid).length;

  const card = el('section', { class: 'card' }, [
    el('h3', { class: 'card__title' }, [icon('info'), 'خلاصه وضعیت جلسه بعد']),
  ]);

  const grid = el('div', { class: 'stat-grid' }, [
    stat('اعضا', members.length, 'members'),
    stat('نوبت ۱', `${done1}/${members.length}`, 'attendance'),
    stat('نوبت ۲', `${done2}/${members.length}`, 'door'),
    stat('شهریه نداده', unpaid, unpaid > 0 ? 'payment' : 'check'),
  ]);
  card.append(grid);
  return card;
}

function stat(label, value, iconName) {
  return el('div', { class: 'stat' }, [
    el('span', { class: 'stat__icon' }, icon(iconName)),
    el('div', {}, [
      el('div', { class: 'stat__value' }, toPersianDigits(value)),
      el('div', { class: 'stat__label' }, label),
    ]),
  ]);
}

/* ---------- Shortcuts ---------- */

function renderShortcuts(navigate) {
  return el('div', { class: 'btn-row btn-row--grid mt-4' }, [
    el('button', {
      type: 'button', class: 'btn btn--primary btn--lg',
      onclick: () => navigate('attendance'),
    }, [icon('attendance'), 'شروع نوبت ۱']),
    el('button', {
      type: 'button', class: 'btn btn--danger btn--lg',
      onclick: () => navigate('attendance', { door: true }),
    }, [icon('door'), 'حالت پشت در']),
  ]);
}

export default { renderHome };