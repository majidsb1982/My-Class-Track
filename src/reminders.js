/* ============================================================
   src/reminders.js — Time & place reminders (phase 9)
   A reminder is a title, a moment and an optional place. When its
   moment arrives the app chimes, vibrates and shows a full-screen
   notice — the same feedback path the door timer uses, so a user
   standing in a corridor notices it.
   ============================================================ */

import {
  el,
  icon,
  toast,
  confirmDialog,
  emptyState,
  pageHead,
  formModal,
  textField,
  textAreaField,
} from "./ui.js";
import {
  getReminders,
  saveReminder,
  deleteReminder,
  setReminderDone,
  getDueReminders,
  markReminderFired,
  getNextClass,
} from "./store.js";
import {
  playChime,
  vibrate,
  notify,
  requestNotificationPermission,
  notificationsSupported,
} from "./timer.js";
import {
  toJalali,
  toGregorian,
  formatJalali,
  jalaliWeekdayName,
  toPersianDigits,
} from "./jalali.js";

/** How often the scheduler checks for due reminders. */
const CHECK_MS = 20000;

/* ---------- Page ---------- */

export function renderReminders(container) {
  container.append(pageHead("یادآورها", "یادآور زمان و مکان برای کارهای کلاس"));

  container.append(
    el("div", { class: "btn-row mb-4" }, [
      el(
        "button",
        {
          type: "button",
          class: "btn btn--primary grow",
          onclick: () => openReminderForm(null),
        },
        [icon("plus"), "یادآور جدید"],
      ),
      notificationsSupported() && Notification.permission !== "granted"
        ? el(
            "button",
            {
              type: "button",
              class: "btn btn--secondary",
              onclick: async () => {
                const res = await requestNotificationPermission();
                toast(
                  res === "granted"
                    ? "اعلان‌ها فعال شد."
                    : "اجازه اعلان داده نشد.",
                  res === "granted" ? "success" : "info",
                );
                rerender();
              },
            },
            [icon("bell"), "فعال‌سازی اعلان"],
          )
        : null,
    ]),
  );

  const listWrap = el("div", {});
  container.append(listWrap);
  renderList(listWrap);
}

function renderList(wrap) {
  wrap.replaceChildren();
  const active = getReminders();
  const done = getReminders({ includeDone: true }).filter((r) => r.done);

  if (!active.length && !done.length) {
    wrap.append(
      emptyState({
        icon: "bell",
        title: "یادآوری ثبت نشده است",
        text: "برای جلسه بعد، واریز شهریه یا هر کار دیگری یادآور زمان‌دار بسازید تا سر وقت خبردار شوید.",
        actionLabel: "ساخت اولین یادآور",
        onAction: () => openReminderForm(null),
      }),
    );
    return;
  }

  if (active.length) {
    const list = el("ul", { class: "list" });
    active.forEach((r) => list.append(renderItem(r)));
    wrap.append(list);
  } else {
    wrap.append(
      el("p", { class: "muted center mt-4" }, "یادآور فعالی ندارید."),
    );
  }

  if (done.length) {
    const details = el("details", { class: "archive-box mt-4" }, [
      el(
        "summary",
        {},
        `یادآورهای انجام‌شده (${toPersianDigits(done.length)})`,
      ),
    ]);
    const dlist = el("ul", { class: "list mt-3" });
    done.forEach((r) => dlist.append(renderItem(r, true)));
    details.append(dlist);
    wrap.append(details);
  }
}

