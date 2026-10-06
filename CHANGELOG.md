# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] — 2026-10-06

### Added

- **Attendance trends.** The attendance page now charts attendance across the eight most recent sessions, with running totals for present / late / absent / problem.
- **Per-member history.** Every active member has a history button opening their attendance record: a rate percentage, status counts and a session-by-session list with both rounds, late times and notes.
- **New store analytics**: `getMemberHistory()`, `getMemberStats()` and `getAttendanceTrend()`. A member's rate counts «حاضر» and «تأخیر» as attended, since both mean the person turned up.

### Repository hygiene

- **Removed the duplicate deployment workflow.** `.github/workflows/main.yml` was byte-identical to `pages.yml`, so every push to `main` triggered two competing Pages deployments. Deleted in favour of the single `pages.yml`.
- **Added a CI workflow** (`.github/workflows/ci.yml`) running `check-project.mjs` and `check-html.mjs` on every push and pull request — previously nothing validated a PR before deploy.
- **Added the missing LICENSE** (MIT), plus `CONTRIBUTING.md`, `SECURITY.md`, YAML issue forms for bugs and feature requests, an issue-template config pointing security reports to private advisories, and a pull-request template with the project's check-list.
- **Untracked the stray `.single-check.mjs` dev helper** and expanded `.gitignore` (`.idea/`, `*.pyc`, `*.zip`, editor swap files).
- **README** gained CI / deploy / license / dependency badges, a quality-gates section, and an accurate file tree (it was missing `prefs.js`, `run.py`, `build-portable.py` and the `tools/` scripts).

### Changed

- Regression coverage in `tools/check-project.mjs` now also exercises the analytics: two sessions built through the public API, then history ordering, attendance-rate maths (absent lowers the rate, late does not) and trend totals including the unrecorded count.

## [Unreleased]

### Added

- **In-app update prompt.** `sw.js` already called `skipWaiting()`, so a new deploy activated silently and users could keep running an old build until every tab was closed. The service worker now watches for `updatefound`, calls `reg.update()` on each launch, and offers a one-tap reload when a newer build is ready.
- **«همه حاضرند» bulk action in door mode.** At the door most members turn up, so one confirmed tap now records every still-pending member as present; individual cards can then be switched to late/absent.
- **Duplicate phone warning.** `store.findPhoneOwner()` reports when a number is already assigned to another member, and the member form warns on blur without blocking the save.
- **Countdown progress bar** on the home card, showing how much of the wait to the next class has elapsed.
- **Shared `debounce()` helper** in `ui.js`, used by the member and homework search boxes.

### Performance

- **Fixed an interval leak on the home countdown.** The countdown interval was never cleared when the card was removed, so every visit to the home page left a timer running forever. Pages now receive an `mct:destroy` event before their DOM is cleared, and the countdown (plus the door screen) releases its timers and listeners on it.
- **Countdown ticks every second near class start.** It was a fixed 30 s interval, so the final minutes looked frozen. It now runs at 1 s inside the last hour and 30 s further out, switching automatically at the one-hour mark.
- **Door taps update one card instead of the whole list.** Recording a status rebuilt every card; it now re-renders only the tapped card and the top-bar counter.
- **Memoised Jalali leap-year flags.** `jalaliMonthLength` called `jalCalLeap` (a break-table walk) on every query, including once per day cell when rendering a month grid and once per member when scanning birthdays.

## [1.1.0] — 2026-10-06

A full audit pass over data integrity, preference handling, offline behaviour and reporting.

### Fixed

- **New-period flow could corrupt member data.** Starting a new period wrote the role snapshot, then re-imported the whole dataset, which re-ran migration and rebuilt every member record. Replaced with a single atomic `store.startNewPeriod()` call that closes the previous period, archives the snapshot and applies the new roles in one write.
- **Birthdays on the 30th/31st were silently moved.** `safeBirthday()` clamped every day to 29, so a 31 Farvardin birthday showed as the 29th. It now clamps only when the day genuinely does not exist in that month.
- **Impossible birth dates were accepted.** `saveMember` stored whatever the picker produced; an invalid day now returns a clear Persian error, and the members form displays it.
- **Theme changes made in Settings left the header button out of sync.** Both surfaces now go through a new shared `src/prefs.js` module, and the header reacts to a `mct:theme-change` event.
- **One missing precache file broke the whole service-worker install.** `cache.addAll` is replaced with per-URL adds that tolerate individual failures, and opaque/error responses are no longer cached.
- **CSV filenames were inconsistent.** The settings report picker now uses the same `My-Class-Track-<date>-<kind>.csv` pattern as everywhere else.

