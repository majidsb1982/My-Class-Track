/* ============================================================
   src/jalali.js — Jalali (Solar Hijri) calendar utilities
   Independent module. No dependencies.
   Algorithm: jalaali-js (Borkowski / Khayyam, 33-year cycle).
   ============================================================ */

const PERSIAN_DIGITS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

export const MONTH_NAMES = [
  'فروردین', 'اردیبهشت', 'خرداد', 'تیر', 'مرداد', 'شهریور',
  'مهر', 'آبان', 'آذر', 'دی', 'بهمن', 'اسفند',
];

/* Week starts on Saturday (شنبه). */
export const WEEKDAY_NAMES = ['شنبه', 'یک‌شنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه'];
export const WEEKDAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'];

/* ---------- Low-level helpers ---------- */

function div(a, b) { return ~~(a / b); }
function mod(a, b) { return a - ~~(a / b) * b; }

/** Is the given Jalali year a leap year (has 366 days)? */
export function isLeapJalaliYear(jy) {
  return jalCalLeap(jy) === 0;
}

/**
 * Number of days in a Jalali month (jm: 1..12).
 */
export function jalaliMonthLength(jy, jm) {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isLeapJalaliYear(jy) ? 30 : 29;
}

/* ---------- jalaali-js core algorithm ---------- */

function jalCalLeap(jy) {
  // Returns 0 for leap years, otherwise offset of the year within its cycle.
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  let bl = breaks.length;
  let jp = breaks[0];
  let jump = 0;
  let leap = -1;

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error('سال جلالی خارج از محدوده پشتیبانی است.');
  }

  for (let i = 1; i < bl; i += 1) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    jp = jm;
  }
  let n = jy - jp;

  if (jump - n < 6) {
    n = n - jump + div(jump + 4, 33) * 33;
  }
  leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return leap;
}

function jalCal(jy) {
  const breaks = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
    1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];
  const bl = breaks.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = breaks[0];
  let jm = 0;
  let jump = 0;

  if (jy < jp || jy >= breaks[bl - 1]) {
    throw new Error('سال جلالی خارج از محدوده پشتیبانی است.');
  }

  for (let i = 1; i < bl; i += 1) {
    jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  let n = jy - jp;

  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) {
    n = n - jump + div(jump + 4, 33) * 33;
  }
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;

  return { leap, gy, march };
}

