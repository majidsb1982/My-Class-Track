/* ============================================================
   src/pages/events.js — Seminars, gatherings and celebrations
   A dated programme with a type, an optional time window and a
   place. Anything the class does outside the weekly session lives
   here, so the home dashboard can warn about it in advance.
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
  createJalaliDatePicker,
  debounce,
} from "../ui.js";
import {
  EVENT_TYPES,
  EVENT_TYPE_KEYS,
  getEvents,
  saveEvent,
  deleteEvent,
} from "../store.js";
import {
  todayJalali,
  formatJalali,
  jalaliWeekdayName,
  jalaliDiffDays,
  toPersianDigits,
  toGregorian,
} from "../jalali.js";

let typeFilter = "";

export function renderEvents(container) {
  container.append(
    pageHead("برنامه‌ها", "سمینار، گردهمایی، جشن و کارگاه‌های کلاس"),
  );

  container.append(
    el("div", { class: "btn-row mb-4" }, [
      el(
        "button",
        {
          type: "button",
          class: "btn btn--primary grow",
          onclick: () => openEventForm(null),
        },
        [icon("plus"), "برنامه جدید"],
      ),
    ]),
  );

  // Type filter as chips — faster than a select on a phone.
  const chips = el("div", { class: "filter-chips" }, [
    filterChip("", "همه"),
    ...EVENT_TYPE_KEYS.map((key) =>
      filterChip(key, `${EVENT_TYPES[key].icon} ${EVENT_TYPES[key].label}`),
    ),
  ]);
  container.append(chips);

  const listWrap = el("div", { class: "mt-4" });
  container.append(listWrap);
  renderList(listWrap, chips);
}

function filterChip(key, label) {
  const chip = el(
    "button",
    {
      type: "button",
      class: `filter-chip${typeFilter === key ? " is-active" : ""}`,
      "aria-pressed": typeFilter === key ? "true" : "false",
      onclick: () => {
        typeFilter = key;
        rerender();
      },
    },
    label,
  );
  return chip;
}

function renderList(wrap) {
  wrap.replaceChildren();
  const all = getEvents({ type: typeFilter });

  if (!all.length) {
    wrap.append(
      emptyState({
        icon: "calendar",
        title: typeFilter
          ? "برنامه‌ای از این نوع نیست"
          : "هنوز برنامه‌ای ثبت نشده است",
        text: typeFilter
          ? "فیلتر را تغییر دهید یا یک برنامه از این نوع بسازید."
          : "سمینار، گردهمایی، جشن و هر برنامه دیگری را ثبت کنید تا از قبل بدانید چه پیش رو دارید.",
        actionLabel: "ثبت برنامه",
        onAction: () => openEventForm(null),
      }),
    );
    return;
  }

  const today = todayJalali();
  const upcoming = all.filter(
    (e) => jalaliDiffDays({ jy: e.jy, jm: e.jm, jd: e.jd }, today) >= 0,
  );
  const past = all.filter(
    (e) => jalaliDiffDays({ jy: e.jy, jm: e.jm, jd: e.jd }, today) < 0,
  );

  if (upcoming.length) {
    wrap.append(
      el("h3", { class: "section__title" }, [icon("sparkles"), "پیش رو"]),
    );
    const list = el("ul", { class: "list" });
    upcoming.forEach((e) => list.append(renderEvent(e, today)));
    wrap.append(list);
  }

  if (past.length) {
    const details = el("details", { class: "archive-box mt-6" }, [
      el("summary", {}, `برنامه‌های گذشته (${toPersianDigits(past.length)})`),
    ]);
    const list = el("ul", { class: "list mt-3" });
    // Most recent first in the archive.
    [...past].reverse().forEach((e) => list.append(renderEvent(e, today)));
    details.append(list);
    wrap.append(details);
  }
}

function renderEvent(event, today) {
  const meta = EVENT_TYPES[event.type] || EVENT_TYPES.gathering;
  const daysLeft = jalaliDiffDays(
    { jy: event.jy, jm: event.jm, jd: event.jd },
    today,
  );
  const isPast = daysLeft < 0;

  const when = `${jalaliWeekdayName(event.jy, event.jm, event.jd)} ${formatJalali(event.jy, event.jm, event.jd)}`;
  const bits = [when];
  if (event.start) {
    bits.push(
      event.end
        ? `ساعت ${toPersianDigits(event.start)} تا ${toPersianDigits(event.end)}`
        : `ساعت ${toPersianDigits(event.start)}`,
    );
  }
  if (event.place) bits.push(event.place);

  const countdown = isPast
    ? `${toPersianDigits(Math.abs(daysLeft))} روز پیش`
    : daysLeft === 0
      ? "امروز!"
      : daysLeft === 1
        ? "فردا"
        : `${toPersianDigits(daysLeft)} روز دیگر`;

  const card = el("li", { class: `event-card${isPast ? " is-past" : ""}` }, [
    el("div", { class: "event-card__top" }, [
      el(
        "span",
        { class: `event-type event-type--${meta.tone}` },
        `${meta.icon} ${meta.label}`,
      ),
      el(
        "span",
        {
          class: `badge badge--${isPast ? "primary" : daysLeft <= 2 ? "danger" : "primary"}`,
        },
        countdown,
      ),
    ]),
    el("div", { class: "event-card__title" }, event.title),
    el("div", { class: "event-card__meta" }, bits.join(" • ")),
    event.note ? el("p", { class: "event-card__note" }, event.note) : null,
  ]);

  card.append(
    el("div", { class: "list-item__actions mt-2" }, [
      el(
        "button",
        {
          type: "button",
          class: "btn btn--secondary btn--sm",
          onclick: () => openEventForm(event),
        },
        [icon("settings"), "ویرایش"],
      ),
      el(
        "button",
        {
          type: "button",
          class: "btn btn--ghost btn--sm",
          onclick: () => askDelete(event),
        },
        "حذف",
      ),
    ]),
  );

  return card;
}

async function askDelete(event) {
  const ok = await confirmDialog({
    title: "حذف برنامه",
    text: `«${event.title}» حذف شود؟ این کار قابل بازگشت نیست.`,
    confirmText: "حذف کن",
    danger: true,
  });
  if (!ok) return;
  deleteEvent(event.id);
  toast("برنامه حذف شد.", "success");
  rerender();
}

/* ---------- Form ---------- */

