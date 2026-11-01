#!/usr/bin/env node
/**
 * Builds src/dark-theme.css.
 *
 * Why this exists: tokens.css has a proper dark theme, but most pages (dashboard, clubs,
 * projects, events, notifications, profile, about ...) paint themselves with hard-coded
 * hex colours and have no dark rules. Switching the theme therefore flipped the token-based
 * text to light while the cards stayed white, which is what "nothing is visible" looks like.
 *
 * This script reads every page stylesheet, finds each declaration that paints a colour
 * (text, background, border, fill, stroke), and emits a matching override scoped to
 * :root[data-theme="dark"]. The source files are never edited and light mode is untouched.
 *
 * How colours are mapped (OKLCH, hue kept):
 *   surfaces  pale -> dark, in the same order (white card < wash < selected), so hovers and
 *             selected states still step the right way. Mid and deep brand blues stay.
 *   ink       dark text -> light text, with a floor so small grey labels remain readable.
 *   borders   pale hairlines -> a visible dark hairline.
 *   accents   bright saturated fills (amber, sky, indigo) keep their colour, and so does the ink
 *             that shares their rule.
 *   sheens    low-alpha white highlights on dark tiles are left alone.
 *
 * Usage (from frontend/):   node scripts/build-dark-theme.mjs   [srcDir]
 * Re-run it after adding or changing colours in a page stylesheet.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SRC = process.argv[2] ?? 'src';
const OUT = join(SRC, 'dark-theme.css');
const SCOPE = ':root[data-theme="dark"]';

/** Stylesheets that own their own look in both themes, or already handle dark. */
const SKIP_FILES = new Set(['tokens.css', 'landing.css', 'login-diary.css', 'loader.css', 'dark-theme.css']);

/* ── Colour maths (sRGB <-> OKLab <-> OKLCH) ─────────────────────────────── */

const toLin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const fromLin = (x) => { x = Math.min(1, Math.max(0, x)); return 255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055); };

function rgbToLch([r, g, b]) {
  const [lr, lg, lb] = [toLin(r), toLin(g), toLin(b)];
  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return { L, C: Math.hypot(A, B), h: ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360 };
}

function lchToRgbRaw({ L, C, h }) {
  const a = C * Math.cos((h * Math.PI) / 180), b = C * Math.sin((h * Math.PI) / 180);
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}
const inGamut = (rgb) => rgb.every((v) => v >= -0.0005 && v <= 1.0005);
/** Back to sRGB, trimming chroma until it fits the gamut. */
function lchToRgb(lch) {
  let { C } = lch, rgb = lchToRgbRaw({ ...lch, C });
  for (let i = 0; i < 24 && !inGamut(rgb); i++) { C *= 0.9; rgb = lchToRgbRaw({ ...lch, C }); }
  return rgb.map((v) => Math.round(fromLin(v)));
}

/* ── Colour tokens inside a value ────────────────────────────────────────── */

function parseHex(t) {
  let h = t.slice(1);
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join('');
  if (h.length !== 6 && h.length !== 8) return null;
  const n = (i) => parseInt(h.slice(i, i + 2), 16);
  return { rgb: [n(0), n(2), n(4)], a: h.length === 8 ? n(6) / 255 : 1 };
}
function parseFn(t) {
  const m = t.match(/^(rgba?|oklch)\(([^)]*)\)$/i);
  if (!m) return null;
  const parts = m[2].trim().split(/[\s,/]+/).filter(Boolean);
  if (m[1].toLowerCase() === 'oklch') {
    const pct = (v) => (v.endsWith('%') ? parseFloat(v) / 100 : parseFloat(v));
    const L = pct(parts[0]), C = parseFloat(parts[1]), h = parseFloat(parts[2]) || 0;
    if ([L, C].some(Number.isNaN)) return null;
    const a = parts[3] === undefined ? 1 : pct(parts[3]);
    return { lch: { L, C, h }, a, oklch: true };
  }
  const ch = (v) => (v.endsWith('%') ? (parseFloat(v) / 100) * 255 : parseFloat(v));
  const rgb = parts.slice(0, 3).map(ch);
  if (rgb.some(Number.isNaN)) return null;
  const a = parts[3] === undefined ? 1 : parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
  return { rgb, a };
}
function parseColor(t) {
  const c = t[0] === '#' ? parseHex(t) : parseFn(t);
  if (!c) return null;
  return { lch: c.lch ?? rgbToLch(c.rgb), a: c.a, oklch: Boolean(c.oklch) };
}
const hex2 = (n) => n.toString(16).padStart(2, '0');
const trim = (n) => String(+n.toFixed(3));
function format({ L, C, h }, a, asOklch) {
  if (asOklch) return `oklch(${trim(L * 100)}% ${trim(C)} ${trim(h)}${a < 1 ? ` / ${trim(a)}` : ''})`;
  const [r, g, b] = lchToRgb({ L, C, h });
  return a < 1 ? `rgba(${r}, ${g}, ${b}, ${trim(a)})` : `#${hex2(r)}${hex2(g)}${hex2(b)}`;
}

