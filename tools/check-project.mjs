/* Project health check: verifies required files, precache integrity and
   that every module parses. Run: node tools/check-project.mjs */
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;
const ok = (m) => console.log(`  OK    ${m}`);
const bad = (m) => { console.log(`  FAIL  ${m}`); failures += 1; };

console.log('\n1. Required files');
for (const f of [
  'index.html', 'offline.html', 'manifest.webmanifest', 'sw.js',
  'README.md', 'CHANGELOG.md', 'AGENTS.md', 'PROJECT_REPORT.md',
  'src/styles.css', 'src/jalali.js', 'src/store.js', 'src/ui.js',
  'src/reports.js', 'src/timer.js', 'src/app.js', 'src/prefs.js',
  'src/media.js', 'src/reminders.js',
  'src/pages/home.js', 'src/pages/attendance.js', 'src/pages/door.js',
  'src/pages/payment.js', 'src/pages/homework.js', 'src/pages/members.js',
  'src/pages/settings.js',
  'src/prefs.js',
  'LICENSE', 'CONTRIBUTING.md', 'SECURITY.md',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  '.github/workflows/pages.yml',
  '.github/workflows/ci.yml',
]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) bad(`missing ${f}`);
  else if (statSync(p).size === 0) bad(`empty ${f}`);
  else ok(f);
}

console.log('\n2. Module syntax');
for (const f of ['src/jalali.js', 'src/store.js', 'src/ui.js', 'src/reports.js', 'src/timer.js', 'src/app.js', 'src/prefs.js', 'src/media.js', 'src/reminders.js']) {
  try {
    execFileSync(process.execPath, ['--check', join(ROOT, f)], { stdio: 'pipe' });
    ok(`parses ${f}`);
  } catch (e) {
    bad(`syntax ${f}: ${String(e.stderr || e).split('\n').slice(0, 3).join(' ')}`);
  }
}

