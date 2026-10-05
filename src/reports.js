/* Reports and exports. All output derives from a single session snapshot. */
import { getSession, getMembers, getData, ATTENDANCE_STATUS } from './store.js';
import { formatJalali, jalaliWeekdayName, toPersianDigits } from './jalali.js';
import { el, toast, icon, formModal } from './ui.js';

const sessionName = (s) => `${jalaliWeekdayName(s.jy, s.jm, s.jd)} ${formatJalali(s.jy, s.jm, s.jd)}`;
const membersFor = (s) => {
  const all = getMembers({ includeInactive: true });
  const ids = new Set([...Object.keys(s.slots?.[1] || {}), ...Object.keys(s.slots?.[2] || {})]);
  return all.filter((m) => m.active !== false || ids.has(m.id));
};
const detail = (member, record) => {
  let text = member.name;
  if (record?.status === 'late' && record.lateTime) text += ` (حدود ${toPersianDigits(record.lateTime)})`;
  if (record?.note) text += ` (${record.note})`;
  return text;
};

export function attendanceReport(sessionId, slot) {
  const s = getSession(sessionId);
  if (!s || ![1, 2].includes(Number(slot))) throw new Error('جلسه یا نوبت نامعتبر است.');
  const entries = s.slots?.[String(slot)] || {};
  const members = membersFor(s);
  const lines = [`گزارش حضور — جلسه ${sessionName(s)} — نوبت ${toPersianDigits(slot)}`];
  for (const key of ['present', 'late', 'absent', 'problem']) {
    const group = members.filter((m) => entries[m.id]?.status === key);
    lines.push(`${ATTENDANCE_STATUS[key].icon} ${key === 'problem' ? 'پیگیری' : ATTENDANCE_STATUS[key].label}: ${group.length ? group.map((m) => detail(m, entries[m.id])).join('، ') : '—'}`);
  }
  const missing = members.filter((m) => !entries[m.id]);
  lines.push(`ثبت‌نشده: ${toPersianDigits(missing.length)} نفر${missing.length ? ` (${missing.map((m) => m.name).join('، ')})` : ''}`);
  return lines.join('\n');
}

export function paymentReport(sessionId) {
  const s = getSession(sessionId);
  if (!s) throw new Error('جلسه پیدا نشد.');
  const payments = getData().payments.filter((p) => p.sessionId === sessionId);
  const members = membersFor(s);
  const paid = members.filter((m) => payments.some((p) => p.memberId === m.id && p.paid));
  const unpaid = members.filter((m) => !payments.some((p) => p.memberId === m.id && p.paid));
  return [
    `گزارش شهریه — جلسه ${sessionName(s)}`,
    `✅ پرداخت‌کرده‌ها: ${paid.length ? paid.map((m) => m.name).join('، ') : '—'}`,
    `❌ پرداخت‌نشده‌ها: ${unpaid.length ? unpaid.map((m) => m.name).join('، ') : '—'}`,
  ].join('\n');
}

/** Latin-digit YYYY-MM-DD stamp so filenames stay sortable and shell-safe. */
function fileStamp(s, suffix = '') {
  const base = `${s.jy}-${String(s.jm).padStart(2, '0')}-${String(s.jd).padStart(2, '0')}`;
  return `My-Class-Track-${base}${suffix}.csv`;
}