/* ── The mapping ─────────────────────────────────────────────────────────── */

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const PAGE_HUE = 258;

const ACCENT = Symbol('accent');

/** Returns the dark counterpart, null to leave the colour as it is, or ACCENT when a bright
 *  saturated fill (amber, sky blue, indigo) is deliberately kept: it was chosen to carry its
 *  ink, so the ink in the same rule must be kept too. */
function darken({ L, C, h }, a, role) {
  if (role === 'TEXT') {
    if (L >= 0.7) return null; // already light: white and pale text on dark tiles
    return { L: clamp(1.22 - L, 0.72, 0.95), C: Math.min(C, L < 0.35 ? 0.04 : 0.14), h };
  }
  // BG and BORDER
  if (L >= 0.6) {
    if (a < 0.5 && L >= 0.85) return null; // a white sheen on a dark tile
    // A bright, opaque accent fill is kept. A faint tint of one (a status pill's 14% green)
    // is not a fill: it sits on the card, so its ink lightens like any other ink.
    if (role === 'BG' && C >= 0.09 && L < 0.9) return a >= 0.6 ? ACCENT : null;
    const neutral = C < 0.02;
    const L2 = 0.245 + (1 - L) * 0.8875;
    // Dark washes stay muted; mid-tone brand blues (tile gradients) keep their colour.
    const cap = role === 'BG' ? clamp(0.06 + (L2 - 0.32) * 0.6, 0.06, 0.2) : 0.06;
    return { L: L2, C: neutral ? 0.02 : Math.min(C, cap), h: neutral ? PAGE_HUE : h };
  }
  return null;
}

function roleOf(prop) {
  if (/^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color|text-emphasis-color)$/.test(prop)) return 'TEXT';
  if (prop.startsWith('background') || prop === '-webkit-background-clip' || /^(stop-color|flood-color|accent-color|scrollbar-color)$/.test(prop)) return 'BG';
  if (prop.includes('border') || prop.startsWith('outline') || prop.startsWith('column-rule')) return 'BORDER';
  return null;
}
/** A guess for a custom property that is defined in several places with different values. */
function roleOfName(name, c) {
  if (/(ink|text|fg|muted|faint|label|heading|title)/.test(name)) return 'TEXT';
  if (/(line|border|rule|edge|divider|stroke)/.test(name)) return 'BORDER';
  return c.L >= 0.6 ? 'BG' : null;
}

/* ── CSS reading ─────────────────────────────────────────────────────────── */