function openEventForm(event) {
  const isEdit = !!event;

  // Type as a chip group: one tap, and the label is always visible.
  const typeChips = el("div", { class: "checkbox-row" });
  let selectedType = event?.type || "seminar";
  const typeInputs = new Map();

  EVENT_TYPE_KEYS.forEach((key) => {
    const meta = EVENT_TYPES[key];
    const input = el("input", { type: "radio", name: "event-type" });
    input.checked = key === selectedType;
    input.value = key;
    input.addEventListener("change", () => {
      selectedType = key;
    });
    typeInputs.set(key, input);
    typeChips.append(
      el("label", { class: "check-chip" }, [
        input,
        el("span", {}, `${meta.icon} ${meta.label}`),
      ]),
    );
  });

  const titleField = textField({
    label: "عنوان برنامه",
    placeholder: "مثلاً: سمینار مهارت‌های ارتباطی",
    value: event?.title || "",
  });

  const datePicker = createJalaliDatePicker({
    value: event ? { jy: event.jy, jm: event.jm, jd: event.jd } : null,
    placeholder: "انتخاب تاریخ برنامه",
    allowClear: false,
  });
  const dateError = el("span", { class: "field__error", role: "alert" });
  dateError.hidden = true;

  const startInput = el("input", {
    class: "input",
    type: "time",
    value: event?.start || "",
  });
  const endInput = el("input", {
    class: "input",
    type: "time",
    value: event?.end || "",
  });
  const timeError = el("span", { class: "field__error", role: "alert" });
  timeError.hidden = true;

  const placeField = textField({
    label: "مکان (اختیاری)",
    placeholder: "مثلاً: سالن اصلی کلینیک",
    value: event?.place || "",
  });
  const noteField = textAreaField({
    label: "توضیحات (اختیاری)",
    placeholder: "جزئیات، مهمان‌ها، هماهنگی‌ها…",
    value: event?.note || "",
  });

  const body = el("div", {}, [
    el("div", { class: "field" }, [
      el("span", { class: "field__label" }, "نوع برنامه"),
      typeChips,
    ]),
    titleField.root,
    el("div", { class: "field" }, [
      el("span", { class: "field__label" }, "تاریخ برنامه"),
      datePicker.root,
      dateError,
    ]),
    el("div", { class: "field-row" }, [
      el("div", { class: "field" }, [
        el("label", { class: "field__label" }, "ساعت شروع"),
        startInput,
      ]),
      el("div", { class: "field" }, [
        el("label", { class: "field__label" }, "ساعت پایان"),
        endInput,
      ]),
    ]),
    timeError,
    placeField.root,
    noteField.root,
  ]);

  formModal({
    title: isEdit ? "ویرایش برنامه" : "برنامه جدید",
    body,
    submitLabel: isEdit ? "ذخیره تغییرات" : "ثبت برنامه",
    onSubmit: () => {
      dateError.hidden = true;
      timeError.hidden = true;

      const date = datePicker.getValue();
      if (!date) {
        dateError.textContent = "تاریخ برنامه را انتخاب کنید.";
        dateError.hidden = false;
        return { date: "missing" };
      }

      const result = saveEvent({
        id: event?.id,
        type: selectedType,
        title: titleField.getValue(),
        jy: date.jy,
        jm: date.jm,
        jd: date.jd,
        start: startInput.value,
        end: endInput.value,
        place: placeField.getValue(),
        note: noteField.getValue(),
        createdAt: event?.createdAt,
      });

      if (!result.ok) {
        titleField.setError(result.errors.title);
        if (result.errors.date) {
          dateError.textContent = result.errors.date;
          dateError.hidden = false;
        }
        if (result.errors.start || result.errors.end) {
          timeError.textContent = result.errors.start || result.errors.end;
          timeError.hidden = false;
        }
        return result.errors;
      }

      toast(isEdit ? "برنامه ویرایش شد." : "برنامه ثبت شد.", "success");
      rerender();
      return null;
    },
  });
}

/* ---------- Helpers ---------- */

/** A Jalali date object for the given event, for the date picker to display. */
export function eventDate(event) {
  return { jy: event.jy, jm: event.jm, jd: event.jd };
}

/** Local calendar Date for an event's start, or null when it has no time. */
export function eventStartDate(event) {
  if (!event?.start) return null;
  const g = toGregorian(event.jy, event.jm, event.jd);
  const [h, m] = event.start.split(":").map(Number);
  g.setHours(h, m, 0, 0);
  return g;
}

function rerender() {
  const main = document.getElementById("main-content");
  if (!main) return;
  const page = main.firstElementChild;
  if (!page) return;
  page.dispatchEvent(new CustomEvent("mct:destroy", { bubbles: true }));
  page.replaceChildren();
  renderEvents(page);
}

export default { renderEvents };
