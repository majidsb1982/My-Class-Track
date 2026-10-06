/* Browser smoke test for the audit fixes.
   Serves the project over HTTP (service workers need a real origin) and drives
   the real UI with Chrome. Run: node tools/smoke.mjs */
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(
  "C:\\Users\\Pishgam-lift\\.vscode\\extensions\\danielsanmedium.dscodegpt-3.24.76\\standalone\\",
);
const mod = require("patchright");
const chromium = mod.chromium ?? mod.default?.chromium;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
};

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://x");
    const rel = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = join(ROOT, rel.replace(/^\/+/, ""));
    const body = await readFile(file);
    res.writeHead(200, {
      "Content-Type": MIME[extname(file)] || "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const PORT = server.address().port;
const BASE = `http://127.0.0.1:${PORT}/`;

const DEBUG_PORT = 9371;
const chrome = spawn(
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${process.env.TEMP}\\mct-smoke`,
    "--headless=new",
    "--no-sandbox",
    "--no-first-run",
    "--disable-dev-shm-usage",
    "about:blank",
  ],
  { detached: true, stdio: "ignore" },
);
chrome.unref();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
for (let i = 0; i < 60; i += 1) {
  try {
    const r = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
    if (r.ok) break;
  } catch {
    /* retry */
  }
  await wait(200);
}

const results = [];
const check = (name, pass, extra = "") => {
  results.push({ name, pass, extra });
  console.log(
    `${pass ? "  OK  " : " FAIL "} ${name}${extra ? ` — ${extra}` : ""}`,
  );
};

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
const ctx = browser.contexts()[0] ?? (await browser.newContext());
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text().slice(0, 200));
});

await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".nav-link", { timeout: 15000 });

// 1. Route status live region announces navigation.
await page.click('.nav-link[data-route="members"]');
await wait(400);
const status = await page.locator("#route-status").innerText();
check("route-status announces page", status.includes("اعضا"), status);

// 2. Header theme button exposes aria-pressed and stays in sync with Settings.
const pressedBefore = await page.getAttribute("#theme-toggle", "aria-pressed");
await page.click("#theme-toggle");
await wait(300);
const pressedAfter = await page.getAttribute("#theme-toggle", "aria-pressed");
check(
  "theme toggle flips aria-pressed",
  pressedBefore !== pressedAfter,
  `${pressedBefore} -> ${pressedAfter}`,
);

await page.click('.nav-link[data-route="settings"]');
await page.waitForSelector(".segmented", { timeout: 5000 });
const themeNow = await page.evaluate(
  () => document.documentElement.dataset.theme,
);
// Click the opposite theme segment inside the first segmented control.
await page.evaluate(() => {
  const seg = document.querySelector(".segmented");
  const target = [...seg.querySelectorAll(".segmented__item")].find(
    (b) => !b.classList.contains("is-active"),
  );
  target.click();
});
await wait(400);
const pressedAfterSettings = await page.getAttribute(
  "#theme-toggle",
  "aria-pressed",
);
const themeChanged = await page.evaluate(
  () => document.documentElement.dataset.theme,
);
const expectedPressed = themeChanged === "dark" ? "true" : "false";
check(
  "settings theme keeps header in sync",
  pressedAfterSettings === expectedPressed,
  `theme=${themeChanged} aria-pressed=${pressedAfterSettings} (was ${themeNow})`,
);

// 3. Birthday validation: 31 Farvardin is kept, impossible dates are rejected.
await page.click('.nav-link[data-route="members"]');
await page.waitForSelector(".btn", { timeout: 5000 });
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => b.textContent.includes("افزودن عضو"))
    .click(),
);
await page.waitForSelector(".dialog--form", { timeout: 5000 });
await page.fill('.dialog--form input[type="text"]', "علی تستی");
await page.fill('.dialog--form input[type="tel"]', "۰۹۱۲۳۴۵۶۷۸۹");
// Open the Jalali picker, walk back to Farvardin (always 31 days), then pick 31.
await page.click(".dialog--form .date-trigger");
await page.waitForSelector(".datepicker__grid", { timeout: 5000 });
for (let i = 0; i < 24; i += 1) {
  const label = await page.locator(".datepicker__label").innerText();
  if (label.includes("فروردین")) break;
  await page.click('.datepicker__nav[aria-label="ماه قبل"]');
  await wait(60);
}
const monthLabel = await page.locator(".datepicker__label").innerText();
const dayClicked = await page.evaluate(() => {
  const btns = [...document.querySelectorAll(".datepicker__day")];
  const b = btns.find((x) => x.textContent.trim() === "31");
  if (!b) return false;
  b.click();
  return true;
});
check("picker offers day 31 in Farvardin", dayClicked, monthLabel);
await page.evaluate(() =>
  [...document.querySelectorAll(".dialog__actions button")]
    .find((b) => b.type === "submit")
    .click(),
);
await wait(600);

const saved = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mct:data") || "null");
  const m = d?.members?.find((x) => x.name === "علی تستی");
  return m ? { phone: m.phone, birth: m.birth } : null;
});
check("member saved", !!saved, JSON.stringify(saved));
check(
  "Persian phone normalised to latin",
  saved?.phone === "09123456789",
  saved?.phone,
);
check(
  "31-day birthday preserved (not clamped to 29)",
  saved?.birth?.jd === 31,
  JSON.stringify(saved?.birth),
);

// 4. Period change must not lose member data (atomic startNewPeriod).
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  const b = btns.find((x) => x.textContent.includes("دوره جدید"));
  if (b) b.click();
});
await page.waitForSelector(".dialog--form .period-row", { timeout: 5000 });
await page.evaluate(() =>
  [...document.querySelectorAll(".dialog__actions button")]
    .find((b) => b.type === "submit")
    .click(),
);
await wait(700);
const afterPeriod = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mct:data") || "null");
  const m = d?.members?.find((x) => x.name === "علی تستی");
  return {
    name: m?.name,
    phone: m?.phone,
    jd: m?.birth?.jd,
    periods: d?.periods?.length,
  };
});
check(
  "member intact after new period",
  afterPeriod.name === "علی تستی" && afterPeriod.jd === 31,
  JSON.stringify(afterPeriod),
);
check(
  "period archived",
  afterPeriod.periods === 1,
  String(afterPeriod.periods),
);

// 5. Offline: the service worker must serve the shell with the network down.
await ctx.setOffline(true);
await page.reload({ waitUntil: "domcontentloaded" });
await wait(1200);
const offlineOk = await page.locator(".nav-link").count();
const offlineTitle = await page
  .locator(".page-title")
  .innerText()
  .catch(() => "");
check(
  "app loads offline from cache",
  offlineOk === 6 && !!offlineTitle,
  `${offlineOk} nav links, "${offlineTitle}"`,
);
await ctx.setOffline(false);

check("no console errors", errors.length === 0, errors.slice(0, 3).join(" | "));

// 6. Door mode: the bulk «همه حاضرند» action must record everyone still pending.
await ctx.setOffline(false);
await page.evaluate(() => {
  localStorage.setItem("mct:data", JSON.stringify({
    version: 1, sessions: [], payments: [], homeworks: [], classSchedule: [],
    periods: [], meta: {},
    members: [
      { id: "m1", name: "الف", phone: "09120000001", roles: [], birth: null, note: "", active: true },
      { id: "m2", name: "ب", phone: "09120000002", roles: [], birth: null, note: "", active: true },
      { id: "m3", name: "ج", phone: "09120000003", roles: [], birth: null, note: "", active: true },
    ],
  }));
});
await page.goto(BASE, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".nav-link", { timeout: 15000 });
await page.click('.nav-link[data-route="attendance"]');
await page.waitForSelector(".attend-card", { timeout: 5000 });
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => b.textContent.includes("حالت پشت در"))
    .click(),
);
await page.waitForSelector(".door-screen", { timeout: 5000 });
const doorCards = await page.locator(".door-card").count();
check("door mode lists all members", doorCards === 3, String(doorCards));

await page.evaluate(() =>
  [...document.querySelectorAll(".door__footer button")]
    .find((b) => b.textContent.includes("همه حاضرند"))
    .click(),
);
await page.waitForSelector(".dialog", { timeout: 5000 });
await page.evaluate(() =>
  [...document.querySelectorAll(".dialog__actions button")]
    .find((b) => b.textContent.includes("حاضرند"))
    .click(),
);
await wait(500);
const allPresent = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem("mct:data") || "null");
  const slot2 = d?.sessions?.[0]?.slots?.["2"] || {};
  const ids = Object.keys(slot2);
  return { count: ids.length, allPresent: ids.every((k) => slot2[k].status === "present") };
});
check("bulk action records everyone present", allPresent.count === 3 && allPresent.allPresent,
  JSON.stringify(allPresent));

// Tapping one card must not rebuild the whole list.
const beforeTap = await page.evaluate(() => {
  document.querySelectorAll(".door-card")[0].dataset.probe = "kept";
  return document.querySelectorAll(".door-card").length;
});
await page.evaluate(() => {
  const btn = [...document.querySelectorAll(".door-card")[1].querySelectorAll(".door-btn")]
    .find((b) => b.textContent.includes("غایب"));
  btn.click();
});
await wait(300);
const afterTap = await page.evaluate(() => ({
  probe: document.querySelectorAll(".door-card")[0]?.dataset.probe,
  count: document.querySelectorAll(".door-card").length,
}));
check("door tap re-renders one card, not the list",
  afterTap.probe === "kept" && afterTap.count === beforeTap, JSON.stringify(afterTap));

check("no console errors after upgrades", errors.length === 0, errors.slice(0, 3).join(" | "));

const failed = results.filter((r) => !r.pass);
console.log(
  `\n${failed.length === 0 ? "ALL SMOKE CHECKS PASSED" : `${failed.length} SMOKE CHECK(S) FAILED`}\n`,
);

await browser.close().catch(() => {});
server.close();
try { process.kill(-chrome.pid); } catch { /* already gone */ }
// Force exit: the CDP connection and the detached Chrome can keep the event loop alive.
process.exit(failed.length === 0 ? 0 : 1);