function splitTop(s, sep) {
  const out = []; let depth = 0, quote = '', cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quote) { cur += ch; if (ch === quote && s[i - 1] !== '\\') quote = ''; continue; }
    if (ch === '\\') { cur += ch + (s[i + 1] ?? ''); i++; continue; } // an escaped character is literal
    if (ch === '"' || ch === "'") { quote = ch; cur += ch; continue; }
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === sep && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function parse(css) {
  let i = 0;
  const skipBlock = () => { // i is just past '{'
    let depth = 1, quote = '';
    while (i < css.length && depth) {
      const ch = css[i++];
      if (quote) { if (ch === quote && css[i - 2] !== '\\') quote = ''; continue; }
      if (ch === '\\') { i++; continue; }
      if (ch === '"' || ch === "'") quote = ch; else if (ch === '{') depth++; else if (ch === '}') depth--;
    }
  };
  const body = () => { // returns text up to the matching '}'
    const start = i; let depth = 1, quote = '';
    while (i < css.length) {
      const ch = css[i];
      if (quote) { if (ch === quote && css[i - 1] !== '\\') quote = ''; }
      else if (ch === '\\') { i += 2; continue; }
      else if (ch === '"' || ch === "'") quote = ch;
      else if (ch === '{') depth++;
      else if (ch === '}' && --depth === 0) break;
      i++;
    }
    return css.slice(start, i++);
  };
  const nodes = () => {
    const out = [];
    while (i < css.length) {
      while (i < css.length && /\s/.test(css[i])) i++;
      if (css[i] === '}') { i++; return out; }
      let start = i, depth = 0, quote = '';
      while (i < css.length) {
        const ch = css[i];
        if (quote) { if (ch === quote && css[i - 1] !== '\\') quote = ''; }
        else if (ch === '\\') { i += 2; continue; }
        else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '(') depth++;
        else if (ch === ')') depth--;
        else if ((ch === '{' || ch === ';') && depth === 0) break;
        i++;
      }
      const prelude = css.slice(start, i).trim();
      if (css[i] === ';') { i++; continue; }
      if (i >= css.length) break;
      i++; // '{'
      if (prelude.startsWith('@')) {
        const name = prelude.slice(1).split(/[\s(]/)[0].toLowerCase();
        if (['media', 'supports', 'container', 'layer'].includes(name)) out.push({ type: 'at', prelude, children: nodes() });
        else skipBlock();
      } else {
        out.push({ type: 'rule', selector: prelude, decls: splitTop(body(), ';').map((d) => d.trim()).filter(Boolean) });
      }
    }
    return out;
  };
  return nodes();
}

function* walkRules(nodes) {
  for (const n of nodes) { if (n.type === 'rule') yield n; else if (n.type === 'at') yield* walkRules(n.children); }
}
function splitDecl(d) {
  const k = d.indexOf(':');
  if (k < 0) return null;
  const prop = d.slice(0, k).trim().toLowerCase();
  let value = d.slice(k + 1).trim(), important = false;
  if (/!\s*important$/i.test(value)) { important = true; value = value.replace(/\s*!\s*important$/i, ''); }
  return { prop, value, important };
}

/* ── Gather files ────────────────────────────────────────────────────────── */

function listCss(dir) {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'node_modules' ? [] : listCss(p);
    return name.endsWith('.css') ? [p] : [];
  });
}
const allCss = listCss(SRC).sort((a, b) => (a.endsWith('app.css') ? -1 : b.endsWith('app.css') ? 1 : a.localeCompare(b)));
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '');
const parsed = allCss.map((file) => ({ file, tree: parse(strip(readFileSync(file, 'utf8'))), skip: SKIP_FILES.has(file.split(/[\\/]/).pop()) }));

/* Custom properties: which hold one literal colour, and which are already theme-aware. */
const defs = new Map(); // name -> Set(literal)
const themed = new Set(); // names that some dark rule redefines
for (const { tree } of parsed) {
  for (const rule of walkRules(tree)) {
    const isDark = /data-theme/.test(rule.selector);
    for (const raw of rule.decls) {
      const d = splitDecl(raw);
      if (!d || !d.prop.startsWith('--')) continue;
      if (isDark) { themed.add(d.prop); continue; }
      if (/^(#[0-9a-f]{3,8}|rgba?\([^)]*\)|oklch\([^)]*\))$/i.test(d.value) && parseColor(d.value)) {
        if (!defs.has(d.prop)) defs.set(d.prop, new Set());
        defs.get(d.prop).add(d.value.toLowerCase());
      }
    }
  }
}
const resolvable = new Map();
const ambiguous = new Set();
for (const [name, vals] of defs) {
  if (themed.has(name)) continue;
  if (vals.size === 1) resolvable.set(name, [...vals][0]); else ambiguous.add(name);
}

/* ── Transform a declaration value ───────────────────────────────────────── */

const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3,4}\b|(?:rgba?|oklch)\([^)]*\)|var\(\s*--[\w-]+\s*\)/g;