/** Convert Jalali date to Julian Day Number. */
export function jalaliToJdn(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

/** Convert Julian Day Number to Jalali date. */
export function jdnToJalali(jdn) {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let jd;
  let jm;
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      jm = 1 + div(k, 31);
      jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  jm = 7 + div(k, 30);
  jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

/* Gregorian <-> Julian Day Number */
function g2d(gy, gm, gd) {
  let d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) + gd - 34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

/* ---------- Public conversions ---------- */

/**
 * Convert a Gregorian Date (local) to a Jalali date object {jy, jm, jd}.
 */
export function toJalali(date = new Date()) {
  return jdnToJalali(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));
}

/**
 * Convert a Jalali date to a Gregorian Date (local, at noon to avoid DST edges).
 */
export function toGregorian(jy, jm, jd) {
  const g = d2g(jalaliToJdn(jy, jm, jd));
  return new Date(g.gy, g.gm - 1, g.gd, 12, 0, 0, 0);
}

/* ---------- Today & formatting ---------- */

/** Today as a Jalali date object. */
export function todayJalali() {
  return toJalali(new Date());
}

/** Zero-pad a number to 2 digits (latin). */
function pad2(n) { return String(n).padStart(2, '0'); }

/** Convert latin digits in a string/number to Persian digits. */
export function toPersianDigits(value) {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

/** Convert Persian/Arabic digits in a string to latin digits. */
export function toLatinDigits(value) {
  return String(value)
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

/**
 * Format a Jalali date. Options:
 *   withMonthName: use month name instead of number
 *   persianDigits: render numbers as Persian digits (default true)
 */
export function formatJalali(jy, jm, jd, options = {}) {
  const { withMonthName = false, persianDigits = true } = options;
  let out;
  if (withMonthName) {
    out = `${jd} ${MONTH_NAMES[jm - 1]} ${jy}`;
  } else {
    out = `${jy}/${pad2(jm)}/${pad2(jd)}`;
  }
  return persianDigits ? toPersianDigits(out) : out;
}

/** Format a Gregorian Date as a Jalali string. */
export function formatDate(date, options = {}) {
  const j = toJalali(date);
  return formatJalali(j.jy, j.jm, j.jd, options);
}

/** Persian weekday name for a Jalali date. */
export function jalaliWeekdayName(jy, jm, jd) {
  const g = toGregorian(jy, jm, jd);
  // JS: 0=Sunday .. 6=Saturday  ->  Persian index: 0=Saturday
  return WEEKDAY_NAMES[(g.getDay() + 1) % 7];
}

/**
 * Parse a user-entered Jalali date string into {jy, jm, jd} or null.
 * Accepts Persian or Latin digits with separators / - . or spaces.
 */
export function parseJalali(input) {
  if (input == null) return null;
  const normalized = toLatinDigits(String(input).trim())
    .replace(/[\/\-\.\s]+/g, '/')
    .replace(/\/+$/g, '');
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length !== 3) return null;
  const [jy, jm, jd] = parts.map((p) => Number(p));
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return null;
  if (jy < 1 || jm < 1 || jm > 12 || jd < 1) return null;
  if (jd > jalaliMonthLength(jy, jm)) return null;
  return { jy, jm, jd };
}

/** Is a Jalali y/m/d a valid calendar date? */
export function isValidJalali(jy, jm, jd) {
  if (!Number.isInteger(jy) || !Number.isInteger(jm) || !Number.isInteger(jd)) return false;
  if (jm < 1 || jm > 12 || jd < 1) return false;
  return jd <= jalaliMonthLength(jy, jm);
}

/** Days between two Jalali dates (a - b), by calendar day. */
export function jalaliDiffDays(a, b) {
  return jalaliToJdn(a.jy, a.jm, a.jd) - jalaliToJdn(b.jy, b.jm, b.jd);
}

/** Add (or subtract) days to a Jalali date, returning a new Jalali object. */
export function addJalaliDays(date, days) {
  return jdnToJalali(jalaliToJdn(date.jy, date.jm, date.jd) + days);
}

/** Format time (HH:MM) as Persian digits. */
export function formatTime(hours, minutes, persianDigits = true) {
  const out = `${pad2(hours)}:${pad2(minutes)}`;
  return persianDigits ? toPersianDigits(out) : out;
}

/* ---------- Self-test ---------- */

/**
 * Run internal correctness checks for the Jalali converter.
 * Returns { ok, results: [{name, expected, actual, pass}] }.
 */
export function runSelfTest() {
  const results = [];
  const check = (name, expected, actual) => {
    results.push({ name, expected, actual, pass: expected === actual });
  };

  // Reference conversions (Gregorian -> Jalali)
  check('2024-03-20 -> 1403/01/01',
    '1403/01/01',
    (() => { const j = toJalali(new Date(2024, 2, 20)); return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`; })());
  check('2025-03-21 -> 1404/01/01',
    '1404/01/01',
    (() => { const j = toJalali(new Date(2025, 2, 21)); return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`; })());
  check('2024-03-19 -> 1402/12/29',
    '1402/12/29',
    (() => { const j = toJalali(new Date(2024, 2, 19)); return `${j.jy}/${pad2(j.jm)}/${pad2(j.jd)}`; })());

  // Round-trip Gregorian -> Jalali -> Gregorian
  const roundTrip = (y, m, d) => {
    const j = toJalali(new Date(y, m - 1, d));
    const g = toGregorian(j.jy, j.jm, j.jd);
    return `${g.getFullYear()}/${pad2(g.getMonth() + 1)}/${pad2(g.getDate())}`;
  };
  check('round-trip 2024-03-20', '2024/03/20', roundTrip(2024, 3, 20));
  check('round-trip 2000-01-01', '2000/01/01', roundTrip(2000, 1, 1));
  check('round-trip 1999-12-31', '1999/12/31', roundTrip(1999, 12, 31));

  // Month lengths
  check('1403/12 length (leap)', 30, jalaliMonthLength(1403, 12));
  check('1402/12 length (common)', 29, jalaliMonthLength(1402, 12));
  check('1403/01 length', 31, jalaliMonthLength(1403, 1));
  check('1403/07 length', 30, jalaliMonthLength(1403, 7));

  // Leap-year flags (1403 is a leap year)
  check('1403 is leap', true, isLeapJalaliYear(1403));
  check('1404 is not leap', false, isLeapJalaliYear(1404));

  // Digits
  check('persian digits', '۱۴۰۳', toPersianDigits('1403'));
  check('latin digits', '1403', toLatinDigits('۱۴۰۳'));

  // Parse
  const parsed = parseJalali('۱۴۰۳/۰۲/۱۵');
  check('parse persian date', '1403-2-15', parsed ? `${parsed.jy}-${parsed.jm}-${parsed.jd}` : 'null');
  check('parse invalid date (1403/12/31)', null, parseJalali('1403/12/31'));

  const ok = results.every((r) => r.pass);
  return { ok, results };
}

export default {
  MONTH_NAMES,
  WEEKDAY_NAMES,
  WEEKDAY_SHORT,
  isLeapJalaliYear,
  jalaliMonthLength,
  toJalali,
  toGregorian,
  todayJalali,
  formatJalali,
  formatDate,
  jalaliWeekdayName,
  parseJalali,
  isValidJalali,
  jalaliDiffDays,
  addJalaliDays,
  formatTime,
  toPersianDigits,
  toLatinDigits,
  runSelfTest,
};