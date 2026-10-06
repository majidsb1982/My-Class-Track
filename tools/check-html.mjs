#!/usr/bin/env node
/* ============================================================
   tools/check-html.mjs — dependency-free PWA markup assertions
   Run with:  node tools/check-html.mjs
   Exits non-zero (1) when a required tag / manifest field is missing.
   No npm packages: the checks are plain string/regex lookups.
   ============================================================ */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const failures = [];
const passes = [];

/** Assert that `pattern` matches `text`, otherwise record a failure. */
function expect(name, text, pattern) {
  const ok =
    pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern);
  if (ok) passes.push(name);
  else failures.push(name);
}

let html;
let manifestRaw;
try {
  html = readFileSync(resolve(ROOT, "index.html"), "utf8");
  manifestRaw = readFileSync(resolve(ROOT, "manifest.webmanifest"), "utf8");
} catch (err) {
  console.error("✖ فایل‌های پروژه خوانده نشد:", err.message);
  process.exit(1);
}

/* ---------- index.html head ---------- */
expect('html lang="fa"', html, /<html[^>]*\blang="fa"/);
expect('html dir="rtl"', html, /<html[^>]*\bdir="rtl"/);
expect("charset UTF-8", html, /<meta\s+charset="UTF-8"/i);
expect("viewport meta", html, /<meta[^>]*name="viewport"/);
expect(
  "theme-color meta",
  html,
  /<meta[^>]*name="theme-color"[^>]*content="#[0-9a-fA-F]{6}"/,
);
expect("title My-Class-Track", html, /<title>My-Class-Track<\/title>/);
expect(
  "manifest link",
  html,
  /<link[^>]*rel="manifest"[^>]*href="manifest\.webmanifest"/,
);
expect("icon 192", html, /rel="icon"[^>]*icon-192\.png[^>]*sizes="192x192"/);
expect("apple-touch-icon", html, /rel="apple-touch-icon"/);
expect("styles.css link", html, /href="src\/styles\.css"/);
expect(
  "app.js module script",
  html,
  /<script[^>]*type="module"[^>]*src="src\/app\.js"/,
);
expect("noscript warning", html, /<noscript>/);
expect("skip link", html, /class="skip-link"/);
expect("no aria-live on main", html, !/<main[^>]*aria-live/);
expect("route-status live region", html, /id="route-status"[^>]*role="status"/);

/* ---------- manifest.webmanifest ---------- */
let manifest;
try {
  manifest = JSON.parse(manifestRaw);
} catch (err) {
  console.error("✖ manifest.webmanifest یک JSON معتبر نیست:", err.message);
  process.exit(1);
}

expect("manifest name", manifest.name, "My-Class-Track");
expect("manifest short_name", manifest.short_name, "My-Class-Track");
expect("manifest lang=fa", manifest.lang, "fa");
expect("manifest dir=rtl", manifest.dir, "rtl");
expect("manifest display=standalone", manifest.display, "standalone");
expect("manifest start_url", manifest.start_url, "./index.html");
expect("manifest theme_color", manifest.theme_color, /^#[0-9a-fA-F]{6}$/);
expect(
  "manifest background_color",
  manifest.background_color,
  /^#[0-9a-fA-F]{6}$/,
);

const icons = Array.isArray(manifest.icons) ? manifest.icons : [];
if (!icons.some((i) => i.sizes === "192x192"))
  failures.push("manifest icon 192x192");
else passes.push("manifest icon 192x192");
if (!icons.some((i) => i.sizes === "512x512" && i.purpose === "any"))
  failures.push("manifest icon 512x512 (any)");
else passes.push("manifest icon 512x512 (any)");
if (!icons.some((i) => i.purpose === "maskable"))
  failures.push("manifest maskable icon");
else passes.push("manifest maskable icon");

/* ---------- report ---------- */
console.log(`✔ ${passes.length} بررسی موفق`);
if (failures.length) {
  console.error("✖ بررسی‌های ناموفق:");
  failures.forEach((name) => console.error(`   - ${name}`));
  process.exit(1);
}
console.log("همه بررسی‌های PWA درست است.");