/** Maps every colour in `value`. Returns { out, accent } or null when nothing changes. */
function transformValue(value, role) {
  if (/url\(/i.test(value)) return null;
  let changed = false, accent = false;
  const out = value.replace(COLOR_RE, (tok) => {
    let literal = tok;
    if (tok.startsWith('var(')) {
      const name = tok.slice(4, -1).trim();
      if (!resolvable.has(name)) return tok;
      literal = resolvable.get(name);
    }
    const c = parseColor(literal);
    if (!c) return tok;
    const d = darken(c.lch, c.a, role);
    if (d === ACCENT) { accent = true; return tok.startsWith('var(') ? literal : tok; }
    if (!d) return tok.startsWith('var(') ? literal : tok;
    changed = true;
    return format(d, c.a, c.oklch);
  });
  return changed || accent ? { out, changed, accent } : null;
}

/** Splits a value into its top-level colour tokens (to find a lone colour in a shorthand). */
const colorTokens = (value) => value.match(COLOR_RE) ?? [];

/** background / border shorthands reset their siblings (background-clip, border-width ...),
 *  which would break text-clipped gradients and thick borders. Emit only the longhand that
 *  carries the colour. Returns [prop, value] or null when it cannot be done safely. */
function longhand(prop, out, original) {
  if (prop === 'background') {
    const v = out.trim();
    const toks = colorTokens(v);
    if (toks.length === 1 && toks[0] === v) return ['background-color', v];
    // only gradients, no positions, sizes or repeats
    const bare = v.replace(/(?:repeating-)?(?:linear|radial|conic)-gradient\((?:[^()]|\([^()]*\))*\)/g, '').replace(/[\s,]+/g, '');
    if (bare === '' && /gradient\(/.test(v)) return ['background-image', v];
    return null;
  }
  if (/^(border(-top|-right|-bottom|-left)?|outline|column-rule)$/.test(prop)) {
    const toks = colorTokens(out);
    return toks.length === 1 ? [`${prop}-color`, toks[0]] : null;
  }
  void original;
  return [prop, out];
}

function scoped(selector) {
  return splitTop(selector, ',').map((s) => {
    s = s.trim();
    if (/^(:root|html)(?![\w-])/.test(s)) return s.replace(/^(:root|html)/, SCOPE);
    return `${SCOPE} ${s}`;
  }).join(', ');
}

let ruleCount = 0, declCount = 0;
const CLASS_RE = /[.#][A-Za-z_][\w-]*/g;
const classesOf = (selector) => new Set(selector.match(CLASS_RE) ?? []);

/** Work out, for one rule, which paint declarations change and which stay as authored. */
function analyse(n) {
  const out = []; // { prop, text, changed, role }
  let ruleAccent = false;
  const items = [];
  for (const raw of n.decls) {
    const d = splitDecl(raw);
    if (!d) continue;
    if (d.prop.startsWith('--')) {
      if (!ambiguous.has(d.prop) || themed.has(d.prop)) continue;
      const c = parseColor(d.value);
      const role = c && roleOfName(d.prop, c.lch);
      const dk = c && role && darken(c.lch, c.a, role);
      if (dk && dk !== ACCENT) items.push({ d, role: 'VAR', next: format(dk, c.a, c.oklch) });
      continue;
    }
    const role = roleOf(d.prop);
    if (!role) continue;
    const r = transformValue(d.value, role);
    if (r && r.accent && role === 'BG') ruleAccent = true;
    items.push({ d, role, next: r && r.changed ? r.out : null });
  }
  for (const it of items) {
    const { d, role } = it;
    const imp = d.important ? ' !important' : '';
    // Ink that shares a rule with a bright fill that was kept stays as authored.
    const next = role === 'TEXT' && ruleAccent ? null : it.next;
    if (next === null) { out.push({ prop: d.prop, text: `${d.prop}: ${d.value}${imp}`, changed: false, role }); continue; }
    let prop = d.prop, value = next;
    if (role === 'BG' || role === 'BORDER') { const lh = longhand(prop, value, d.value); if (lh) [prop, value] = lh; }
    out.push({ prop, text: `${prop}: ${value}${imp}`, changed: true, role });
  }
  return out;
}

/** Pass 1: the classes that appear in a selector whose colours are remapped. */
const touched = new Set();
(function collect(nodes) {
  for (const n of nodes) {
    if (n.type === 'at') { if (!/prefers-color-scheme/.test(n.prelude)) collect(n.children); continue; }
    if (/data-theme/.test(n.selector)) continue;
    if (analyse(n).some((x) => x.changed)) classesOf(n.selector).forEach((c) => touched.add(c));
  }
})(parsed.flatMap((f) => (f.skip ? [] : f.tree)));

/** Pass 2. A scoped copy outranks the original by two classes, so a rule that merely *resets*
 *  something later in the cascade (background: none, a token colour, white ink) would now lose
 *  to the copy of an earlier rule. To keep the author's order, every rule that shares a class
 *  with a remapped rule is re-emitted whole (its paint declarations), unchanged where nothing
 *  needed remapping. */
function emit(nodes, indent = '') {
  const lines = [];
  for (const n of nodes) {
    if (n.type === 'at') {
      if (/prefers-color-scheme/.test(n.prelude)) continue;
      const inner = emit(n.children, indent + '  ');
      if (inner.length) lines.push(`${indent}${n.prelude} {`, ...inner, `${indent}}`);
      continue;
    }
    if (/data-theme/.test(n.selector)) continue; // already has its own dark rules
    const items = analyse(n);
    const changed = items.some((x) => x.changed);
    const related = [...classesOf(n.selector)].some((c) => touched.has(c));
    if (!changed && !related) continue;
    const keep = items.filter((x) => !/url\(/i.test(x.text));
    if (!keep.length) continue;
    ruleCount++; declCount += keep.filter((x) => x.changed).length;
    lines.push(`${indent}${scoped(n.selector)} { ${keep.map((x) => x.text).join('; ')}; }`);
  }
  return lines;
}

/* ── Hand-tuned base: the dark theme tokens, lifted for contrast ─────────── */

const BASE = `/* The dark theme tokens, lifted. The original dark values left the page (17.5%) and the
   cards (20.5%) only three points apart, so panels melted into the page. Cards now sit about
   seven points above the page, rules and muted text are brighter, and the accent is a touch
   lighter. Spacing, radii and fonts are not touched. */
${SCOPE} {
  --color-paper: oklch(18% 0.02 258);
  --color-paper-2: oklch(23.5% 0.022 258);
  --color-paper-3: oklch(28% 0.024 258);
  --color-sheet: oklch(24.5% 0.02 258);

  --color-ink: oklch(97% 0.008 250);
  --color-ink-2: oklch(88% 0.012 252);
  --color-muted: oklch(76% 0.016 254);
  --color-rule: oklch(34% 0.02 258);
  --color-rule-2: oklch(43% 0.022 258);

  --color-accent: oklch(60% 0.18 257);
  --color-accent-wash: oklch(30% 0.06 258);
  --color-accent-deep: oklch(80% 0.13 254);
  --color-key-face: oklch(28% 0.022 258);
  --color-key-edge: oklch(38% 0.024 258);
  --color-hatch: oklch(32% 0.02 258);

  --bg: oklch(18% 0.02 258);
  --bg-card: oklch(24.5% 0.02 258);
  --bg-card-2: oklch(23.5% 0.022 258);
  --surface: oklch(24.5% 0.02 258);
  --border: oklch(34% 0.02 258);
  --text: oklch(97% 0.008 250);
  --text-muted: oklch(88% 0.012 252);
  --text-faint: oklch(76% 0.016 254);

  /* Used from inline styles, so they cannot be remapped rule by rule: link and accent ink
     and its glow, which were a navy that disappears on a dark card. */
  --primary: oklch(79% 0.11 258);
  --primary-glow: oklch(70% 0.13 258 / 0.16);
}
`;

/* ── Write ───────────────────────────────────────────────────────────────── */

const sections = [];
for (const { file, tree, skip } of parsed) {
  if (skip) continue;
  const before = ruleCount;
  const lines = emit(tree);
  if (lines.length) sections.push(`/* ── ${relative(SRC, file).replace(/\\/g, '/')} (${ruleCount - before} rules) ── */\n${lines.join('\n')}`);
}

const header = `/* GENERATED by scripts/build-dark-theme.mjs. Do not edit by hand; edit the script or the
   source stylesheet and re-run:  node scripts/build-dark-theme.mjs

   Dark-mode overrides for every page stylesheet that paints with hard-coded colours.
   Each rule is the source rule's colour declarations, remapped for a dark page and scoped to
   ${SCOPE}, so light mode is unchanged and nothing here fights the tokens. */
`;
writeFileSync(OUT, `${header}\n${BASE}\n${sections.join('\n\n')}\n`);
console.log(`dark-theme.css: ${ruleCount} rules, ${declCount} declarations from ${sections.length} stylesheets`);
console.log(`custom colour properties baked into usages: ${resolvable.size}; ambiguous (definition overridden): ${ambiguous.size}; already themed: ${themed.size}`);
if (ambiguous.size) console.log('ambiguous:', [...ambiguous].join(' '));
