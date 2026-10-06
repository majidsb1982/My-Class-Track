# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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