function renderItem(reminder, isDone = false) {
  const when = new Date(reminder.at);
  const overdue = !isDone && when.getTime() <= Date.now();
  const j = toJalaliSafe(when);

  const meta = [];
  if (j)
    meta.push(
      `${jalaliWeekdayName(j.jy, j.jm, j.jd)} ${formatJalali(j.jy, j.jm, j.jd)} — ساعت ${toPersianDigits(timeText(when))}`,
    );
  if (reminder.place) meta.push(reminder.place);

  const body = el("div", { class: "list-item__body" }, [
    el("div", { class: "list-item__title" }, reminder.title),
    meta.length
      ? el("div", { class: "list-item__meta" }, meta.join(" • "))
      : null,
    reminder.note
      ? el("div", { class: "list-item__meta" }, reminder.note)
      : null,
    overdue
      ? el("div", { class: "badge badge--danger mt-2" }, "زمانش رسیده")
      : null,
  ]);

  const actions = el("div", { class: "list-item__actions" }, [
    el(
      "button",
      {
        type: "button",
        class: "icon-btn",
        "aria-label": isDone ? "بازگرداندن" : "انجام شد",
        onclick: () => {
          setReminderDone(reminder.id, !isDone);
          toast(
            isDone ? "یادآور به فهرست فعال برگشت." : "یادآور انجام‌شده ثبت شد.",
            "success",
            1600,
          );
          rerender();
        },
      },
      icon("check"),
    ),
    el(
      "button",
      {
        type: "button",
        class: "icon-btn",
        "aria-label": "ویرایش یادآور",
        onclick: () => openReminderForm(reminder),
      },
      icon("settings"),
    ),
    el(
      "button",
      {
        type: "button",
        class: "icon-btn icon-btn--danger",
        "aria-label": "حذف یادآور",
        onclick: () => askDelete(reminder),
      },
      icon("close"),
    ),
  ]);

  return el(
    "li",
    {
      class: `list-item${isDone ? " list-item--muted" : ""}${overdue ? " list-item--urgent" : ""}`,
    },
    [body, actions],
  );
}

async function askDelete(reminder) {
  const ok = await confirmDialog({
    title: "حذف یادآور",
    text: `یادآور «${reminder.title}» حذف شود؟`,
    confirmText: "حذف کن",
    danger: true,
  });
  if (!ok) return;
  deleteReminder(reminder.id);
  toast("یادآور حذف شد.", "success");
  rerender();
}

/* ---------- Form ---------- */

function openReminderForm(reminder) {
  const isEdit = !!reminder;
  const titleField = textField({
    label: "عنوان",
    placeholder: "مثلاً: واریز شهریه جلسه سه‌شنبه",
    value: reminder?.title || "",
  });
  const placeField = textField({
    label: "مکان (اختیاری)",
    placeholder: "مثلاً: کلینیک، طبقه دوم",
    value: reminder?.place || "",
  });
  const noteField = textAreaField({
    label: "توضیح (اختیاری)",
    placeholder: "جزئیات بیشتر…",
    value: reminder?.note || "",
  });

  // Date picker + time, kept as two plain inputs so it works on any phone.
  const dateInput = el("input", { class: "input", type: "date" });
  const timeInput = el("input", {
    class: "input",
    type: "time",
    value: "18:00",
  });

  if (reminder) {
    const d = new Date(reminder.at);
    dateInput.value = isoDate(d);
    timeInput.value = timeText(d);
  } else {
    // Default to the next class day if one is configured, else tomorrow.
    const base = defaultWhen();
    dateInput.value = isoDate(base);
    timeInput.value = timeText(base);
  }

  const dateErr = el("span", { class: "field__error", role: "alert" });
  dateErr.hidden = true;

  const body = el("div", {}, [
    titleField.root,
    el("div", { class: "field" }, [
      el("label", { class: "field__label" }, "تاریخ"),
      dateInput,
    ]),
    el("div", { class: "field" }, [
      el("label", { class: "field__label" }, "ساعت"),
      timeInput,
    ]),
    dateErr,
    placeField.root,
    noteField.root,
  ]);

  formModal({
    title: isEdit ? "ویرایش یادآور" : "یادآور جدید",
    body,
    submitLabel: isEdit ? "ذخیره" : "ساخت یادآور",
    onSubmit: () => {
      dateErr.hidden = true;
      const when = combine(dateInput.value, timeInput.value);
      if (!when) {
        dateErr.textContent = "تاریخ و ساعت را کامل وارد کنید.";
        dateErr.hidden = false;
        return { at: "invalid" };
      }
      const result = saveReminder({
        id: reminder?.id,
        title: titleField.getValue(),
        at: when.toISOString(),
        place: placeField.getValue(),
        note: noteField.getValue(),
        done: reminder?.done === true,
        firedAt: reminder?.firedAt || "",
      });
      if (!result.ok) {
        titleField.setError(result.errors.title);
        if (result.errors.at) {
          dateErr.textContent = result.errors.at;
          dateErr.hidden = false;
        }
        return result.errors;
      }
      toast(isEdit ? "یادآور ذخیره شد." : "یادآور ساخته شد.", "success");
      rerender();
      return null;
    },
  });
}

