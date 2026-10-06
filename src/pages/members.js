/* ============================================================
   src/pages/members.js — Members page (phase 3)
   List + search + add/edit form + roles + new period + archive.
   ============================================================ */

import {
  el, icon, toast, confirmDialog, emptyState, pageHead,
  textField, textAreaField, checkboxChips, formModal,
  createJalaliDatePicker, debounce,
} from '../ui.js';
import {
  ROLES, ROLE_KEYS, getMembers, saveMember, archiveMember,
  getPeriods, startNewPeriod, findPhoneOwner,
  getMemberHistory, getMemberStats, ATTENDANCE_STATUS,
} from '../store.js';
import { membersCsv, downloadCsv } from '../reports.js';
import { formatJalali, jalaliWeekdayName, todayJalali, toPersianDigits } from '../jalali.js';

let searchTerm = '';

/** Render the members page into the given container. */
export function renderMembers(container) {
  container.append(pageHead('اعضا', 'فهرست اعضای کلاس، نقش‌ها و دوره‌ها'));

  container.append(el('div', { class: 'btn-row mb-4' }, [
    el('button', {
      type: 'button', class: 'btn btn--primary grow',
      onclick: () => openMemberForm(null),
    }, [icon('plus'), 'افزودن عضو']),
    el('button', {
      type: 'button', class: 'btn btn--secondary',
      onclick: () => openNewPeriod(),
    }, [icon('sparkles'), 'دوره جدید']),
    el('button', {
      type: 'button', class: 'btn btn--ghost',
      onclick: () => {
        downloadCsv(`members-${todayStamp()}.csv`, membersCsv());
        toast('فهرست اعضا به‌صورت CSV دریافت شد.', 'success');
      },
    }, 'CSV اعضا'),
  ]));

  // Search
  const searchInput = el('input', {
    class: 'input', type: 'search', placeholder: 'جستجوی نام یا شماره…',
    value: searchTerm, 'aria-label': 'جستجوی اعضا',
  });
  const rerenderList = debounce(() => renderList(listWrap), 160);
  searchInput.addEventListener('input', () => {
    searchTerm = searchInput.value.trim();
    rerenderList();
  });
  container.append(el('div', { class: 'field' }, [searchInput]));

  const listWrap = el('div', {});
  container.append(listWrap);
  renderList(listWrap);

  // Periods archive
  container.append(renderPeriodsSection());
}

/* ---------- List ---------- */

function renderList(wrap) {
  wrap.replaceChildren();

  const all = getMembers({ includeInactive: true });
  const active = all.filter((m) => m.active !== false);

  if (!all.length) {
    wrap.append(emptyState({
      icon: 'members',
      title: 'فهرست اعضا خالی است',
      text: 'اعضای کلاس را با نام، شماره تماس، تاریخ تولد و نقش‌ها اضافه کنید.',
      actionLabel: 'افزودن اولین عضو',
      onAction: () => openMemberForm(null),
    }));
    return;
  }

  const term = searchTerm.toLowerCase();
  const filtered = active.filter((m) => {
    if (!term) return true;
    return m.name.toLowerCase().includes(term) || (m.phone || '').includes(term);
  });

  if (!filtered.length) {
    wrap.append(el('p', { class: 'muted center mt-4' }, 'عضوی با این عبارت پیدا نشد.'));
    return;
  }

  const list = el('ul', { class: 'list' });
  filtered.forEach((m) => list.append(renderMemberItem(m)));
  wrap.append(list);

  const archived = all.filter((m) => m.active === false);
  if (archived.length) {
    const details = el('details', { class: 'archive-box mt-4' }, [
      el('summary', {}, `اعضای آرشیوشده (${toPersianDigits(archived.length)})`),
    ]);
    const alist = el('ul', { class: 'list mt-3' });
    archived.forEach((m) => alist.append(renderMemberItem(m, true)));
    details.append(alist);
    wrap.append(details);
  }
}

