/* ============================================================
   src/store.js — Data layer (the ONLY module touching localStorage)
   Schema versioning + safe migration + CRUD + change events.
   ============================================================ */

import { todayJalali, toJalali, addJalaliDays, jalaliDiffDays } from './jalali.js';

/* ---------- Config ---------- */

const ROOT_KEY = 'mct:data';
const SCHEMA_VERSION = 1;

/** Application roles a member can hold. */
export const ROLES = {
  attendance: { label: 'پیگیری حضور', badge: 'primary' },
  payment: { label: 'شهریه', badge: 'success' },
  homework: { label: 'تکالیف', badge: 'warning' },
  supporter: { label: 'حامی', badge: 'problem' },
};

export const ROLE_KEYS = Object.keys(ROLES);

/* ---------- Default schema ---------- */

function createDefaultData() {
  return {
    version: SCHEMA_VERSION,
    members: [],
    sessions: [],       // attendance per session: { id, jy,jm,jd, slots: {1:{},2:{}} }
    payments: [],       // { sessionId, memberId, paid, dateJy, note }
    homeworks: [],      // { id, jy,jm,jd, text }
    classSchedule: [],  // { id, weekday:0..6 (0=Sat), start:"19:00", end:"21:00" }
    periods: [],        // archived role assignments: { id, startedAt, endedAt, members:[{id,name,roles}] }
    meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  };
}

/* ---------- Persistence ---------- */

let data = createDefaultData();
let loaded = false;
const listeners = new Set();

function safeParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Migrate an older/incomplete payload to the current schema without losing data.
 * Each step is defensive: unknown fields are preserved, missing ones defaulted.
 */
function migrate(input) {
  const base = createDefaultData();
  if (!input || typeof input !== 'object') return base;

  const out = { ...base, ...input };
  out.version = SCHEMA_VERSION;

  // Ensure array fields are arrays.
  for (const key of ['members', 'sessions', 'payments', 'homeworks', 'classSchedule', 'periods']) {
    if (!Array.isArray(out[key])) out[key] = [];
  }

  // Normalise members (v0 -> v1: roles string -> array, Persian labels -> keys)
  out.members = out.members.map((m) => ({
    id: m.id || makeId('m'),
    name: typeof m.name === 'string' ? m.name : '',
    phone: typeof m.phone === 'string' ? m.phone : '',
    birth: m.birth && typeof m.birth === 'object' ? m.birth : null,
    roles: normalizeRoles(m.roles),
    note: typeof m.note === 'string' ? m.note : '',
    active: m.active !== false,
    createdAt: m.createdAt || new Date().toISOString(),
  }));

  out.meta = { ...base.meta, ...(input.meta || {}) };
  return out;
}

/** Load data from localStorage (idempotent). */
export function load() {
  if (loaded) return data;
  let raw = null;
  try {
    raw = localStorage.getItem(ROOT_KEY);
  } catch {
    raw = null;
  }
  const parsed = raw ? safeParse(raw) : null;
  if (!parsed) {
    data = createDefaultData();
    loaded = true;
    persist(); // write defaults once so the key exists
    return data;
  }
  const needsMigration = parsed.version !== SCHEMA_VERSION;
  data = migrate(parsed);
  loaded = true;
  // Persist the migrated shape immediately so an interrupted session cannot
  // leave a stale schema on disk.
  if (needsMigration) persist();
  return data;
}

function persist() {
  data.meta.updatedAt = new Date().toISOString();
  try {
    localStorage.setItem(ROOT_KEY, JSON.stringify(data));
  } catch (err) {
    // Quota or private mode — surface to the caller via event so UI can warn.
    emit({ type: 'error', reason: 'persist-failed', error: err });
    return false;
  }
  return true;
}

/** Emit a change event to all subscribers. */
function emit(detail) {
  listeners.forEach((fn) => {
    try { fn(detail); } catch { /* listener errors must not break the store */ }
  });
}

/** Subscribe to data changes. Returns an unsubscribe function. */
export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Commit a mutation: persist + notify. */
function commit(type, extra = {}) {
  persist();
  emit({ type, ...extra });
}

/* ---------- Helpers ---------- */

function makeId(prefix = 'x') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

/* ---------- Reads ---------- */

export function getData() {
  load();
  return clone(data);
}

export function getMembers({ includeInactive = false } = {}) {
  load();
  return clone(includeInactive ? data.members : data.members.filter((m) => m.active !== false));
}

export function getMember(id) {
  load();
  const m = data.members.find((x) => x.id === id);
  return m ? clone(m) : null;
}

