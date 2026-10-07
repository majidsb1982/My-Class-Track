/* Capture screenshots of the real UI so the visual result can be checked.
   Run: node tools/screenshot.mjs */
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
    const body = await readFile(join(ROOT, rel.replace(/^\/+/, "")));
    res.writeHead(200, {
      "Content-Type": MIME[extname(rel)] || "application/octet-stream",
    });
    res.end(body);
  } catch {
    res.writeHead(404);
    res.end("not found");
  }
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${server.address().port}/`;

const DEBUG_PORT = 9381;
const chrome = spawn(
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  [
    `--remote-debugging-port=${DEBUG_PORT}`,
    `--user-data-dir=${process.env.TEMP}\\mct-shot`,
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

const browser = await chromium.connectOverCDP(`http://127.0.0.1:${DEBUG_PORT}`);
const ctx = browser.contexts()[0] ?? (await browser.newContext());
// A typical Android phone viewport.
const page = await ctx.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});

await page.goto(BASE, { waitUntil: "domcontentloaded" });
// Seed some data so the screens are not empty.
await page.evaluate(async () => {
  const today = new Date();
  const iso = (d) => d.toISOString();
  const jal = await import("./src/jalali.js");
  const todayJ = jal.todayJalali();
  // Genuinely upcoming dates, derived rather than hard-coded.
  const soon = jal.addJalaliDays(todayJ, 4);
  const later = jal.addJalaliDays(todayJ, 12);
  localStorage.setItem(
    "mct:data",
    JSON.stringify({
      version: 3,
      classSchedule: [{ id: "c1", weekday: 2, start: "19:00", end: "21:00" }],
      members: [
        {
          id: "m1",
          name: "علی رضایی",
          phone: "09121112233",
          phone2: "",
          address: "ونک",
          roles: ["attendance"],
          birth: { jy: 1360, jm: 3, jd: 12 },
          note: "",
          active: true,
          createdAt: iso(today),
        },
        {
          id: "m2",
          name: "مریم احمدی",
          phone: "09121112244",
          phone2: "",
          address: "",
          roles: ["supporter"],
          birth: { jy: 1365, jm: 5, jd: 2 },
          note: "",
          active: true,
          createdAt: iso(today),
        },
        {
          id: "m3",
          name: "سارا کریمی",
          phone: "09121112255",
          phone2: "",
          address: "",
          roles: [],
          birth: null,
          note: "",
          active: true,
          createdAt: iso(today),
        },
      ],
      events: [
        {
          id: "e1",
          type: "seminar",
          title: "سمینار مهارت‌های ارتباطی",
          jy: soon.jy,
          jm: soon.jm,
          jd: soon.jd,
          start: "17:00",
          end: "19:00",
          place: "سالن اصلی",
          note: "",
          createdAt: iso(today),
        },
        {
          id: "e2",
          type: "celebration",
          title: "جشن پایان دوره",
          jy: later.jy,
          jm: later.jm,
          jd: later.jd,
          start: "",
          end: "",
          place: "باغ",
          note: "",
          createdAt: iso(today),
        },
      ],
      sessions: [],
      payments: [],
      homeworks: [],
      periods: [],
      reminders: [],
      meta: {},
    }),
  );
});
await page.reload({ waitUntil: "domcontentloaded" });
await page.waitForSelector(".nav-link", { timeout: 15000 });
await wait(900);

const shots = [
  ["home", null],
  ["events", "events"],
  ["members", "members"],
  ["attendance", "attendance"],
];

for (const [name, route] of shots) {
  if (route) {
    await page.evaluate((r) => {
      document.querySelector(`.nav-link[data-route="${r}"]`).click();
    }, route);
    await wait(700);
  }
  await page.screenshot({ path: join(ROOT, ".qa", `${name}.png`) });
  console.log("captured", name);
}

// The date picker with the widened year range.
await page.evaluate(() => {
  document.querySelector('.nav-link[data-route="members"]').click();
});
await wait(600);
await page.evaluate(() =>
  [...document.querySelectorAll("button")]
    .find((b) => b.textContent.includes("افزودن عضو"))
    .click(),
);
await page.waitForSelector(".dialog--form", { timeout: 5000 });
await page.click(".dialog--form .date-trigger");
await page.waitForSelector(".datepicker__grid", { timeout: 5000 });
await wait(400);
await page.screenshot({ path: join(ROOT, ".qa", "datepicker.png") });
console.log("captured datepicker");

await browser.close().catch(() => {});
server.close();
try {
  process.kill(-chrome.pid);
} catch {
  /* already gone */
}
process.exit(0);