function renderMemberItem(m, archived = false) {
  const roleBadges = m.roles.map((r) => el('span', {
    class: `badge badge--${ROLES[r]?.badge || 'primary'}`,
  }, ROLES[r]?.label || r));

  const metaBits = [];
  if (m.phone) metaBits.push(m.phone);
  if (m.birth) {
    metaBits.push(`تولد: ${formatJalali(m.birth.jy, m.birth.jm, m.birth.jd)}`);
  }

  const body = el('div', { class: 'list-item__body' }, [
    el('div', { class: 'list-item__title' }, m.name),
    roleBadges.length ? el('div', { class: 'badge-row mt-2' }, roleBadges) : null,
    metaBits.length ? el('div', { class: 'list-item__meta' }, metaBits.join(' • ')) : null,
    m.note ? el('div', { class: 'list-item__meta' }, m.note) : null,
  ]);

  const actions = el('div', { class: 'list-item__actions' }, [
      m.phone
        ? el('a', {
          class: 'icon-btn', href: `tel:${m.phone}`,
          'aria-label': `تماس با ${m.name}`,
        }, icon('phone'))
        : null,
    !archived
      ? el('button', {
        type: 'button', class: 'icon-btn', 'aria-label': `سابقه ${m.name}`,
        onclick: () => showMemberHistory(m),
      }, icon('attendance'))
      : null,
    !archived
      ? el('button', {
        type: 'button', class: 'icon-btn', 'aria-label': `ویرایش ${m.name}`,
        onclick: () => openMemberForm(m),
      }, icon('settings'))
      : null,
    !archived
      ? el('button', {
        type: 'button', class: 'icon-btn icon-btn--danger', 'aria-label': `آرشیو ${m.name}`,
        onclick: () => askArchive(m),
      }, icon('close'))
      : null,
  ]);

  return el('li', { class: `list-item${archived ? ' list-item--muted' : ''}` }, [body, actions]);
}

async function askArchive(m) {
  const ok = await confirmDialog({
    title: 'آرشیو عضو',
    text: `«${m.name}» از فهرست فعال حذف می‌شود اما سابقه او حفظ می‌شود. ادامه می‌دهید؟`,
    confirmText: 'آرشیو کن',
    danger: true,
  });
  if (!ok) return;
  archiveMember(m.id);
  toast('عضو آرشیو شد.', 'success');
  rerender();
}

/* ---------- Add / edit form ---------- */

function openMemberForm(member) {
  const isEdit = !!member;
  const nameField = textField({
    label: 'نام و نام خانوادگی', placeholder: 'مثال: علی رضایی',
    value: member?.name || '',
  });
  const phoneField = textField({
    label: 'شماره تماس', type: 'tel', inputMode: 'tel',
    placeholder: '۰۹۱۲۳۴۵۶۷۸۹', value: member?.phone || '',
  });
  // Warn (without blocking) when the same number is already on another member.
  phoneField.input.addEventListener('blur', () => {
    const value = phoneField.getValue();
    if (!value) return;
    const owner = findPhoneOwner(value, member?.id);
    if (owner) phoneField.setError(`این شماره قبلاً برای «${owner}» ثبت شده است.`);
  });
  const noteField = textAreaField({
    label: 'یادداشت', placeholder: 'نکته‌ای درباره این عضو…',
    value: member?.note || '',
  });

  const rolesChips = checkboxChips(
    ROLE_KEYS.map((k) => ({ key: k, label: ROLES[k].label })),
    member?.roles || [],
  );

  const birthPicker = createJalaliDatePicker({
    value: member?.birth || null,
    placeholder: 'انتخاب تاریخ تولد (شمسی)',
  });
  const birthError = el('span', { class: 'field__error', role: 'alert' });
  birthError.hidden = true;

  const body = el('div', {}, [
    nameField.root,
    phoneField.root,
    el('div', { class: 'field' }, [
      el('span', { class: 'field__label' }, 'تاریخ تولد'),
      birthPicker.root,
      birthError,
    ]),
    el('div', { class: 'field' }, [
      el('span', { class: 'field__label' }, 'نقش‌ها'),
      rolesChips.root,
    ]),
    noteField.root,
  ]);

  formModal({
    title: isEdit ? 'ویرایش عضو' : 'افزودن عضو',
    body,
    submitLabel: isEdit ? 'ذخیره تغییرات' : 'افزودن',
    onSubmit: () => {
      const input = {
        id: member?.id,
        name: nameField.getValue(),
        phone: phoneField.getValue(),
        birth: birthPicker.getValue(),
        roles: rolesChips.getValue(),
        note: noteField.getValue(),
      };
      const result = saveMember(input);
      if (!result.ok) {
        nameField.setError(result.errors.name);
        phoneField.setError(result.errors.phone);
        birthError.textContent = result.errors.birth || '';
        birthError.hidden = !result.errors.birth;
        return result.errors;
      }
      toast(isEdit ? 'تغییرات ذخیره شد.' : 'عضو افزوده شد.', 'success');
      rerender();
      return null;
    },
  });
}