export function getSchedule() {
  load();
  return clone(data.classSchedule);
}

export function getPeriods() {
  load();
  return clone(data.periods);
}

/* ---------- Member CRUD ---------- */

/**
 * Create or update a member.
 * @param {Object} input { id?, name, phone, birth, roles, note }
 * @returns {{ok:boolean, id?:string, errors?:Object}}
 */
export function saveMember(input) {
  load();
  const errors = validateMember(input);
  if (Object.keys(errors).length) return { ok: false, errors };

  const member = {
    id: input.id || makeId('m'),
    name: String(input.name).trim(),
    phone: normalizePhone(input.phone),
    birth: input.birth ? { jy: input.birth.jy, jm: input.birth.jm, jd: input.birth.jd } : null,
    roles: normalizeRoles(input.roles),
    note: String(input.note || '').trim(),
    active: true,
    createdAt: input.createdAt || new Date().toISOString(),
  };

  const idx = data.members.findIndex((m) => m.id === member.id);
  if (idx === -1) {
    data.members.push(member);
    commit('member:create', { id: member.id });
  } else {
    member.createdAt = data.members[idx].createdAt;
    member.active = data.members[idx].active !== false;
    data.members[idx] = member;
    commit('member:update', { id: member.id });
  }
  return { ok: true, id: member.id };
}

/** Deactivate (soft-delete) a member so history stays intact. */
export function archiveMember(id) {
  load();
  const m = data.members.find((x) => x.id === id);
  if (!m) return false;
  m.active = false;
  commit('member:archive', { id });
  return true;
}

/** Permanently remove a member. */
export function deleteMember(id) {
  load();
  const before = data.members.length;
  data.members = data.members.filter((m) => m.id !== id);
  if (data.members.length === before) return false;
  commit('member:delete', { id });
  return true;
}

/** Validate member input. Returns an errors map (empty when valid). */
export function validateMember(input) {
  const errors = {};
  const name = String(input?.name || '').trim();
  if (!name) errors.name = 'نام را وارد کنید.';
  else if (name.length > 80) errors.name = 'نام بیش از حد طولانی است.';

  const phone = String(input?.phone || '').trim();
  if (phone) {
    const digits = toLatinDigitsLocal(phone).replace(/[\s()-]/g, '');
    if (!/^0?9\d{9}$/.test(digits) && !/^0\d{2,3}\d{7,8}$/.test(digits)) {
      errors.phone = 'شماره تماس معتبر نیست (مثال: ۰۹۱۲۳۴۵۶۷۸۹).';
    }
  }

  if (input?.birth) {
    const { jy, jm, jd } = input.birth;
    if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) {
      errors.birth = 'تاریخ تولد معتبر نیست.';
    }
  }
  return errors;
}

/**
 * Coerce legacy role values (string or array, key or Persian label) into the
 * current array-of-keys form. Unknown values are dropped rather than kept.
 */
function normalizeRoles(value) {
  const list = Array.isArray(value) ? value : (value == null ? [] : [value]);
  const labelToKey = Object.fromEntries(ROLE_KEYS.map((k) => [ROLES[k].label, k]));
  const out = [];
  for (const raw of list) {
    if (typeof raw !== 'string') continue;
    const key = ROLE_KEYS.includes(raw) ? raw : labelToKey[raw.trim()];
    if (key && !out.includes(key)) out.push(key);
  }
  return out;
}

