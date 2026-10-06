/* ============================================================
   src/media.js — Avatars and voice notes
   Both features produce data-URLs that end up in localStorage,
   so every path here is deliberately size-limited. No dependency
   beyond the browser APIs (canvas, MediaRecorder).
   ============================================================ */

/* ---------- Avatars ---------- */

/** Largest avatar edge in CSS pixels. Anything bigger is wasted bytes. */
export const AVATAR_SIZE = 160;

/** How many characters of a name to use for initials (Persian-aware). */
export function initials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return "؟";
  if (parts.length === 1) return parts[0].slice(0, 2);
  // First letter of the first and last part reads best for Persian names.
  return `${parts[0][0]}${parts[parts.length - 1][0]}`;
}

/** A stable hue (0-359) derived from a string, for the initials avatar. */
export function hueFor(text) {
  let hash = 0;
  const s = String(text || "");
  for (let i = 0; i < s.length; i += 1) {
    hash = (hash * 31 + s.charCodeAt(i)) % 360;
  }
  return hash;
}

/**
 * Read an image File and return a downscaled square JPEG data-URL.
 * The image is centre-cropped to a square, so faces are not stretched.
 *
 * @param {File} file
 * @returns {Promise<string>} data-URL
 */
export function fileToAvatar(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith("image/")) {
      reject(new Error("فایل انتخابی تصویر نیست."));
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();

    const cleanup = () => URL.revokeObjectURL(url);

    img.onload = () => {
      try {
        const side = Math.min(img.naturalWidth, img.naturalHeight);
        const sx = (img.naturalWidth - side) / 2;
        const sy = (img.naturalHeight - side) / 2;

        const canvas = document.createElement("canvas");
        canvas.width = AVATAR_SIZE;
        canvas.height = AVATAR_SIZE;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("رسم تصویر ممکن نشد.");
        ctx.drawImage(img, sx, sy, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);

        // 0.82 keeps the file small while staying visually clean at 160px.
        resolve(canvas.toDataURL("image/jpeg", 0.82));
      } catch (err) {
        reject(err);
      } finally {
        cleanup();
      }
    };
    img.onerror = () => {
      cleanup();
      reject(new Error("تصویر خوانده نشد."));
    };
    img.src = url;
  });
}

/**
 * Build an avatar node for a member: their photo when they have one, otherwise
 * a coloured circle with their initials.
 *
 * @param {Object} member { name, avatar }
 * @param {Object} [options] { size: 'sm'|'md'|'lg' }
 */
export function avatarNode(member, { size = "md" } = {}) {
  const name = member?.name || "";
  const wrap = document.createElement("span");
  wrap.className = `avatar avatar--${size}`;

  if (member?.avatar) {
    const img = document.createElement("img");
    img.className = "avatar__img";
    img.src = member.avatar;
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    wrap.append(img);
    wrap.setAttribute("aria-hidden", "true");
    return wrap;
  }

  const text = document.createElement("span");
  text.className = "avatar__initials";
  text.textContent = initials(name);
  // Hue from the name so the same person always gets the same colour.
  wrap.style.setProperty("--avatar-hue", String(hueFor(name)));
  wrap.append(text);
  wrap.setAttribute("aria-hidden", "true");
  return wrap;
}

/* ---------- Voice notes ---------- */

/** Hard ceiling for a single voice note. Keeps storage predictable. */
export const MAX_RECORDING_MS = 60000;

/** Is recording available in this browser/context? */
export function canRecord() {
  return (
    typeof window !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof window.MediaRecorder !== "undefined"
  );
}

/** Pick a container the browser actually supports. */
function pickMimeType() {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const type of candidates) {
    try {
      if (window.MediaRecorder.isTypeSupported(type)) return type;
    } catch {
      /* keep trying */
    }
  }
  return "";
}

/**
 * A small recorder wrapper. Always release it with `stop()` or `cancel()`:
 * the microphone track stays live until you do.
 *
 * @param {Object} [options] { maxMs, onTick(elapsedMs), onStop(dataUrl, ms) }
 */
export function createRecorder({
  maxMs = MAX_RECORDING_MS,
  onTick = () => {},
  onStop = () => {},
} = {}) {
  let recorder = null;
  let stream = null;
  let chunks = [];
  let startedAt = 0;
  let tickId = null;
  let autoStopId = null;
  let cancelled = false;

  const release = () => {
    if (tickId) {
      clearInterval(tickId);
      tickId = null;
    }
    if (autoStopId) {
      clearTimeout(autoStopId);
      autoStopId = null;
    }
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      stream = null;
    }
    recorder = null;
    chunks = [];
  };

  /** Stop the microphone and hand the clip back as a data-URL. */
  function stop() {
    if (!recorder) return;
    try {
      recorder.stop();
    } catch {
      release();
    }
  }

  /** Stop without delivering a clip (user navigated away, pressed cancel). */
  function cancel() {
    cancelled = true;
    stop();
  }

  async function start() {
    if (recorder) return { ok: true };
    if (!canRecord())
      return { ok: false, error: "ضبط صدا در این مرورگر پشتیبانی نمی‌شود." };

    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      return { ok: false, error: "دسترسی به میکروفون داده نشد." };
    }

    const mimeType = pickMimeType();
    try {
      recorder = mimeType
        ? new window.MediaRecorder(stream, { mimeType })
        : new window.MediaRecorder(stream);
    } catch {
      release();
      return { ok: false, error: "شروع ضبط ممکن نشد." };
    }

    chunks = [];
    recorder.addEventListener("dataavailable", (e) => {
      if (e.data && e.data.size) chunks.push(e.data);
    });
    recorder.addEventListener("stop", () => {
      const elapsed = Date.now() - startedAt;
      const blob = new Blob(chunks, {
        type: recorder?.mimeType || "audio/webm",
      });
      const wasCancelled = cancelled;
      release();
      cancelled = false;
      if (wasCancelled || !blob.size) {
        onStop("", elapsed);
        return;
      }

      // A voice note longer than a minute is almost never useful here and
      // would bloat storage, so clips are hard-capped.
      if (blob.size > 700000) {
        onStop("", elapsed);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => onStop(String(reader.result || ""), elapsed);
      reader.onerror = () => onStop("", elapsed);
      reader.readAsDataURL(blob);
    });

    startedAt = Date.now();
    recorder.start();
    onTick(0);
    tickId = setInterval(() => onTick(Date.now() - startedAt), 200);
    autoStopId = setTimeout(() => stop(), maxMs);
    return { ok: true };
  }

  return {
    start,
    stop,
    cancel,
    isRecording: () => !!recorder,
    /** Recording duration in ms (0 when idle). */
    elapsed: () => (recorder ? Date.now() - startedAt : 0),
    maxMs,
  };
}

/** Format a duration in ms as «۰:۰۷» with Persian digits. */
export function formatDuration(ms) {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${toPersian(m)}:${toPersian(pad(s))}`;
}

function toPersian(value) {
  return String(value).replace(/[0-9]/g, (d) => "۰۱۲۳۴۵۶۷۸۹"[Number(d)]);
}

export default {
  AVATAR_SIZE,
  MAX_RECORDING_MS,
  initials,
  hueFor,
  fileToAvatar,
  avatarNode,
  canRecord,
  createRecorder,
  formatDuration,
};