/* ---------- New period ---------- */

function openNewPeriod() {
  const members = getMembers();
  if (!members.length) {
    toast('برای شروع دوره جدید ابتدا عضو اضافه کنید.', 'error');
    return;
  }

  const today = todayJalali();
  const dateText = `${jalaliWeekdayName(today.jy, today.jm, today.jd)} ${formatJalali(today.jy, today.jm, today.jd)}`;

  const roleInputs = new Map();
  const rows = members.map((m) => {
    const chips = checkboxChips(
      ROLE_KEYS.map((k) => ({ key: k, label: ROLES[k].label })),
      m.roles || [],
    );
    roleInputs.set(m.id, chips);
    return el('div', { class: 'period-row' }, [
      el('div', { class: 'period-row__name' }, m.name),
      chips.root,
    ]);
  });

  const body = el('div', {}, [
    el('p', { class: 'muted' }, `نقش‌های فعلی آرشیو می‌شوند و نقش‌های جدید از تاریخ ${dateText} اعمال می‌شود.`),
    el('div', { class: 'period-list' }, rows),
  ]);

  formModal({
    title: 'شروع دوره جدید',
    body,
    submitLabel: 'شروع دوره',
    onSubmit: () => {
      archiveCurrentRolesAndApply(roleInputs);
      toast('دوره جدید آغاز شد.', 'success');
      rerender();
      return null;
    },
  });
}

function archiveCurrentRolesAndApply(roleInputs) {
  const assignments = new Map();
  roleInputs.forEach((chips, memberId) => assignments.set(memberId, chips.getValue()));
  startNewPeriod(assignments);
}

/* ---------- Member history ---------- */

/**
 * Show one member's attendance record: aggregate stats plus every session
 * they have a decision for, newest first. Read-only.
 */
function showMemberHistory(member) {
  const stats = getMemberStats(member.id);
  const history = getMemberHistory(member.id);

  const body = el('div', {});

  // Stat tiles
  body.append(el('div', { class: 'stat-grid' }, [
    statTile('حضور', stats.present, 'success'),
    statTile('تأخیر', stats.late, 'warning'),
    statTile('غیبت', stats.absent, 'danger'),
    statTile('مشکل', stats.problem, 'problem'),
  ]));

  if (!stats.total) {
    body.append(el('p', { class: 'muted mt-4' }, 'برای این عضو هنوز حضوری ثبت نشده است.'));
  } else {
    body.append(el('div', { class: 'rate-line mt-4' }, [
      el('span', { class: 'rate-line__value' }, `${toPersianDigits(stats.rate)}٪`),
      el('span', { class: 'rate-line__label' },
        `حضور در ${toPersianDigits(stats.total)} جلسه ثبت‌شده`),
    ]));

    const list = el('ul', { class: 'list mt-3' });
    history.forEach((h) => {
      const st = h.status ? ATTENDANCE_STATUS[h.status] : null;
      const details = [];
      if (h.slot1?.status) details.push(`نوبت ۱: ${ATTENDANCE_STATUS[h.slot1.status].label}`);
      if (h.slot2?.status) details.push(`نوبت ۲: ${ATTENDANCE_STATUS[h.slot2.status].label}`);
      const late = (h.slot2 || h.slot1)?.lateTime;
      if (late) details.push(`حدود ${toPersianDigits(late)}`);
      const note = (h.slot2 || h.slot1)?.note;
      if (note) details.push(note);

      list.append(el('li', { class: 'list-item' }, [
        el('div', { class: 'list-item__body' }, [
          el('div', { class: 'list-item__title' },
            `${jalaliWeekdayName(h.session.jy, h.session.jm, h.session.jd)} ${formatJalali(h.session.jy, h.session.jm, h.session.jd)}`),
          el('div', { class: 'list-item__meta' }, details.join(' • ')),
        ]),
        st
          ? el('span', { class: `badge badge--${st.tone}` }, `${st.icon} ${st.label}`)
          : el('span', { class: 'badge' }, 'ثبت‌نشده'),
      ]));
    });
    body.append(list);
  }

  formModal({
    title: `سابقه حضور — ${member.name}`,
    body,
    submitLabel: 'بستن',
    cancelLabel: 'بستن',
    onSubmit: () => null,
  });
}

