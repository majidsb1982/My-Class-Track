/* ============================================================
   src/timer.js — Door timer (phase 4)
   Countdown to class start with alarms at 15/8/5/3 minutes.
   Uses Date.now() as the source of truth so it survives screen
   lock and tab switches. The target time is persisted in the store.
   ============================================================ */

import { el, icon, toast } from './ui.js';
import { toPersianDigits } from './jalali.js';

/* ---------- Config ---------- */

const TARGET_KEY = 'mct:timer-target';
/** Minutes-before-start at which to fire an alarm (descending). */
export const ALARM_MINUTES = [15, 8, 5, 3];
const TICK_MS = 250;

/* ---------- Persistence (target time only) ---------- */

function saveTarget(iso) {
  try {
    if (iso) localStorage.setItem(TARGET_KEY, iso);
    else localStorage.removeItem(TARGET_KEY);
  } catch { /* storage unavailable — timer still works for this session */ }
}

export function loadTarget() {
  try {
    const raw = localStorage.getItem(TARGET_KEY);
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  } catch {
    return null;
  }
}

/* ---------- Audio (Web Audio API) ---------- */

let audioCtx = null;

/** Lazily create the AudioContext. Must follow a user gesture. */
function ensureAudio() {
  if (audioCtx) return audioCtx;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  try {
    audioCtx = new Ctx();
  } catch {
    audioCtx = null;
  }
  return audioCtx;
}

/** A short, pleasant two-tone chime. */
export function playChime(repeats = 2) {
  const ctx = ensureAudio();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume().catch(() => { });

  const now = ctx.currentTime;
  for (let i = 0; i < repeats; i += 1) {
    const start = now + i * 0.55;
    [880, 1174].forEach((freq, j) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const t0 = start + j * 0.18;
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(0.28, t0 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.34);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.36);
    });
  }
}

/** Patterned vibration: three short buzzes. */
export function vibrate() {
  if (navigator.vibrate) {
    try { navigator.vibrate([220, 120, 220, 120, 320]); } catch { /* ignore */ }
  }
}

/* ---------- Notifications ---------- */

export function notificationsSupported() {
  return typeof Notification !== 'undefined';
}

export function notificationPermission() {
  return notificationsSupported() ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission() {
  if (!notificationsSupported()) return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

function notify(title, body) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return;
  try {
    // eslint-disable-next-line no-new
    new Notification(title, { body, tag: 'mct-timer', renotify: true });
  } catch { /* some browsers require a service worker for this */ }
}

/* ---------- Formatting ---------- */

/** Split milliseconds into day/hour/minute/second parts. */
function breakdown(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    totalSeconds: total,
  };
}

function pad2(n) { return String(n).padStart(2, '0'); }

/** Human countdown string with Persian digits, e.g. «۱۲:۰۵». */
export function formatCountdown(ms) {
  const b = breakdown(ms);
  if (b.days > 0) {
    return toPersianDigits(`${b.days}:${pad2(b.hours)}:${pad2(b.minutes)}:${pad2(b.seconds)}`);
  }
  return toPersianDigits(`${pad2(b.hours)}:${pad2(b.minutes)}:${pad2(b.seconds)}`);
}

/** Phrase used in the big alarm overlay, e.g. «به دکتر بگویید: ۸ دقیقه مانده». */
export function alarmPhrase(minutes) {
  return `به دکتر بگویید: ${toPersianDigits(minutes)} دقیقه مانده`;
}

/* ---------- Timer screen ---------- */

/**
 * Render the full-screen door timer into a container.
 * @param {HTMLElement} container
 * @param {Object} options { getStartTime: () => Date|null, onBack: () => void }
 */