/** RFC 4180 quoting; BOM makes Persian text readable in Excel. */
export function csv(rows) {
  return '\uFEFF' + rows.map((row) => row.map((cell) => {
    const value = String(cell ?? '');
    const doubled = value.replace(/"/g, String.fromCharCode(34, 34));
    return /[",\r\n]/.test(value) ? `"${doubled}"` : value;
  }).join(',')).join('\r\n') + '\r\n';
}

export function membersCsv() {
  return csv([
    ['نام', 'شماره تماس', 'تولد شمسی', 'نقش‌ها', 'یادداشت', 'وضعیت'],
    ...getMembers({ includeInactive: true }).map((m) => [
      m.name, m.phone, m.birth ? formatJalali(m.birth.jy, m.birth.jm, m.birth.jd) : '',
      (m.roles || []).join('، '), m.note, m.active === false ? 'آرشیوشده' : 'فعال',
    ]),
  ]);
}

export function attendanceCsv(sessionId, slot) {
  const s = getSession(sessionId);
  if (!s || ![1, 2].includes(Number(slot))) throw new Error('جلسه یا نوبت نامعتبر است.');
  const entries = s.slots?.[String(slot)] || {};
  return csv([
    ['جلسه', 'نوبت', 'نام', 'وضعیت', 'ساعت تأخیر', 'یادداشت'],
    ...membersFor(s).map((m) => {
      const r = entries[m.id];
      return [formatJalali(s.jy, s.jm, s.jd), toPersianDigits(slot), m.name,
      r ? ATTENDANCE_STATUS[r.status]?.label || '' : 'ثبت‌نشده', r?.lateTime ? toPersianDigits(r.lateTime) : '', r?.note || ''];
    }),
  ]);
}

export function paymentsCsv(sessionId) {
  const s = getSession(sessionId);
  if (!s) throw new Error('جلسه پیدا نشد.');
  const payments = getData().payments.filter((p) => p.sessionId === sessionId);
  return csv([
    ['جلسه', 'نام', 'وضعیت شهریه', 'تاریخ پرداخت', 'یادداشت فیش'],
    ...membersFor(s).map((m) => {
      const p = payments.find((x) => x.memberId === m.id);
      const date = p?.dateJy;
      return [formatJalali(s.jy, s.jm, s.jd), m.name, p?.paid ? 'پرداخت شد' : 'پرداخت نشده',
      date && typeof date === 'object' ? formatJalali(date.jy, date.jm, date.jd) : (typeof date === 'string' ? date : ''), p?.note || ''];
    }),
  ]);
}

export function downloadCsv(filename, contents) {
  const url = URL.createObjectURL(new Blob([contents], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copy text to the clipboard, with an execCommand fallback for browsers that
 * refuse the async clipboard API (non-secure contexts, older WebViews).
 * Returns true when the text actually reached the clipboard.
 */
export async function copyText(text, okMessage, failMessage) {
  try {
    await navigator.clipboard.writeText(text);
    toast(okMessage || 'متن کپی شد.');
    return true;
  } catch {
    const ta = el('textarea', { class: 'visually-hidden', 'aria-hidden': 'true' });
    ta.value = text;
    document.body.append(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    toast(ok ? (okMessage || 'متن کپی شد.') : (failMessage || 'کپی ممکن نشد؛ متن را انتخاب کنید.'), ok ? 'success' : 'error');
    return ok;
  }
}

/** Open the report in a modal so it can be copied, shared, printed or exported. */
export function openReport(sessionId, kind = 'attendance', slot = 1) {
  const panel = reportPanel(sessionId, kind, slot);
  formModal({
    title: kind === 'payment' ? 'گزارش شهریه' : `گزارش حضور — نوبت ${toPersianDigits(slot)}`,
    body: panel,
    submitLabel: 'بستن',
    cancelLabel: 'بستن',
    onSubmit: () => null,
  });
}
export function reportPanel(sessionId, kind = 'attendance', slot = 1) {
  const session = getSession(sessionId);
  if (!session) return el('p', {}, 'جلسه پیدا نشد.');
  const title = kind === 'payment' ? 'گزارش شهریه' : `گزارش حضور — نوبت ${toPersianDigits(slot)}`;
  const text = kind === 'payment' ? paymentReport(sessionId) : attendanceReport(sessionId, slot);
  const body = el('pre', { class: 'report__text', dir: 'rtl' }, text);
  const panel = el('section', { class: 'card report-panel' }, [
    el('h3', { class: 'card__title' }, title), body,
  ]);
  const actions = el('div', { class: 'btn-row no-print' }, [
    el('button', { type: 'button', class: 'btn btn--primary', onclick: () => copyText(text, 'متن کپی شد. می‌توانید در واتساپ بفرستید.', 'کپی ممکن نشد؛ متن را از کادر گزارش انتخاب کنید.') }, 'کپی متن'),
    el('button', {
      type: 'button', class: 'btn btn--secondary',
      onclick: async () => {
        if (!navigator.share) return;
        try { await navigator.share({ text }); } catch (err) {
          if (err.name !== 'AbortError') toast('اشتراک‌گذاری انجام نشد.', 'error');
        }
      },
    }, [icon('phone'), 'اشتراک‌گذاری']),
    el('button', {
      type: 'button', class: 'btn btn--secondary',
      onclick: () => downloadCsv(fileStamp(session, kind === 'attendance' ? `-nobat${slot}` : '-shahrie'),
        kind === 'payment' ? paymentsCsv(sessionId) : attendanceCsv(sessionId, slot)),
    }, 'دریافت CSV'),
    el('button', { type: 'button', class: 'btn btn--ghost', onclick: () => window.print() }, 'چاپ / PDF'),
  ]);
  if (!navigator.share) actions.querySelectorAll('button')[1].remove();
  panel.append(actions);
  return panel;
}
