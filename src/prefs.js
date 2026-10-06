/* ============================================================
   src/prefs.js — User preferences (theme, font size, debug)
   The ONLY module that reads or writes the `mct:prefs` key, so a
   theme change made in Settings and one made from the header toggle
   can never fight over a stale in-memory copy.
   ============================================================ */

export const PREF_KEY = "mct:prefs";

const VALID_THEMES = ["light", "dark"];
const VALID_FONT_SIZES = ["small", "medium", "large"];

let cache = null;

/** Read all preferences (never throws). */
export function getPrefs() {
  if (cache) return cache;
  let parsed = {};
  try {
    parsed = JSON.parse(localStorage.getItem(PREF_KEY)) || {};
  } catch {
    parsed = {};
  }
  cache = parsed && typeof parsed === "object" ? parsed : {};
  return cache;
}

/** Merge a patch into the stored preferences and persist it. */
export function setPrefs(patch) {
  const next = { ...getPrefs(), ...patch };
  // Drop keys the user explicitly cleared (e.g. fontSize: undefined).
  Object.keys(next).forEach((k) => {
    if (next[k] === undefined) delete next[k];
  });
  cache = next;
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(next));
  } catch {
    /* private mode / quota — preferences simply do not persist */
  }
  return next;
}

/** The stored theme, or '' when the user has never chosen one explicitly. */
export function getTheme() {
  const t = getPrefs().theme;
  return VALID_THEMES.includes(t) ? t : "";
}

/** The stored font size, or 'medium'. */
export function getFontSize() {
  const s = getPrefs().fontSize;
  return VALID_FONT_SIZES.includes(s) ? s : "medium";
}

/** Apply a theme to the document + theme-color meta. Returns the resolved theme. */
export function applyTheme(theme) {
  const resolved = VALID_THEMES.includes(theme)
    ? theme
    : window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  document.documentElement.dataset.theme = resolved;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta)
    meta.setAttribute("content", resolved === "dark" ? "#101121" : "#5b5bd6");
  return resolved;
}

/** Apply a font-size preference to the document. */
export function applyFontSize(size) {
  if (size === "small" || size === "large") {
    document.documentElement.dataset.fontsize = size;
  } else {
    document.documentElement.removeAttribute("data-fontsize");
  }
}

export default {
  PREF_KEY,
  getPrefs,
  setPrefs,
  getTheme,
  getFontSize,
  applyTheme,
  applyFontSize,
};