export function renderTimer(container, options = {}) {
  const { getStartTime = () => null, onBack = () => { } } = options;

  let tickId = null;
  let firedAlarms = new Set();
  let target = loadTarget();
  let running = false;

  /* --- DOM --- */
  const timeEl = el('div', { class: 'timer__time', role: 'timer', 'aria-live': 'off' }, '۰۰:۰۰:۰۰');
  const statusEl = el('p', { class: 'timer__status' }, 'آماده');
  const targetLabel = el('p', { class: 'timer__target' }, '');

  const startBtn = el('button', {
    type: 'button', class: 'btn btn--primary btn--lg btn--block',
    onclick: () => toggleTimer(),
  }, [icon('clock'), 'شروع تایمر']);

  const resetBtn = el('button', {
    type: 'button', class: 'btn btn--secondary btn--block',
    onclick: () => resetTimer(),
  }, 'بازنشانی');

  const backBtn = el('button', {
    type: 'button', class: 'icon-btn timer__back', 'aria-label': 'بازگشت',
    onclick: () => { stopTicking(); onBack(); },
  }, icon('chevronRight'));

  const notifyBtn = el('button', {
    type: 'button', class: 'btn btn--ghost btn--sm',
    onclick: () => askNotificationPermission(),
  }, 'فعال‌سازی اعلان');

  const root = el('div', { class: 'timer-screen' }, [
    el('div', { class: 'timer__topbar' }, [
      backBtn,
      el('span', { class: 'timer__topbar-title' }, 'تایمر پشت در'),
      el('span', { class: 'timer__topbar-spacer' }),
    ]),
    el('div', { class: 'timer__body' }, [
      timeEl,
      statusEl,
      targetLabel,
    ]),
    el('div', { class: 'timer__controls' }, [
      startBtn,
      resetBtn,
      notifyBtn,
    ]),
  ]);

  // Mount on <body> so this full-screen mode survives page re-renders.
  document.querySelector('.timer-screen')?.remove();
  document.body.append(root);

  /* --- Alarm overlay --- */

  function showAlarm(minutes) {
    const overlay = el('div', {
      class: 'alarm-overlay', role: 'alertdialog', 'aria-modal': 'true',
    }, [
      el('div', { class: 'alarm-overlay__content' }, [
        el('div', { class: 'alarm-overlay__icon' }, icon('clock')),
        el('p', { class: 'alarm-overlay__message' }, alarmPhrase(minutes)),
        el('button', {
          type: 'button', class: 'btn btn--primary btn--lg',
          onclick: () => overlay.remove(),
        }, 'متوجه شدم'),
      ]),
    ]);
    document.body.append(overlay);
    // Auto-dismiss so a forgotten overlay never blocks the screen forever.
    setTimeout(() => overlay.remove(), 60000);
  }

  function fireAlarm(minutes) {
    playChime(2);
    vibrate();
    notify('My-Class-Track', alarmPhrase(minutes));
    showAlarm(minutes);
  }

  /* --- Tick loop --- */

  function stopTicking() {
    if (tickId) { clearInterval(tickId); tickId = null; }
  }

  function tick() {
    if (!target) return;
    const remaining = target.getTime() - Date.now();
    timeEl.textContent = formatCountdown(remaining);

    if (remaining <= 0) {
      timeEl.classList.add('timer__time--done');
      statusEl.textContent = 'کلاس شروع شد';
      if (!firedAlarms.has(0)) {
        firedAlarms.add(0);
        playChime(3);
        vibrate();
        notify('My-Class-Track', 'کلاس شروع شد');
        showAlarm(0);
      }
      stopTicking();
      return;
    }

    const minutesLeft = remaining / 60000;
    for (const m of ALARM_MINUTES) {
      if (minutesLeft <= m && !firedAlarms.has(m)) {
        firedAlarms.add(m);
        fireAlarm(m);
      }
    }
  }

  function startTicking() {
    stopTicking();
    tickId = setInterval(tick, TICK_MS);
    tick();
  }

  /* --- Controls --- */

  function resolveTarget() {
    // Prefer an explicit target (running timer), else the next class start.
    if (target && target.getTime() > Date.now()) return target;
    const start = getStartTime();
    return start instanceof Date ? start : null;
  }

  function toggleTimer() {
    if (running) {
      running = false;
      stopTicking();
      statusEl.textContent = 'متوقف شد';
      setStartButton(false);
      return;
    }

    // First user gesture: unlock audio.
    ensureAudio();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => { });

    target = resolveTarget();
    if (!target) {
      toast('ابتدا در تنظیمات یک کلاس هفتگی تعریف کنید.', 'error');
      return;
    }
    saveTarget(target.toISOString());
    firedAlarms = new Set();
    running = true;
    timeEl.classList.remove('timer__time--done');
    statusEl.textContent = 'در حال شمارش';
    setStartButton(true);
    renderTargetLabel();
    startTicking();
  }

  function resetTimer() {
    running = false;
    stopTicking();
    saveTarget(null);
    target = null;
    firedAlarms = new Set();
    timeEl.textContent = formatCountdown(0);
    timeEl.classList.remove('timer__time--done');
    statusEl.textContent = 'آماده';
    setStartButton(false);
    renderTargetLabel();
  }

  function setStartButton(isRunning) {
    startBtn.replaceChildren(
      icon(isRunning ? 'close' : 'clock'),
      isRunning ? 'توقف تایمر' : 'شروع تایمر',
    );
  }

  function renderTargetLabel() {
    if (!target) { targetLabel.textContent = ''; return; }
    const d = new Date(target);
    const hh = pad2(d.getHours());
    const mm = pad2(d.getMinutes());
    targetLabel.textContent = `زمان هدف: ساعت ${toPersianDigits(`${hh}:${mm}`)}`;
  }

  async function askNotificationPermission() {
    const res = await requestNotificationPermission();
    if (res === 'granted') toast('اعلان‌ها فعال شد.', 'success');
    else if (res === 'unsupported') toast('این مرورگر از اعلان پشتیبانی نمی‌کند.', 'info');
    else toast('اجازه اعلان داده نشد.', 'error');
  }

  /* --- Resume on open --- */

  if (target && target.getTime() > Date.now()) {
    running = true;
    setStartButton(true);
    statusEl.textContent = 'در حال شمارش';
    renderTargetLabel();
    startTicking();
  } else {
    target = null;
    timeEl.textContent = formatCountdown(0);
    renderTargetLabel();
  }

  // Keep ticking accurately when the tab becomes visible again.
  const onVisible = () => { if (running) tick(); };
  document.addEventListener('visibilitychange', onVisible);

  return {
    destroy: () => {
      stopTicking();
      document.removeEventListener('visibilitychange', onVisible);
    },
  };
}

export default {
  ALARM_MINUTES,
  loadTarget,
  renderTimer,
  formatCountdown,
  alarmPhrase,
  playChime,
  vibrate,
  notificationsSupported,
  notificationPermission,
  requestNotificationPermission,
};