/** A small labelled count tile used in the member history dialog. */
function statTile(label, value, tone) {
  return el('div', { class: `stat stat--${tone}` }, [
    el('div', {}, [
      el('div', { class: 'stat__value' }, toPersianDigits(value)),
      el('div', { class: 'stat__label' }, label),
    ]),
  ]);
}

/* ---------- Periods archive section ---------- */

function renderPeriodsSection() {
  const periods = getPeriods();
  if (!periods.length) return el('div', {});

  const section = el('section', { class: 'section mt-6' }, [
    el('h3', { class: 'section__title' }, [icon('clock'), 'آرشیو دوره‌ها']),
  ]);

  const list = el('ul', { class: 'list' });
  [...periods].reverse().forEach((p) => {
    const start = formatJalali(p.startedAt.jy, p.startedAt.jm, p.startedAt.jd);
    const end = p.endedAt
      ? formatJalali(p.endedAt.jy, p.endedAt.jm, p.endedAt.jd)
      : 'تاکنون';
    const count = (p.members || []).length;

    const item = el('li', { class: 'list-item' }, [
      el('div', { class: 'list-item__body' }, [
        el('div', { class: 'list-item__title' }, `دوره ${start} تا ${end}`),
        el('div', { class: 'list-item__meta' }, `${toPersianDigits(count)} عضو`),
      ]),
    ]);
    item.append(el('button', {
      type: 'button', class: 'btn btn--ghost btn--sm',
      onclick: () => showPeriodDetail(p),
    }, 'مشاهده'));
    list.append(item);
  });

  section.append(list);
  return section;
}

function showPeriodDetail(period) {
  const start = formatJalali(period.startedAt.jy, period.startedAt.jm, period.startedAt.jd);
  const end = period.endedAt
    ? formatJalali(period.endedAt.jy, period.endedAt.jm, period.endedAt.jd)
    : 'تاکنون';

  const rows = (period.members || []).map((m) => {
    const roles = (m.roles || []).map((r) => ROLES[r]?.label || r).join('، ') || 'بدون نقش';
    return el('li', { class: 'list-item' }, [
      el('div', { class: 'list-item__body' }, [
        el('div', { class: 'list-item__title' }, m.name),
        el('div', { class: 'list-item__meta' }, roles),
      ]),
    ]);
  });

  formModal({
    title: `دوره ${start} تا ${end}`,
    body: el('ul', { class: 'list' }, rows),
    submitLabel: 'بستن',
    cancelLabel: 'بستن',
    onSubmit: () => null,
  });
}

/* ---------- Utilities ---------- */

function todayStamp() {
  const t = todayJalali();
  return `${t.jy}-${String(t.jm).padStart(2, '0')}-${String(t.jd).padStart(2, '0')}`;
}

function rerender() {
  const main = document.getElementById('main-content');
  if (!main) return;
  const page = main.firstElementChild;
  if (!page) return;
  page.dispatchEvent(new CustomEvent('mct:destroy', { bubbles: true }));
  page.replaceChildren();
  renderMembers(page);
}

export default { renderMembers };