### Added

- `src/prefs.js` — the single reader/writer for the `mct:prefs` key (theme, font size, debug flag)
- `store.startNewPeriod()` — atomic period rollover
- Regression coverage in `tools/check-project.mjs` (section 5b): member round-trip, Persian phone normalisation, birthday validation, atomic period change and a full backup → wipe → restore cycle, all run against an in-memory storage shim
- The header theme button now exposes a correct `aria-pressed` state and an updated label

## [1.0.0] — 2026-10-04

First complete release: all eight phases of `AGENTS.md` implemented, tested and documented.

### Added

**Foundation**
- App shell with a sticky header, bottom navigation (6 destinations) and a hash-based router that works on GitHub Pages without server config
- Complete design system in `src/styles.css`: colour, spacing, radius, shadow and typography tokens; light and dark themes following `prefers-color-scheme`; three font sizes for accessibility
- Reusable components: buttons, cards, badges, lists, forms, chips, toasts, confirm dialog, modal forms and empty states
- Safe DOM builder (`el`) — all user content is rendered via `textContent`, never `innerHTML`

**Calendar**
- `src/jalali.js`: full bidirectional Jalali ⇄ Gregorian conversion using the standard jalaali algorithm (33-year cycle), month lengths, leap years, Persian digit formatting and tolerant input parsing
- 16 built-in self-tests covering the reference dates `2024-03-20 = 1403/01/01` and `2025-03-21 = 1404/01/01`, round-trips and month lengths
- Touch-friendly Jalali date picker with week starting Saturday, Persian month names, "today" and "clear" actions

**Data**
- `src/store.js`: the only module touching `localStorage`; schema versioning with a safe migration that never loses data and persists the migrated shape immediately
- Members CRUD with validation, role assignment (attendance / tuition / homework / supporter), soft archiving and period archiving
- Sessions with two independent attendance slots, per-session tuition records and homework entries
- Backup export/import with structural validation, and a two-step "clear all data" confirmation

**Attendance**
- Two-round flow: round 1 as a call list with dial buttons, late-time and absence-reason fields; round 2 as a full-screen at-the-door mode with 66 px one-tap buttons
- Progress indicator ("۳ از ۳ نفر ثبت شد"), previous-round badges at the door, and vibration feedback on each tap

**Door timer**
- Large countdown based on `Date.now()`, so it survives screen lock and tab switches
- Alarms at 15, 8, 5 and 3 minutes before class start and at zero: two-tone chime (Web Audio), patterned vibration, system notification and a full-screen Persian message
- Target time and already-fired alarms persisted, so reopening the page never replays or loses an alarm

**Reports and export**
- `src/reports.js`: ordered Persian attendance report per round, tuition report, and CSV exports for members, attendance and tuition with a UTF-8 BOM and RFC 4180 quoting
- Copy, Web Share, CSV download and `window.print()` output, with a print stylesheet that hides every interactive element

**Other pages**
- Home: next class card with a live countdown, upcoming birthdays (7 days), status summary and large shortcuts
- Tuition: session picker, progress bar, imminent-class warning banner, per-member rows
- Homework: form with Jalali date, searchable archive and ready-to-send WhatsApp text
- Settings: weekly class schedule, report picker, theme and font size, backup/restore

**PWA**
- Complete `manifest.webmanifest` with `id`, `display_override`, categories and 192/512/maskable icons
- Dependency-free PNG icon generator (`tools/build-icons.mjs`) producing signed-distance-field artwork with anti-aliased edges
- `sw.js` with a versioned cache, cache-first for static assets, network-first for the page shell and cleanup of old caches on activate
- Standalone `offline.html` and an offline indicator banner in the UI

### Security

- No secrets, keys or tokens anywhere in the codebase
- All dynamic content rendered through safe DOM APIs; verified that a member name containing `<img src=x onerror=…>` is displayed as text and never executed
- `rel="noopener"` on every external link; all user input validated with clear Persian error messages
- Verified that empty names, malformed phone numbers and invalid time ranges produce messages instead of crashes

### Documentation

- `PROJECT_REPORT.md` covering summary, architecture, per-phase work, bugs found and fixed, security notes, deviations, deployment, roadmap and limitations
- `README.md` in Persian with an English summary, `CHANGELOG.md`, and `AGENTS.md` retained as the project contract

[1.0.0]: https://github.com/majidsb1982/My-Class-Track/releases/tag/v1.0.0