function toLatinDigitsLocal(v) {
  return String(v)
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function normalizePhone(phone) {
  const digits = toLatinDigitsLocal(String(phone || '')).replace(/[\s()-]/g, '');
  return digits;
}

/* ---------- Class schedule ---------- */

export function saveScheduleEntry(entry) {
  load();
  const errors = {};
  if (!Number.isInteger(entry.weekday) || entry.weekday < 0 || entry.weekday > 6) {
    errors.weekday = 'روز هفته را انتخاب کنید.';
  }
  if (!isTime(entry.start)) errors.start = 'ساعت شروع معتبر نیست.';
  if (!isTime(entry.end)) errors.end = 'ساعت پایان معتبر نیست.';
  if (!errors.start && !errors.end && timeToMinutes(entry.end) <= timeToMinutes(entry.start)) {
    errors.end = 'ساعت پایان باید بعد از شروع باشد.';
  }
  if (Object.keys(errors).length) return { ok: false, errors };

  const item = {
    id: entry.id || makeId('c'),
    weekday: entry.weekday,
    start: entry.start,
    end: entry.end,
  };
  const idx = data.classSchedule.findIndex((c) => c.id === item.id);
  if (idx === -1) data.classSchedule.push(item);
  else data.classSchedule[idx] = item;
  commit('schedule:save', { id: item.id });
  return { ok: true, id: item.id };
}

export function deleteScheduleEntry(id) {
  load();
  const before = data.classSchedule.length;
  data.classSchedule = data.classSchedule.filter((c) => c.id !== id);
  if (data.classSchedule.length === before) return false;
  commit('schedule:delete', { id });
  return true;
}

function isTime(v) {
  return typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}

export function timeToMinutes(v) {
  if (!isTime(v)) return NaN;
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}

/* ---------- Next class & birthdays ---------- */

/** Next upcoming class occurrence as { jy,jm,jd, start, end, weekday } or null. */
export function getNextClass(from = new Date()) {
  load();
  if (!data.classSchedule.length) return null;

  const todayJ = toJalali(from);
  // JS getDay: 0=Sun..6=Sat  ->  our weekday index: 0=Sat..6=Fri
  const todayIndex = (from.getDay() + 1) % 7;
  const nowMinutes = from.getHours() * 60 + from.getMinutes();

  let best = null;
  for (let offset = 0; offset <= 7; offset += 1) {
    for (const c of data.classSchedule) {
      const target = (todayIndex + offset) % 7;
      if (target !== c.weekday) continue;
      if (offset === 0 && timeToMinutes(c.start) <= nowMinutes) continue; // already started today
      const j = addJalaliDays(todayJ, offset);
      best = { ...j, start: c.start, end: c.end, weekday: c.weekday, offset };
      break;
    }
    if (best) break;
  }
  return best;
}

/** Upcoming birthdays within `days` days. Returns [{member, jy,jm,jd, daysLeft}] sorted. */
export function getUpcomingBirthdays(days = 7, from = new Date()) {
  load();
  const todayJ = toJalali(from);
  const out = [];
  for (const m of data.members) {
    if (m.active === false || !m.birth) continue;
    // Candidate birthday in the current or next Jalali year.
    for (const yearOffset of [0, 1]) {
      const jy = todayJ.jy + yearOffset;
      const candidate = safeBirthday(jy, m.birth.jm, m.birth.jd);
      if (!candidate) continue;
      const diff = jalaliDiffDays(candidate, todayJ);
      if (diff >= 0 && diff <= days) {
        out.push({ member: clone(m), ...candidate, daysLeft: diff });
        break;
      }
    }
  }
  return out.sort((a, b) => a.daysLeft - b.daysLeft);
}

/** Clamp a birthday to a valid date (handles Feb 30 style edge cases). */
function safeBirthday(jy, jm, jd) {
  try {
    const day = Math.min(jd, 29); // never exceed the shortest month
    return { jy, jm, jd: day };
  } catch {
    return null;
  }
}

/** Today's Jalali date, re-exported for convenience in UI modules. */
export { todayJalali };

/* ---------- Backup / restore ---------- */

/** Full data export as a plain object. */
export function exportData() {
  load();
  return clone(data);
}

/**
 * Validate a backup payload structure.
 * @returns {{ok:boolean, errors:string[], warnings:string[]}}
 */
export function validateBackup(payload) {
  const errors = [];
  const warnings = [];
  if (!payload || typeof payload !== 'object') {
    errors.push('ساختار فایل پشتیبان نامعتبر است.');
    return { ok: false, errors, warnings };
  }
  if (!Array.isArray(payload.members)) errors.push('بخش اعضا در فایل پشتیبان یافت نشد.');
  if (payload.version == null) warnings.push('نسخه فایل مشخص نیست؛ تلاش برای مهاجرت انجام می‌شود.');
  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Replace all data with a validated backup payload.
 * @returns {{ok:boolean, errors?:string[]}}
 */
export function importData(payload) {
  const check = validateBackup(payload);
  if (!check.ok) return { ok: false, errors: check.errors };
  data = migrate(payload);
  loaded = true;
  persist();
  emit({ type: 'data:import' });
  return { ok: true };
}

/** Wipe all data back to defaults. */
export function clearAll() {
  data = createDefaultData();
  loaded = true;
  persist();
  emit({ type: 'data:clear' });
}

export default {
  ROLES,
  ROLE_KEYS,
  load,
  subscribe,
  getData,
  getMembers,
  getMember,
  saveMember,
  archiveMember,
  deleteMember,
  validateMember,
  getSchedule,
  saveScheduleEntry,
  deleteScheduleEntry,
  getPeriods,
  getNextClass,
  getUpcomingBirthdays,
  exportData,
  validateBackup,
  importData,
  clearAll,
};