console.log('\n3. Service worker precache');
const sw = readFileSync(join(ROOT, 'sw.js'), 'utf8');
const list = (sw.match(/const PRECACHE = \[([\s\S]*?)\];/) || [])[1] || '';
const entries = [...list.matchAll(/'([^']+)'/g)].map((m) => m[1]);
if (!entries.length) bad('PRECACHE list not found');
else {
  for (const e of entries) {
    const p = join(ROOT, e.replace(/^\.\//, ''));
    // './' is the root, served by index.html.
    if (e === './') { ok('./ (index.html)'); continue; }
    if (!existsSync(p)) bad(`precache target missing: ${e}`);
    else ok(e);
  }
}

console.log('\n4. Every app module is precached');
const appModules = ['src/app.js', 'src/ui.js', 'src/jalali.js', 'src/store.js',
  'src/timer.js', 'src/reports.js', 'src/prefs.js', 'src/media.js', 'src/reminders.js',
  'src/pages/home.js', 'src/pages/attendance.js',
  'src/pages/door.js', 'src/pages/payment.js', 'src/pages/homework.js',
  'src/pages/members.js', 'src/pages/settings.js'];
for (const m of appModules) {
  if (entries.some((e) => e.replace(/^\.\//, '') === m)) ok(m);
  else bad(`${m} not precached`);
}

console.log('\n5. Jalali self-test');
try {
  const out = execFileSync(process.execPath, [
    '--input-type=module',
    '-e', "import('./src/jalali.js').then(m=>{const r=m.runSelfTest();console.log(r.results.filter(x=>x.pass).length+'/'+r.results.length);process.exit(r.ok?0:1)})",
  ], { cwd: ROOT, stdio: 'pipe' }).toString().trim();
  ok(`jalali ${out}`);
} catch (e) {
  bad(`jalali self-test failed: ${String(e.stdout || e).slice(0, 200)}`);
}

console.log('\n5b. Store round-trip (memory storage shim)');
try {
  const script = `
    const mem = new Map();
    globalThis.localStorage = {
      getItem: (k) => (mem.has(k) ? mem.get(k) : null),
      setItem: (k, v) => mem.set(k, String(v)),
      removeItem: (k) => mem.delete(k),
    };
    const s = await import('./src/store.js');
    s.load();
    const a = s.saveMember({ name: 'علی', phone: '۰۹۱۲۳۴۵۶۷۸۹', roles: ['attendance'], birth: { jy: 1400, jm: 1, jd: 31 } });
    const b = s.saveMember({ name: 'مریم', roles: ['payment'], birth: { jy: 1399, jm: 12, jd: 30 } });
    if (!a.ok || !b.ok) throw new Error('saveMember failed');

    // Phone must be normalised to latin digits.
    const al = s.getMember(a.id);
    if (al.phone !== '09123456789') throw new Error('phone not normalised: ' + al.phone);

    // A 31-day birthday must survive untouched (was clamped to 29 before).
    if (al.birth.jd !== 31) throw new Error('birthday clamped: ' + al.birth.jd);

    // An impossible date (30 Esfand in a common year) must be rejected, not stored.
    const badBirth = s.saveMember({ name: 'بد', roles: [], birth: { jy: 1402, jm: 12, jd: 30 } });
    if (badBirth.ok) throw new Error('impossible birthday accepted');
    if (!badBirth.errors.birth) throw new Error('missing birth error message');

    // New period: archive the snapshot AND apply the new roles atomically.
    s.startNewPeriod(new Map([[a.id, ['supporter']]]));
    const after = s.getMember(a.id);
    if (after.roles.join() !== 'supporter') throw new Error('roles not applied: ' + after.roles);
    if (after.name !== 'علی' || after.birth.jd !== 31) throw new Error('member data lost during period change');
    const periods = s.getPeriods();
    if (periods.length !== 1 || periods[0].members.length !== 2) throw new Error('period not archived');

    // Backup -> wipe -> restore must round-trip everything.
    const backup = s.exportData();
    s.clearAll();
    if (s.getMembers().length !== 0) throw new Error('clearAll did not wipe');
    const restored = s.importData(backup);
    if (!restored.ok) throw new Error('import failed');
    const back = s.getMember(a.id);
    if (!back || back.roles.join() !== 'supporter') throw new Error('restore lost roles');
    if (s.getPeriods().length !== 1) throw new Error('restore lost periods');

    // Analytics: build two sessions and check the derived stats.
    const m3 = s.saveMember({ name: 'سارا', roles: [], birth: null });
    const d1 = s.ensureSession(1404, 1, 5);
    const d2 = s.ensureSession(1404, 1, 12);
    s.setAttendance(d1.id, 2, a.id, { status: 'present' });
    s.setAttendance(d1.id, 2, m3.id, { status: 'absent' });
    s.setAttendance(d2.id, 2, a.id, { status: 'late', lateTime: '19:30' });
    s.setAttendance(d2.id, 2, m3.id, { status: 'present' });

    const statsA = s.getMemberStats(a.id);
    if (statsA.total !== 2) throw new Error('history total wrong: ' + statsA.total);
    if (statsA.present !== 1 || statsA.late !== 1) throw new Error('status counts wrong');
    if (statsA.rate !== 100) throw new Error('present+late must count as attended: ' + statsA.rate);

    const statsM3 = s.getMemberStats(m3.id);
    if (statsM3.rate !== 50) throw new Error('absent must lower the rate: ' + statsM3.rate);

    const hist = s.getMemberHistory(a.id);
    if (hist.length !== 2) throw new Error('history length wrong: ' + hist.length);
    // Newest first.
    if (!(hist[0].session.jd === 12 && hist[1].session.jd === 5)) throw new Error('history not newest-first');
    if (hist[0].slot2.lateTime !== '19:30') throw new Error('late time lost in history');

    const trend = s.getAttendanceTrend();
    if (trend.length !== 2) throw new Error('trend length wrong: ' + trend.length);
    // Oldest first, and the totals must add up across both sessions.
    if (trend[0].jd !== 5) throw new Error('trend not oldest-first');
    if (trend[0].present !== 1 || trend[0].absent !== 1) throw new Error('trend d1 counts wrong');
    if (trend[1].late !== 1 || trend[1].present !== 1) throw new Error('trend d2 counts wrong');
    if (trend[0].total !== 3) throw new Error('trend total should count active members: ' + trend[0].total);
    // «ب» has no decision in either session, so it is unrecorded in both.
    if (trend[0].unrecorded !== 1) throw new Error('unrecorded count wrong: ' + trend[0].unrecorded);

    // v1 -> v2 migration: an old member record must gain the new fields
    // without losing anything, and a bad avatar must be dropped.
    localStorage.setItem('mct:data', JSON.stringify({
      version: 1,
      members: [
        { id: 'old1', name: 'قدیمی', phone: '09120000009', roles: ['حامی'], birth: { jy: 1370, jm: 5, jd: 10 } },
        { id: 'old2', name: 'عکس‌دار', phone: '', roles: [], avatar: 'javascript:alert(1)' },
      ],
    }));
    const fresh = await import('./src/store.js?migrate=2');
    fresh.load();
    const migrated = fresh.getMembers({ includeInactive: true });
    if (migrated.length !== 2) throw new Error('migration lost members');
    const old1 = migrated.find((m) => m.id === 'old1');
    if (old1.name !== 'قدیمی' || old1.birth.jd !== 10) throw new Error('migration lost fields');
    if (old1.roles.join() !== 'supporter') throw new Error('migration lost role mapping: ' + old1.roles);
    if (old1.avatar !== '' || old1.phone2 !== '' || old1.address !== '') {
      throw new Error('v2 fields not defaulted');
    }
    if (fresh.getData().version !== 2) throw new Error('schema version not bumped');
    // A non-image avatar string must never be stored.
    const badAvatar = migrated.find((m) => m.id === 'old2');
    if (badAvatar.avatar !== '') throw new Error('non-image avatar was kept');

    // Second phone: validated, normalised, and rejected when it repeats phone 1.
    const dup = fresh.saveMember({ name: 'دوتایی', phone: '۰۹۱۲۱۱۱۲۲۳۳', phone2: '09121112233' });
    if (dup.ok) throw new Error('identical second phone accepted');
    if (!dup.errors.phone2) throw new Error('missing phone2 error');
    const ok2 = fresh.saveMember({ name: 'دو شماره', phone: '۰۹۱۲۱۱۱۲۲۳۳', phone2: '۰۲۱۸۸۸۸۹۹۹۹' });
    if (!ok2.ok) throw new Error('valid second phone rejected: ' + JSON.stringify(ok2.errors));
    const two = fresh.getMember(ok2.id);
    if (two.phone2 !== '02188889999') throw new Error('phone2 not normalised: ' + two.phone2);

    // Reminders: CRUD, due detection and fire-once behaviour.
    const soon = new Date(Date.now() + 60000).toISOString();
    const past = new Date(Date.now() - 60000).toISOString();
    const rem = fresh.saveReminder({ title: 'واریز شهریه', at: past, place: 'کلینیک' });
    if (!rem.ok) throw new Error('reminder save failed: ' + JSON.stringify(rem.errors));
    const badRem = fresh.saveReminder({ title: '', at: 'not-a-date' });
    if (badRem.ok) throw new Error('invalid reminder accepted');
    fresh.saveReminder({ title: 'بعداً', at: soon });

    if (fresh.getReminders().length !== 2) throw new Error('reminder list wrong');
    const due = fresh.getDueReminders();
    if (due.length !== 1 || due[0].title !== 'واریز شهریه') throw new Error('due detection wrong: ' + due.length);
    if (due[0].place !== 'کلینیک') throw new Error('reminder place lost');

    // Firing must be recorded so it never announces twice.
    fresh.markReminderFired(due[0].id);
    if (fresh.getDueReminders().length !== 0) throw new Error('reminder fired twice');

    fresh.setReminderDone(rem.id, true);
    if (fresh.getReminders().some((r) => r.id === rem.id)) throw new Error('done reminder still active');
    if (fresh.getReminders({ includeDone: true }).length !== 2) throw new Error('done reminder missing');

    // Voice notes: a data-URL is kept with its duration, junk is ignored.
    const vs = fresh.ensureSession(1404, 2, 3);
    fresh.setAttendance(vs.id, 1, ok2.id, {
      status: 'absent',
      voice: 'data:audio/webm;base64,AAAA',
      voiceMs: 4200,
    });
    const withVoice = fresh.getSession(vs.id).slots['1'][ok2.id];
    if (!withVoice.voice) throw new Error('voice note not stored');
    if (withVoice.voiceMs !== 4200) throw new Error('voice duration lost');

    fresh.setAttendance(vs.id, 1, two.id, { status: 'absent', voice: 'not-audio' });
    const noVoice = fresh.getSession(vs.id).slots['1'][two.id];
    if (noVoice.voice) throw new Error('non-audio voice value was stored');

    console.log('ok');
  `;
  const out = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: ROOT, stdio: 'pipe',
  }).toString().trim();
  ok(`store round-trip ${out}`);
} catch (e) {
  bad(`store round-trip failed: ${String(e.stderr || e.stdout || e).slice(0, 300)}`);
}

console.log('\n6. Manifest sanity');
try {
  const m = JSON.parse(readFileSync(join(ROOT, 'manifest.webmanifest'), 'utf8'));
  const checks = [
    ['name', m.name], ['short_name', m.short_name], ['lang', m.lang], ['dir', m.dir],
    ['start_url', m.start_url], ['display', m.display],
    ['192 icon', m.icons.some((i) => i.sizes === '192x192')],
    ['512 icon', m.icons.some((i) => i.sizes === '512x512')],
    ['maskable', m.icons.some((i) => i.purpose === 'maskable')],
  ];
  for (const [name, val] of checks) {
    if (val) ok(`${name}: ${val === true ? 'present' : val}`);
    else bad(`manifest ${name}`);
  }
} catch (e) {
  bad(`manifest not valid JSON: ${e.message}`);
}

console.log('\n7. Security spot-checks');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
if (html.includes('rel="manifest"')) ok('manifest linked'); else bad('manifest not linked');
const swText = sw;
if (/https?:\/\/(?!cdn\.jsdelivr\.net)/.test(
  [...readFileSync(join(ROOT, 'src/styles.css'), 'utf8').matchAll(/url\((https?:[^)]+)\)/g)].map((m) => m[1]).join(),
)) bad('unexpected remote asset in styles.css'); else ok('only the font is remote');
if (!/skipWaiting/.test(swText) || !/clients\.claim/.test(swText)) bad('sw missing skipWaiting/claim');
else ok('sw lifecycle hooks present');

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);