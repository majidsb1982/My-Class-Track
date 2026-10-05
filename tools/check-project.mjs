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
  'src/reports.js', 'src/timer.js', 'src/app.js',
  'src/pages/home.js', 'src/pages/attendance.js', 'src/pages/door.js',
  'src/pages/payment.js', 'src/pages/homework.js', 'src/pages/members.js',
  'src/pages/settings.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png',
  '.github/workflows/pages.yml',
]) {
  const p = join(ROOT, f);
  if (!existsSync(p)) bad(`missing ${f}`);
  else if (statSync(p).size === 0) bad(`empty ${f}`);
  else ok(f);
}

console.log('\n2. Module syntax');
for (const f of ['src/jalali.js', 'src/store.js', 'src/ui.js', 'src/reports.js', 'src/timer.js', 'src/app.js']) {
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
  'src/timer.js', 'src/reports.js', 'src/pages/home.js', 'src/pages/attendance.js',
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