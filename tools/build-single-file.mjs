/* ============================================================
   tools/build-single-file.mjs
   Bundle the whole app into ONE self-contained .html file that
   runs from a phone's file manager (or any host) with no server.

   How it works: every module is wrapped in a factory registered
   under its path; `import` becomes a lookup and `export` becomes a
   property assignment. Because the project has no dynamic import()
   and no import.meta, a tiny registry is enough — no bundler needed.
   ============================================================ */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'dist');
const VERSION = '1.0.0';

/** Entry last: everything it needs must already be registered. */
const MODULES = [
  'src/jalali.js',
  'src/store.js',
  'src/ui.js',
  'src/reports.js',
  'src/timer.js',
  'src/pages/members.js',
  'src/pages/settings.js',
  'src/pages/door.js',
  'src/pages/attendance.js',
  'src/pages/payment.js',
  'src/pages/homework.js',
  'src/pages/home.js',
  'src/app.js',
];

/**
 * Rewrite one module's ES syntax into registry calls.
 * @param {string} source
 * @param {string} id module id, e.g. "src/store.js"
 */
function transform(source, id) {
  const deps = [];
  let out = source;

  // 1. import { a, b as c } from './x.js';   (also default-only imports)
  out = out.replace(
    /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?/g,
    (_m, clause, spec) => {
      deps.push(spec);
      const names = clause
        .replace(/[{}]/g, ' ')
        .replace(/\*\s+as\s+\w+/g, '')      // drop /* … */ namespace imports
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (!names.length) return `__req(${JSON.stringify(spec)});`;
      return `const { ${names.join(', ')} } = __req(${JSON.stringify(spec)});`;
    },
  );

  // 2. import './x.js';  (side-effect only)
  out = out.replace(
    /import\s+['"]([^'"]+)['"]\s*;?/g,
    (_m, spec) => { deps.push(spec); return `__req(${JSON.stringify(spec)});`; },
  );

  // 3. export default { … } / export default function / export default expr
  out = out.replace(/export\s+default\s+/g, '__exports.default = ');

  // 4. export function / export async function / export const / export let
  out = out.replace(
    /export\s+(async\s+function|function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/g,
    (_m, kind, name) => {
      // Declare it, then expose it. Kept as a statement (not a const) so
      // hoisting still matches the original semantics.
      return `${kind} ${name}; __exports.${name} = ${name};`;
    },
  );

  // 5. `export { a, b };` — rare, but handle it.
  out = out.replace(/export\s*\{([^}]*)\}\s*;?/g, (_m, names) => {
    const list = names.split(',').map((s) => s.trim()).filter(Boolean);
    return list.map((n) => {
      const [local, exported] = n.split(/\s+as\s+/).map((s) => s.trim());
      return `__exports.${exported || local} = ${local};`;
    }).join(' ');
  });

  // 6. Any leftover `export ` is a syntax error in a classic script.
  out = out.replace(/^\s*export\s+/gm, '');

  return { code: out, deps };
}

/** Resolve a relative specifier the way the browser would, relative to `from`. */
function resolve(from, spec) {
  const base = dirname(from);
  const target = spec.startsWith('.') ? join(base, spec) : spec;
  // Normalise to forward slashes so the ids match between platforms.
  return target.split('\\').join('/').replace(/^\.\//, '');
}

function build() {
  const parts = [];

  for (const id of MODULES) {
    const file = join(ROOT, id);
    if (!existsSync(file)) throw new Error(`missing module: ${id}`);
    const { code, deps } = transform(readFileSync(file, 'utf8'), id);
    const resolved = [...new Set(deps.map((d) => resolve(id, d)))];
    parts.push(
      `__def(${JSON.stringify(id)}, function (__req, __exports) {\n${code}\n}, ${JSON.stringify(resolved)});`,
    );
  }

  return parts.join('\n\n');
}

function buildHtml() {
  const css = readFileSync(join(ROOT, 'src/styles.css'), 'utf8');
  const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
  const iconSvg = readFileSync(join(ROOT, 'icons/icon.svg'), 'utf8');
  const iconDataUri = `data:image/svg+xml;base64,${Buffer.from(iconSvg, 'utf8').toString('base64')}`;
  const bundle = build();

  // Reuse the real <body> markup from index.html so the two never drift.
  const bodyMatch = html.match(/<body>([\s\S]*?)<\/body>/i);
  const body = bodyMatch ? bodyMatch[1] : '';
  // Drop the module script tag; the bundle is inlined instead.
  const bodyClean = body.replace(/<script[\s\S]*?<\/script>/gi, '');

  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="description" content="My-Class-Track — دستیار پیگیری حضور، شهریه و تکالیف کلاس گروه‌درمانی هفتگی" />
<meta name="theme-color" content="#5b5bd6" />
<meta name="mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<title>My-Class-Track</title>
<link rel="icon" href="${iconDataUri}" type="image/svg+xml" />
<style>
${css}
</style>
</head>
<body>
${bodyClean.trim()}
<script>
/* ------------------------------------------------------------
   My-Class-Track ${VERSION} — single-file build
   Modules are registered by path and resolved on first require.
   ------------------------------------------------------------ */
(function () {
  'use strict';

  var __factories = {};
  var __cache = {};

  function __def(id, factory, deps) {
    __factories[id] = { factory: factory, deps: deps };
  }

  function __normalize(from, spec) {
    if (spec.charAt(0) !== '.') return spec;
    var base = from.split('/');
    base.pop();
    var parts = spec.split('/');
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      if (p === '.' || p === '') continue;
      if (p === '..') base.pop();
      else base.push(p);
    }
    return base.join('/');
  }

  function __req(spec) {
    // Resolve a relative specifier against whichever module asked for it.
    var id = spec.charAt(0) === '.' && __currentModule
      ? __normalize(__currentModule, spec)
      : spec;

    if (Object.prototype.hasOwnProperty.call(__cache, id)) return __cache[id];

    var entry = __factories[id];
    if (!entry) throw new Error('module not found: ' + id);

    var exports = {};
    var previous = __currentModule;
    __currentModule = id;
    try {
      // Hand the module its own exports object so assignments land on it.
      entry.factory(function (sub) { return __req(sub); }, exports);
    } finally {
      __currentModule = previous;
    }
    return ( __cache[id] = exports );
  }

  var __currentModule = null;

  ${bundle}

  __req('src/app.js');
  document.documentElement.setAttribute('data-bundle-ran', 'yes');
}());
</script>
</body>
</html>
`;
}

// --- run -------------------------------------------------------------------
mkdirSync(OUT_DIR, { recursive: true });
const outFile = join(OUT_DIR, `My-Class-Track-${VERSION}.html`);

const full = buildHtml();

// Escape `</script>` inside the inline JS payload only. Escaping the whole
// document would corrupt the real closing tag and truncate the page, so the
// payload is isolated first and the closing tag is restored verbatim.
const OPEN = '<script>';
const CLOSE = '</script>';
const start = full.indexOf(OPEN);
const end = full.lastIndexOf(CLOSE);
if (start === -1 || end === -1 || end < start) {
  throw new Error('build-single-file: inline script boundary not found');
}
const payload = full.slice(start + OPEN.length, end).replace(/<\/script>/gi, '<\\/script>');
const safe = full.slice(0, start + OPEN.length) + payload + full.slice(end);

writeFileSync(outFile, safe, 'utf8');

console.log(`\n  ${outFile}`);
console.log(`  ${(Buffer.byteLength(safe) / 1024).toFixed(0)} KB\n`);