/* ---------- Scheduler ---------- */

let schedulerId = null;

/**
 * Poll for reminders whose moment has arrived and announce them.
 * Runs on an interval plus whenever the tab becomes visible again, since a
 * backgrounded tab throttles timers.
 */
export function startReminderScheduler() {
  if (schedulerId) return;

  const check = () => {
    const due = getDueReminders();
    due.forEach((r, index) => {
      markReminderFired(r.id);
      // Stagger so several reminders at the same minute do not overlap.
      setTimeout(() => announce(r), index * 400);
    });
  };

  schedulerId = setInterval(check, CHECK_MS);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) check();
  });
  check();
}

/** Show the full-screen notice for one reminder. */
function announce(reminder) {
  playChime(2);
  vibrate();
  notify("یادآور: " + reminder.title, reminder.place || "زمانش رسیده است");

  document.querySelector(".reminder-overlay")?.remove();
  const overlay = el(
    "div",
    { class: "reminder-overlay", role: "alertdialog", "aria-modal": "true" },
    [
      el("div", { class: "reminder-overlay__card" }, [
        el("div", { class: "reminder-overlay__icon" }, icon("bell")),
        el("p", { class: "reminder-overlay__title" }, reminder.title),
        reminder.place
          ? el("p", { class: "reminder-overlay__place" }, [
              icon("mapPin"),
              reminder.place,
            ])
          : null,
        reminder.note
          ? el("p", { class: "reminder-overlay__note" }, reminder.note)
          : null,
        el("div", { class: "reminder-overlay__actions" }, [
          el(
            "button",
            {
              type: "button",
              class: "btn btn--primary btn--lg",
              onclick: () => {
                setReminderDone(reminder.id, true);
                overlay.remove();
                rerenderIfVisible();
              },
            },
            "انجام شد",
          ),
          el(
            "button",
            {
              type: "button",
              class: "btn btn--secondary btn--lg",
              onclick: () => overlay.remove(),
            },
            "بستن",
          ),
        ]),
      ]),
    ],
  );
  document.body.append(overlay);
}

/* ---------- Helpers ---------- */

function rerender() {
  const main = document.getElementById("main-content");
  if (!main) return;
  const page = main.firstElementChild;
  if (!page) return;
  page.dispatchEvent(new CustomEvent("mct:destroy", { bubbles: true }));
  page.replaceChildren();
  renderReminders(page);
}

function rerenderIfVisible() {
  if (document.getElementById("main-content")?.querySelector(".page-title"))
    rerender();
}

/** yyyy-mm-dd in local time (not UTC — `toISOString` would shift the day). */
function isoDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** HH:MM in local time. */
function timeText(d) {
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function combine(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = timeStr.split(":").map(Number);
  if (![y, m, d, hh, mm].every(Number.isInteger)) return null;
  const out = new Date(y, m - 1, d, hh, mm, 0, 0);
  return Number.isNaN(out.getTime()) ? null : out;
}

/**
 * Sensible default moment for a new reminder: the next class start when a
 * weekly class is configured, otherwise tomorrow at 18:00. Always in the
 * future, so a reminder is never born already overdue.
 */
function defaultWhen() {
  const next = getNextClass();
  if (next) {
    const base = toGregorian(next.jy, next.jm, next.jd);
    const [h, m] = next.start.split(":").map(Number);
    base.setHours(h, m, 0, 0);
    if (base.getTime() <= Date.now()) base.setTime(Date.now() + 3600000);
    return base;
  }
  const tomorrow = new Date(Date.now() + 86400000);
  tomorrow.setHours(18, 0, 0, 0);
  return tomorrow;
}

/** Gregorian Date -> Jalali, tolerating a bad value. */
function toJalaliSafe(date) {
  try {
    return toJalali(date);
  } catch {
    return null;
  }
}

export default { renderReminders, startReminderScheduler };
