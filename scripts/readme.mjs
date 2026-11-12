#!/usr/bin/env node
// Profile README generator.
//
//   node scripts/readme.mjs build   -> render every SVG in assets/{dark,light}
//   node scripts/readme.mjs stats   -> refresh data/stats.json from the GitHub API, then build
//   node scripts/readme.mjs ship    -> process a "ship --<type>" issue (used by the Action), then build
//
// Type: Instrument Serif (display), Geist (text), Geist Mono (details), all OFL,
// subset to ASCII + a few symbols in scripts/fonts and embedded into each SVG.
// metrics.json holds glyph advances so text can be measured without a browser.
// No dependencies. Node 20+.

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = 'pksingh1508';
const p = (...a) => join(ROOT, ...a);
const readJSON = (f, d) => (existsSync(p(f)) ? JSON.parse(readFileSync(p(f), 'utf8')) : d);
const writeJSON = (f, v) => writeFileSync(p(f), JSON.stringify(v, null, 2) + '\n');

// ───────────────────────── design tokens ─────────────────────────
// Backgrounds stay transparent so every image sits directly on GitHub's page.
// Neutrals follow GitHub's own greys; one warm accent, used sparingly.
const THEMES = {
  dark: {
    text: '#F0F6FC', muted: '#9198A1', faint: '#656C76', line: '#262C36', lineHi: '#3D444D',
    accent: '#FB923C', ok: '#3FB950', bad: '#F85149', warn: '#D29922', dot: '#9198A1',
    heat: ['#1C2129', '#4A2611', '#8C3D14', '#D4661F', '#FB923C'],
  },
  light: {
    text: '#1F2328', muted: '#59636E', faint: '#818B98', line: '#E1E6EB', lineHi: '#C9D1D9',
    accent: '#C2410C', ok: '#1A7F37', bad: '#CF222E', warn: '#9A6700', dot: '#59636E',
    heat: ['#EBEEF1', '#FED7AA', '#FDBA74', '#F97316', '#C2410C'],
  },
};

// GitHub's colours for each language.
const LANG_COLORS = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', HTML: '#e34c26', CSS: '#663399', PHP: '#4F5D95', Java: '#b07219',
  Python: '#3572A5', 'C++': '#f34b7d', C: '#555555', Dart: '#00B4AB', Kotlin: '#A97BFF', Go: '#00ADD8', Shell: '#89e051',
};

const W = 880;

// ───────────────────────── type ─────────────────────────
const B64 = {};
const font = (k) => (B64[k] ??= readFileSync(p('scripts/fonts', `${k}.woff2`)).toString('base64'));
const FACES = {
  serif: () => `@font-face{font-family:'IS';font-style:normal;src:url(data:font/woff2;base64,${font('serif')}) format('woff2');}`,
  serifItalic: () => `@font-face{font-family:'IS';font-style:italic;src:url(data:font/woff2;base64,${font('serifItalic')}) format('woff2');}`,
  sans: () => `@font-face{font-family:'GS';font-weight:100 900;src:url(data:font/woff2;base64,${font('sans')}) format('woff2');}`,
  mono: () => `@font-face{font-family:'GM';font-weight:100 900;src:url(data:font/woff2;base64,${font('mono')}) format('woff2');}`,
};
const METRICS = JSON.parse(readFileSync(p('scripts/fonts/metrics.json'), 'utf8'));
function measure(s, face, size, { weight = 400, ls = 0 } = {}) {
  const m = METRICS[face] || METRICS[face + weight];
  let w = 0;
  for (const ch of String(s)) w += m[ch] ?? 0.6;
  return w * size + ls * [...String(s)].length;
}

const BASE_CSS = `
.serif{font-family:'IS','Iowan Old Style',Georgia,serif;}.it{font-style:italic;}
.sans{font-family:'GS',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;}
.mono{font-family:'GM',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;}
.rise{animation:rise 1.1s cubic-bezier(.16,1,.3,1) both;}
@keyframes rise{from{opacity:0;transform:translateY(14px);}}
.fade{animation:fade 1.4s cubic-bezier(.16,1,.3,1) both;}
@keyframes fade{from{opacity:0;}}
.draw{transform-box:fill-box;transform-origin:0 50%;animation:draw 1.4s cubic-bezier(.65,0,.35,1) both;}
@keyframes draw{from{transform:scaleX(0);}}
.pop{transform-box:fill-box;transform-origin:center;animation:pop .7s cubic-bezier(.34,1.56,.64,1) both;}
@keyframes pop{from{opacity:0;transform:scale(0);}}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2.6s cubic-bezier(0,0,.2,1) infinite;}
@keyframes ping{0%{transform:scale(1);opacity:.6;}70%,100%{transform:scale(3.2);opacity:0;}}
@media (prefers-reduced-motion:reduce){.rise,.fade,.draw,.pop,.once{animation:none!important;}.loop,.ping{animation-play-state:paused!important;}}`;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const n2 = (v) => Math.round(v * 100) / 100;
const delay = (s) => `animation-delay:${n2(s)}s`;

function svg(w, h, body, { title, fonts = [], css = '' }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>${fonts.map((f) => FACES[f]()).join('')}${BASE_CSS}${css}</style>
${body}
</svg>
`;
}

// text(x, y, string, { face: serif|serifItalic|sans|mono, size, weight, fill, anchor, ls, cls, style, raw })
function text(x, y, s, { face = 'sans', size = 14, weight, fill, anchor, ls, cls = '', style, raw = false } = {}) {
  const c = [face === 'serifItalic' ? 'serif it' : face, cls].filter(Boolean).join(' ');
  return `<text x="${n2(x)}" y="${n2(y)}" class="${c}" font-size="${size}"${weight ? ` font-weight="${weight}"` : ''} fill="${fill}"${anchor ? ` text-anchor="${anchor}"` : ''}${ls ? ` letter-spacing="${ls}"` : ''}${style ? ` style="${style}"` : ''}>${raw ? s : esc(s)}</text>`;
}
const hair = (x, y, w, fill, { cls = 'draw', d = 0 } = {}) =>
  `<rect x="${n2(x)}" y="${n2(y)}" width="${n2(w)}" height="1" fill="${fill}"${cls ? ` class="${cls}" style="${delay(d)}"` : ''}/>`;
// Arrows are drawn, not typed, so they look identical everywhere.
const arrowNE = (x, y, s, c, sw = 1.5) =>
  `<path d="M${n2(x)} ${n2(y + s)}L${n2(x + s)} ${n2(y)}M${n2(x + s * 0.28)} ${n2(y)}H${n2(x + s)}V${n2(y + s * 0.72)}" stroke="${c}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"/>`;

// ───────────────────────── content ─────────────────────────
const PROFILE = {
  name: ['Pawan', 'Kumar'],
  lead: 'Software engineer building',
  rotating: ['web platforms.', 'mobile apps.', 'APIs & integrations.', 'cloud infrastructure.'],
  city: 'Gorakhpur, India',
  tz: 'UTC+5:30',
  coords: '26.76° N  83.37° E',
  lat: 26.76,
};

const LINKS = [
  { id: 'linkedin', label: 'LinkedIn' },
  { id: 'github', label: 'GitHub' },
  { id: 'instagram', label: 'Instagram' },
];

const ABOUT = {
  statement: [
    [['I turn messy operational problems into ', 'text']],
    [['calm, dependable software', 'it'], [' — web, mobile, APIs', 'muted']],
    [['and the cloud underneath, shipped end to end.', 'muted']],
  ],
  columns: [
    ['Now', 'Production systems and', 'call-operations tooling'],
    ['Focus', 'Next.js, React Native,', 'Supabase and Node.js'],
    ['Exploring', 'DevOps, distributed', 'systems and AI workflows'],
  ],
};

const PROJECTS = [
  { id: 'eu-work-support', tag: 'Mobile app + web', title: 'EU Work Support',
    desc: 'Work and visa guidance for Europe, with Stripe-powered PRO access.',
    stack: ['Expo', 'Clerk', 'Supabase', 'Stripe'] },
  { id: 'eu-crm', tag: 'Internal platform', title: 'EU CRM',
    desc: 'Lead pipeline from first contact to won, fed by a secure ingestion API.',
    stack: ['Next.js', 'Supabase', 'React Query'] },
  { id: 'signflow', tag: 'SaaS', title: 'SignFlow',
    desc: 'Upload a PDF, send a time-limited link, collect drawn e-signatures.',
    stack: ['Next.js', 'Supabase', 'pdf-lib'] },
  { id: 'eu-career-serwis', tag: 'Production website', title: 'EU Career Serwis',
    desc: 'Multilingual site for a European employment and visa consultancy.',
    stack: ['Next.js', 'next-intl', 'Strapi'] },
  { id: 'scanlabel', tag: 'Mobile app', title: 'ScanLabel',
    desc: 'Point the camera at a food label to get nutrition and allergens explained.',
    stack: ['Expo', 'Camera', 'Zod'] },
  { id: 'desi-run', tag: '3D game', title: 'Desi Run',
    desc: 'Endless runner through Indian streets, in raw Three.js with no engine.',
    stack: ['Three.js', 'TypeScript', 'Next.js'] },
];

// Two marquee rows: [icon file, name]
const STACK = [
  [['ts', 'TypeScript'], ['js', 'JavaScript'], ['react', 'React'], ['nextjs', 'Next.js'], ['expo', 'Expo'], ['tailwind', 'Tailwind'],
    ['threejs', 'Three.js'], ['php', 'PHP'], ['cpp', 'C++'], ['laravel', 'Laravel'], ['strapi', 'Strapi'], ['stripe', 'Stripe']],
  [['nodejs', 'Node.js'], ['express', 'Express'], ['postgres', 'PostgreSQL'], ['supabase', 'Supabase'], ['mongodb', 'MongoDB'], ['redis', 'Redis'],
    ['aws', 'AWS'], ['docker', 'Docker'], ['nginx', 'Nginx'], ['githubactions', 'GitHub Actions'], ['vercel', 'Vercel'], ['twilio', 'Twilio']],
];

const SHIP_TYPES = {
  feature: { bump: 'minor', label: 'ship --feature', sub: 'Minor release' },
  fix: { bump: 'patch', label: 'ship --fix', sub: 'Patch release' },
  hotfix: { bump: 'patch', label: 'ship --hotfix', sub: 'Restores prod' },
  'friday-deploy': { bump: 'major', label: 'ship --friday-deploy', sub: 'What could go wrong?' },
};

const ICONS = {};
const icon = (name, theme) => (ICONS[name + theme] ??= `data:image/svg+xml;base64,${readFileSync(p('scripts/icons', `${name}-${theme}.svg`)).toString('base64')}`);

// ───────────────────────── hero ─────────────────────────
// A dotted globe turning once every 48s, built from CSS keyframes only:
// each latitude ring gets one keyframe track, and each dot is that track with a phase offset.
function globe(t, cx, cy, R) {
  const tilt = (22 * Math.PI) / 180, period = 48, frames = 36;
  const track = (name, lat, marker) => {
    const phi = (lat * Math.PI) / 180;
    let k = `@keyframes ${name}{`;
    for (let f = 0; f <= frames; f++) {
      const a = (f / frames) * 2 * Math.PI;
      const x = R * Math.cos(phi) * Math.sin(a), y = R * Math.sin(phi), z = R * Math.cos(phi) * Math.cos(a);
      const sy = -(y * Math.cos(tilt) - z * Math.sin(tilt));
      const depth = (y * Math.sin(tilt) + z * Math.cos(tilt)) / R; // -1 back … 1 front
      const u = (depth + 1) / 2;
      const op = marker ? Math.max(0, Math.min(1, depth * 2.5 + 0.2)) : 0.08 + 0.92 * u * u;
      k += `${n2((f / frames) * 100)}%{transform:translate(${n2(x)}px,${n2(sy)}px) scale(${n2(0.55 + 0.65 * u)});opacity:${n2(op)}}`;
    }
    return `${k}}.${name}{animation:${name} ${period}s linear infinite;}`;
  };
  let css = '', dots = '';
  const lats = [-72, -60, -48, -36, -24, -12, 0, 12, 24, 36, 48, 60, 72];
  lats.forEach((lat, i) => {
    css += track(`g${i}`, lat);
    const n = Math.max(8, Math.round(38 * Math.cos((lat * Math.PI) / 180)));
    for (let j = 0; j < n; j++) dots += `<circle r="1.6" fill="${t.dot}" class="g${i} loop" style="${delay(-(j / n) * period - (i % 2) * (period / n / 2))}"/>`;
  });
  css += track('gk', PROFILE.lat, true);
  // the marker starts just left of centre, so it swings into view on load
  const marker = `<g class="gk loop" style="${delay(-(1 - 0.09) * period)}"><circle r="3.2" fill="${t.accent}" class="ping"/><circle r="3.2" fill="${t.accent}"/></g>`;
  const body = `<g class="fade" style="${delay(0.25)};animation-duration:2.4s">
<circle cx="${cx}" cy="${cy}" r="${R + 10}" stroke="${t.line}"/>
<g transform="translate(${cx} ${cy})">${dots}${marker}</g></g>`;
  return { css, body };
}

function hero(t) {
  const H = 316, nameSize = 92, nameY = 148, lineY = 206, leadSize = 21, rollSize = 27, step = 40;
  const [first, last] = PROFILE.name;
  const lastX = measure(first + ' ', 'serif', nameSize, { ls: -1.5 });
  const rollX = measure(PROFILE.lead + ' ', 'sans', leadSize) - 3;
  const words = PROFILE.rotating, n = words.length;
  let kf = '@keyframes roll{';
  words.forEach((_, i) => { kf += `${n2((i / n) * 100)}%,${n2(((i + 0.82) / n) * 100)}%{transform:translateY(${-i * step}px)}`; });
  kf += `100%{transform:translateY(${-n * step}px)}}`;
  const g = globe(t, 732, 160, 112);
  const body = `
<defs>
  <clipPath id="nm"><rect x="-6" y="${nameY - nameSize}" width="640" height="${nameSize * 1.24}"/></clipPath>
  <clipPath id="rl"><rect x="${n2(rollX - 4)}" y="${lineY - rollSize - 2}" width="${n2(600 - rollX)}" height="${rollSize + 12}"/></clipPath>
</defs>
<g class="fade" style="${delay(0)}">
  <circle cx="5" cy="22" r="3.5" fill="${t.ok}" class="ping"/><circle cx="5" cy="22" r="3.5" fill="${t.ok}"/>
  ${text(18, 26, 'Open to new opportunities', { face: 'mono', size: 12, fill: t.muted })}
</g>
<g clip-path="url(#nm)">
  ${text(-3, nameY, first, { face: 'serif', size: nameSize, fill: t.text, ls: -1.5, cls: 'up', style: delay(0.1) })}
  ${text(-3 + lastX, nameY, last, { face: 'serifItalic', size: nameSize, fill: t.text, ls: -1.5, cls: 'up', style: delay(0.22) })}
</g>
<g class="rise" style="${delay(0.45)}">
  ${text(0, lineY, PROFILE.lead, { face: 'sans', size: leadSize, fill: t.muted })}
  <g clip-path="url(#rl)"><g class="roll loop">${[...words, words[0]].map((w, i) => text(rollX, lineY + i * step, w, { face: 'serifItalic', size: rollSize, fill: t.text })).join('')}</g></g>
</g>
${hair(0, 262, 560, t.lineHi, { d: 0.6 })}
<g class="fade" style="${delay(0.9)}">
  ${text(0, 296, PROFILE.city, { face: 'mono', size: 12, fill: t.faint })}
  ${text(560, 296, PROFILE.tz, { face: 'mono', size: 12, fill: t.faint, anchor: 'end' })}
  ${text(732, 296, PROFILE.coords, { face: 'mono', size: 11, fill: t.faint, anchor: 'middle' })}
</g>
${g.body}`;
  const css = `
.up{animation:up 1.3s cubic-bezier(.16,1,.3,1) both;}@keyframes up{from{transform:translateY(${nameSize}px);}}
.roll{animation:roll 12s cubic-bezier(.76,0,.24,1) 1.6s infinite;}${kf}
@media (prefers-reduced-motion:reduce){.up{animation:none!important;}}${g.css}`;
  return svg(W, H, body, { title: `${first} ${last}. ${PROFILE.lead} ${words.join(' ')} Based in ${PROFILE.city}.`, fonts: ['serif', 'serifItalic', 'sans', 'mono'], css });
}

function linkPill(t, label) {
  const h = 40, lw = measure(label, 'sans', 14, { weight: 500 });
  const w = Math.ceil(18 + lw + 12 + 9 + 18);
  const body = `
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="${(h - 1) / 2}" stroke="${t.lineHi}"/>
${text(18, 25, label, { face: 'sans', size: 14, weight: 500, fill: t.text })}
${arrowNE(w - 18 - 9, 15.5, 9, t.accent)}`;
  return { w, svg: svg(w, h, body, { title: label, fonts: ['sans'] }) };
}

// ───────────────────────── sections ─────────────────────────
function heading(t, num, label, right = '') {
  const H = 56;
  const body = `
${hair(0, 0, W, t.lineHi)}
<g class="fade" style="${delay(0.3)}">
${text(0, 36, num, { face: 'mono', size: 12, fill: t.accent })}
${text(34, 36, label.toUpperCase(), { face: 'mono', size: 12, weight: 500, fill: t.text, ls: 1.4 })}
${right ? text(W, 36, right, { face: 'mono', size: 12, fill: t.faint, anchor: 'end' }) : ''}
</g>`;
  return svg(W, H, body, { title: label, fonts: ['mono'] });
}

function about(t) {
  const size = 36, lh = 46;
  const lines = ABOUT.statement.map((segs, i) => {
    const spans = segs.map(([s, kind]) => `<tspan${kind === 'it' ? ' class="it"' : ''} fill="${kind === 'muted' ? t.muted : t.text}">${esc(s)}</tspan>`).join('');
    return text(0, 40 + i * lh, spans, { face: 'serif', size, fill: t.text, ls: -0.4, cls: 'rise', style: delay(0.1 + i * 0.12), raw: true });
  }).join('');
  const top = 40 + (ABOUT.statement.length - 1) * lh + 44;
  const cw = W / ABOUT.columns.length;
  const cols = ABOUT.columns.map(([k, a, b], i) => `<g class="rise" style="${delay(0.5 + i * 0.1)}">
${text(i * cw, top + 34, k.toUpperCase(), { face: 'mono', size: 11, fill: t.faint, ls: 1.2 })}
${text(i * cw, top + 60, a, { face: 'sans', size: 15, fill: t.text })}
${text(i * cw, top + 82, b, { face: 'sans', size: 15, fill: t.muted })}</g>`).join('');
  const body = `${lines}${hair(0, top, W, t.line, { d: 0.45 })}${cols}`;
  const title = ABOUT.statement.map((l) => l.map((s) => s[0]).join('')).join('') + ' ' + ABOUT.columns.map(([k, a, b]) => `${k}: ${a} ${b}.`).join(' ');
  return svg(W, top + 96, body, { title, fonts: ['serif', 'serifItalic', 'sans', 'mono'] });
}

function projectRow(t, pr, i, last) {
  const H = 92;
  const stack = pr.stack.join(' · ');
  const right = Math.max(measure(stack, 'mono', 12), measure(pr.tag.toUpperCase(), 'mono', 11, { ls: 1.1 }));
  let desc = pr.desc;
  while (56 + measure(desc, 'sans', 14) > W - 28 - right - 32) desc = desc.replace(/\s*\S+$/, '') + '…';
  const body = `
${hair(0, 0, W, t.line, { d: i * 0.07 })}
<g class="rise" style="${delay(0.15 + i * 0.07)}">
${text(0, 42, String(i + 1).padStart(2, '0'), { face: 'mono', size: 12, fill: t.faint })}
${text(56, 42, pr.title, { face: 'sans', size: 20, weight: 500, fill: t.text, ls: -0.3 })}
${text(56, 68, desc, { face: 'sans', size: 14, fill: t.muted })}
${text(W - 28, 41, pr.tag.toUpperCase(), { face: 'mono', size: 11, fill: t.faint, anchor: 'end', ls: 1.1 })}
${text(W - 28, 68, stack, { face: 'mono', size: 12, fill: t.muted, anchor: 'end' })}
${arrowNE(W - 11, 31, 10, t.accent)}
</g>
${last ? hair(0, H - 1, W, t.line, { d: (i + 1) * 0.07 }) : ''}`;
  return svg(W, H, body, { title: `${pr.title}: ${pr.desc} Built with ${pr.stack.join(', ')}.`, fonts: ['sans', 'mono'] });
}

function marquee(t, theme) {
  const H = 116, rowH = 42, gap = 10;
  let defs = '', rows = '', css = '';
  STACK.forEach((items, r) => {
    let x = 0, g = '';
    for (const [ic, name] of items) {
      const w = Math.ceil(14 + 18 + 9 + measure(name, 'sans', 14) + 16);
      g += `<rect x="${x + 0.5}" y=".5" width="${w - 1}" height="${rowH - 1}" rx="${(rowH - 1) / 2}" stroke="${t.line}"/>`;
      g += `<image href="${icon(ic, theme)}" x="${x + 14}" y="12" width="18" height="18"/>`;
      g += text(x + 41, 26, name, { face: 'sans', size: 14, fill: t.text });
      x += w + gap;
    }
    defs += `<g id="r${r}">${g}</g>`;
    const dur = Math.round(x / 22);
    css += `.m${r}{animation:m${r} ${dur}s linear infinite;}@keyframes m${r}{from{transform:translateX(${r ? -x : 0}px)}to{transform:translateX(${r ? 0 : -x}px)}}`;
    rows += `<g transform="translate(0 ${8 + r * (rowH + 16)})"><g class="m${r} loop"><use href="#r${r}"/><use href="#r${r}" x="${x}"/><use href="#r${r}" x="${2 * x}"/></g></g>`;
  });
  const body = `
<defs>${defs}
<linearGradient id="fg" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".1" stop-color="#fff"/><stop offset=".9" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<mask id="fm" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#fg)"/></mask></defs>
<g mask="url(#fm)" class="fade" style="${delay(0.2)}">${rows}</g>`;
  return svg(W, H, body, { title: 'Tech stack: ' + STACK.flat().map((s) => s[1]).join(', '), fonts: ['sans'], css });
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function shipConsole(t, ship) {
  const H = 356, top = 64;
  const last = ship.deploys[0];
  const incident = ship.incident;
  const stColor = incident ? t.bad : t.ok;
  const stLabel = incident ? 'Incident: prod is down' : 'All systems operational';
  const px = 466, pr = W - 28, pw = pr - px;
  const avatar = ship.lastAvatar
    ? `<clipPath id="av"><circle cx="44" cy="216" r="14"/></clipPath><image href="${ship.lastAvatar}" x="30" y="202" width="28" height="28" clip-path="url(#av)"/><circle cx="44" cy="216" r="14.5" stroke="${t.line}"/>`
    : `<circle cx="44" cy="216" r="14" stroke="${t.lineHi}"/>`;

  // pipeline: segments draw in, then each stage ticks over
  const stages = ['Build', 'Test', 'Review', 'Deploy'];
  const sx = (i) => px + 12 + (i * (pw - 24)) / (stages.length - 1);
  const py = top + 76;
  let pipe = '';
  stages.forEach((s, i) => {
    const x = sx(i), at = 0.5 + i * 0.55;
    const failed = incident && i === stages.length - 1;
    const c = failed ? t.bad : t.ok;
    if (i < stages.length - 1) {
      const x1 = x + 17, x2 = sx(i + 1) - 17;
      pipe += `<rect x="${n2(x1)}" y="${py - 0.5}" width="${n2(x2 - x1)}" height="1" fill="${t.lineHi}"/>`;
      pipe += `<rect x="${n2(x1)}" y="${py - 0.75}" width="${n2(x2 - x1)}" height="1.5" fill="${c}" class="draw" style="${delay(at + 0.2)};animation-duration:.5s"/>`;
    }
    pipe += `<circle cx="${n2(x)}" cy="${py}" r="11.5" stroke="${t.lineHi}"/>`;
    pipe += `<g class="pop" style="${delay(at)}"><circle cx="${n2(x)}" cy="${py}" r="11.5" fill="${c}"/>${failed
      ? `<path d="M${n2(x - 3.5)} ${py - 3.5}l7 7M${n2(x + 3.5)} ${py - 3.5}l-7 7" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>`
      : `<path d="M${n2(x - 4.5)} ${py + 0.5}l3 3 6-6.5" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`}</g>`;
    pipe += text(x, py + 34, s, { face: 'sans', size: 12, fill: t.muted, anchor: 'middle' });
  });

  const rows = ship.deploys.slice(0, 3).map((d, i) => {
    const y = top + 172 + i * 26;
    const typeColor = d.type === 'friday-deploy' ? t.bad : d.type === 'hotfix' ? t.warn : t.muted;
    const user = '@' + (d.user.length > 16 ? d.user.slice(0, 15) + '…' : d.user);
    return `<g class="rise" style="${delay(1.2 + i * 0.1)}">${text(px, y, 'v' + d.version, { face: 'mono', size: 12, fill: i === 0 ? t.text : t.muted, weight: i === 0 ? 500 : 400 })}
${text(px + 80, y, d.type, { face: 'mono', size: 12, fill: typeColor })}
${text(px + 196, y, user, { face: 'mono', size: 12, fill: t.muted })}
${text(pr, y, shortDate(d.at), { face: 'mono', size: 12, fill: t.faint, anchor: 'end' })}</g>`;
  }).join('');

  const stat = (x, value, label, i) => `<g class="rise" style="${delay(0.6 + i * 0.08)}">${text(x, H - 46, value, { ...NUM, size: 34, fill: t.text, ls: -1 })}${text(x, H - 26, label.toUpperCase(), { face: 'mono', size: 10, fill: t.faint, ls: 1.1 })}</g>`;
  const stW = measure(stLabel, 'mono', 11);

  const body = `
${text(0, 18, 'Pick a command below and submit the issue. A GitHub Action ships the release with your name on it.', { face: 'sans', size: 14, fill: t.muted })}
${text(0, 40, 'Careful: deploying on a Friday takes prod down, and only a hotfix brings it back.', { face: 'sans', size: 14, fill: t.faint })}
<rect x=".5" y="${top + 0.5}" width="${W - 1}" height="${H - top - 1}" rx="14" stroke="${incident ? t.bad : t.lineHi}"${incident ? ' stroke-opacity=".6"' : ''}/>
${text(28, top + 38, 'CURRENT RELEASE', { face: 'mono', size: 11, fill: t.faint, ls: 1.2 })}
<g class="rise" style="${delay(0.2)}">${text(24, top + 108, 'v' + ship.version, { ...NUM, size: 72, fill: incident ? t.bad : t.text, ls: -2 })}</g>
<g class="fade" style="${delay(0.45)}">${avatar}
${text(68, 212, 'Shipped by @' + last.user, { face: 'sans', size: 14, fill: t.text })}
${text(68, 230, `${last.type} · ${fmtDate(last.at)}`, { face: 'mono', size: 11, fill: t.faint })}</g>
${hair(28, H - 92, 378, t.line, { d: 0.5 })}
${stat(28, String(ship.total), 'Deploys', 0)}${stat(152, String(ship.shippers), 'Shippers', 1)}${stat(276, String(ship.streak), 'Green streak', 2)}
<rect x="436" y="${top + 24}" width="1" height="${H - top - 48}" fill="${t.line}"/>
${text(px, top + 38, 'PIPELINE', { face: 'mono', size: 11, fill: t.faint, ls: 1.2 })}
<circle cx="${n2(pr - stW - 10)}" cy="${top + 34}" r="3.5" fill="${stColor}" class="${incident ? 'blink loop' : 'ping'}"/><circle cx="${n2(pr - stW - 10)}" cy="${top + 34}" r="3.5" fill="${stColor}"/>
${text(pr, top + 38, stLabel, { face: 'mono', size: 11, fill: stColor, anchor: 'end' })}
${pipe}
${text(px, top + 144, 'RECENT DEPLOYS', { face: 'mono', size: 11, fill: t.faint, ls: 1.2 })}
${rows}`;
  const css = `.blink{animation:blink 1s steps(1) infinite;}@keyframes blink{50%{opacity:0}}`;
  return svg(W, H, body, { title: `Release console: v${ship.version}, last shipped by @${last.user}. ${incident ? 'Prod is down.' : 'All systems operational.'}`, fonts: ['sans', 'mono'], css });
}

function button(t, label, sub, danger = false) {
  const w = 211, h = 64;
  const c = danger ? t.bad : t.text;
  const body = `
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="12" stroke="${danger ? t.bad : t.lineHi}"${danger ? ' stroke-opacity=".6"' : ''}/>
${text(18, 28, '$', { face: 'mono', size: 13, fill: danger ? t.bad : t.accent })}
${text(18 + measure('$ ', 'mono', 13), 28, label, { face: 'mono', size: 13, weight: 500, fill: c })}
${text(18, 47, sub, { face: 'sans', size: 12, fill: t.muted })}`;
  return svg(w, h, body, { title: `${label}: ${sub}`, fonts: ['sans', 'mono'] });
}

// Numbers roll up like an odometer, one digit column at a time.
const NUM = { face: 'sans', weight: 300 };
const numW = (s, size) => measure(s, 'sans', size, { weight: 300 });
function odometer(t, x, y, value, size, id, start) {
  const lh = size * 1.1;
  let out = `<clipPath id="${id}"><rect x="${x - 4}" y="${n2(y - size * 0.86)}" width="${n2(numW(value, size) + 8)}" height="${n2(size * 1.06)}"/></clipPath><g clip-path="url(#${id})">`;
  let cx = x, css = '', col = 0;
  for (const ch of value) {
    const cw = numW(ch, size);
    if (/\d/.test(ch)) {
      const d = Number(ch), spins = 10 + d;
      let stack = '';
      for (let k = 0; k <= spins; k++) stack += text(cx + cw / 2, y + (spins - k) * lh, String(k % 10), { ...NUM, size, fill: t.text, anchor: 'middle' });
      const name = `${id}c${col}`;
      css += `.${name}{animation:${name} 1.8s cubic-bezier(.16,1,.3,1) both;${delay(start + col * 0.09)}}@keyframes ${name}{from{transform:translateY(${n2(-spins * lh)}px)}}`;
      out += `<g class="${name} once">${stack}</g>`;
      col++;
    } else out += text(cx, y, ch, { ...NUM, size, fill: t.text });
    cx += cw;
  }
  return { svg: out + '</g>', css };
}

function activity(t, s) {
  let body = '', css = '';
  const tiles = [
    [s.contributions.toLocaleString('en-US'), 'Contributions · 12 mo'],
    [String(s.publicRepos), 'Public repositories'],
    [String(s.stars), 'Stars earned'],
    [String(new Date(s.since).getUTCFullYear()), 'On GitHub since'],
  ];
  tiles.forEach(([v, k], i) => {
    const x = i * (W / 4);
    const o = odometer(t, x, 52, v, 48, `o${i}`, 0.15 + i * 0.12);
    body += o.svg + `<g class="fade" style="${delay(0.5 + i * 0.1)}">${text(x, 80, k.toUpperCase(), { face: 'mono', size: 10, fill: t.faint, ls: 1.1 })}</g>`;
    css += o.css;
  });
  body += hair(0, 108, W, t.line, { d: 0.3 });

  // contribution graph as a dot matrix, revealed in a diagonal wave
  const weeks = s.calendar, step = 16.4, r0 = 5.2, gx = r0, gy = 158;
  const max = Math.max(1, ...weeks.flat().map((d) => d.c));
  const lvl = (c) => (c === 0 ? 0 : Math.min(4, 1 + Math.floor((c / max) * 3.999)));
  let lastMonth = -1;
  weeks.forEach((wk, wi) => {
    const first = new Date(wk[0].d);
    if (first.getUTCMonth() !== lastMonth && wi < weeks.length - 2) {
      if (lastMonth !== -1 || first.getUTCDate() <= 7) body += text(gx - r0 + wi * step, 140, first.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), { face: 'mono', size: 10, fill: t.faint, cls: 'fade', style: delay(0.4) });
      lastMonth = first.getUTCMonth();
    }
    for (const d of wk) {
      const di = new Date(d.d).getUTCDay();
      body += `<circle cx="${n2(gx + wi * step)}" cy="${n2(gy + di * step)}" r="${r0}" fill="${t.heat[lvl(d.c)]}" class="pop" style="${delay(0.4 + wi * 0.016 + di * 0.03)}"/>`;
    }
  });
  const ly = gy + 6 * step + 34;
  body += `<g class="fade" style="${delay(1.4)}">${text(0, ly, `${s.contributions.toLocaleString('en-US')} contributions in the last year · updated ${shortDate(s.updatedAt)}`, { face: 'mono', size: 10, fill: t.faint })}`;
  const kx = W - r0 - 4 * step - measure(' More', 'mono', 10) - 4;
  body += text(kx - r0 - 8, ly, 'Less', { face: 'mono', size: 10, fill: t.faint, anchor: 'end' });
  t.heat.forEach((c, i) => { body += `<circle cx="${n2(kx + i * step)}" cy="${ly - 3.5}" r="${r0}" fill="${c}"/>`; });
  body += text(kx + 4 * step + r0 + 8, ly, 'More', { face: 'mono', size: 10, fill: t.faint }) + '</g>';
  body += hair(0, ly + 24, W, t.line, { d: 0.6 });

  // languages: segments grow in order
  const by = ly + 52, total = s.languages.reduce((a, l) => a + l.count, 0) || 1, gap = 3;
  const usable = W - gap * (s.languages.length - 1);
  let bx = 0, lx = 0;
  s.languages.forEach((l, i) => {
    const color = LANG_COLORS[l.name] || t.faint;
    const seg = (usable * l.count) / total;
    const pct = `${Math.round((l.count / total) * 100)}%`;
    body += `<rect x="${n2(bx)}" y="${by}" width="${n2(seg)}" height="6" rx="3" fill="${color}" class="draw" style="${delay(0.9 + i * 0.12)};animation-duration:.8s"/>`;
    bx += seg + gap;
    body += `<g class="fade" style="${delay(1.2 + i * 0.08)}"><circle cx="${lx + 4}" cy="${by + 31}" r="4" fill="${color}"/>${text(lx + 14, by + 35, l.name, { face: 'sans', size: 13, fill: t.text })}`;
    const nw = measure(l.name, 'sans', 13);
    body += text(lx + 14 + nw + 6, by + 35, pct, { face: 'mono', size: 12, fill: t.faint }) + '</g>';
    lx += 14 + nw + 6 + measure(pct, 'mono', 12) + 24;
  });
  const H = Math.ceil(by + 48);
  return svg(W, H, body, {
    title: `GitHub activity: ${s.contributions} contributions in the last year, ${s.publicRepos} public repositories, ${s.stars} stars, on GitHub since ${new Date(s.since).getUTCFullYear()}. Languages: ${s.languages.map((l) => `${l.name} ${Math.round((l.count / total) * 100)}%`).join(', ')}.`,
    fonts: ['sans', 'mono'], css,
  });
}

function footer(t, ship) {
  const H = 140;
  const sig = PROFILE.name.join(' ');
  const body = `
${hair(0, 0, W, t.lineHi)}
${text(0, 98, sig, { face: 'serifItalic', size: 58, fill: t.text, ls: -0.5, cls: 'sig once' })}
<g class="fade" style="${delay(1.2)}">
${text(W, 78, 'If the problem is real, the code should be too.', { face: 'sans', size: 16, fill: t.text, anchor: 'end' })}
${text(W, 102, `profile v${ship.version} · last shipped by @${ship.deploys[0].user}`, { face: 'mono', size: 11, fill: t.faint, anchor: 'end' })}
</g>`;
  const css = `.sig{stroke:${t.text};stroke-width:.7;stroke-dasharray:260;animation:sig 3.2s cubic-bezier(.45,0,.2,1) .3s both;}
@keyframes sig{0%{stroke-dashoffset:260;fill-opacity:0}65%{stroke-dashoffset:0;fill-opacity:0}100%{stroke-dashoffset:0;fill-opacity:1}}`;
  return svg(W, H, body, { title: 'If the problem is real, the code should be too.', fonts: ['serifItalic', 'sans', 'mono'], css });
}

// ───────────────────────── build ─────────────────────────
function build() {
  const stats = readJSON('data/stats.json');
  const ship = readJSON('data/ship.json');
  for (const theme of Object.keys(THEMES)) {
    const t = THEMES[theme];
    const dir = p('assets', theme);
    rmSync(dir, { recursive: true, force: true });
    mkdirSync(dir, { recursive: true });
    const out = (name, content) => writeFileSync(join(dir, name), content);
    out('hero.svg', hero(t));
    for (const l of LINKS) out(`link-${l.id}.svg`, linkPill(t, l.label).svg);
    out('title-about.svg', heading(t, '01', 'About'));
    out('about.svg', about(t));
    out('title-work.svg', heading(t, '02', 'Selected work', `${String(PROJECTS.length).padStart(2, '0')} projects`));
    PROJECTS.forEach((pr, i) => out(`work-${pr.id}.svg`, projectRow(t, pr, i, i === PROJECTS.length - 1)));
    out('title-stack.svg', heading(t, '03', 'Toolbox', 'daily drivers'));
    out('stack.svg', marquee(t, theme));
    out('title-ship.svg', heading(t, '04', 'Ship to my profile', 'interactive'));
    out('ship-console.svg', shipConsole(t, ship));
    for (const [k, v] of Object.entries(SHIP_TYPES)) out(`btn-${k}.svg`, button(t, v.label, v.sub, k === 'friday-deploy'));
    out('title-activity.svg', heading(t, '05', 'Activity', 'updated daily'));
    out('activity.svg', activity(t, stats));
    out('footer.svg', footer(t, ship));
  }
  console.log('built assets');
}


// ───────────────────────── stats ─────────────────────────
async function gql(query) {
  const token = process.env.STATS_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!token) throw new Error('Set GITHUB_TOKEN to refresh stats');
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { Authorization: `bearer ${token}`, 'Content-Type': 'application/json', 'User-Agent': OWNER },
    body: JSON.stringify({ query }),
  });
  const json = await res.json();
  if (json.errors) throw new Error(JSON.stringify(json.errors));
  return json.data;
}

async function stats() {
  const { user } = await gql(`{ user(login:"${OWNER}") {
    createdAt
    repositories(ownerAffiliations:OWNER, privacy:PUBLIC, isFork:false, first:100) { totalCount nodes { stargazerCount primaryLanguage { name } } }
    contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { contributionCount date } } } }
  } }`);
  const langs = {};
  for (const n of user.repositories.nodes) if (n.primaryLanguage) langs[n.primaryLanguage.name] = (langs[n.primaryLanguage.name] || 0) + 1;
  const sorted = Object.entries(langs).sort((a, b) => b[1] - a[1]);
  const top = sorted.slice(0, 5).map(([name, count]) => ({ name, count }));
  const other = sorted.slice(5).reduce((a, [, c]) => a + c, 0);
  if (other) top.push({ name: 'Other', count: other });
  const cal = user.contributionsCollection.contributionCalendar;
  writeJSON('data/stats.json', {
    updatedAt: new Date().toISOString(),
    since: user.createdAt,
    publicRepos: user.repositories.totalCount,
    stars: user.repositories.nodes.reduce((a, n) => a + n.stargazerCount, 0),
    contributions: cal.totalContributions,
    languages: top,
    calendar: cal.weeks.map((w) => w.contributionDays.map((d) => ({ d: d.date, c: d.contributionCount }))),
  });
  console.log('stats refreshed');
}

// ───────────────────────── ship ─────────────────────────
function bump(v, kind) {
  const [M, m, pt] = v.split('.').map(Number);
  return kind === 'major' ? `${M + 1}.0.0` : kind === 'minor' ? `${M}.${m + 1}.0` : `${M}.${m}.${pt + 1}`;
}

function bumpCacheKeys(version) {
  // Bust GitHub's image cache for images whose content changes on every ship.
  const f = p('README.md');
  const md = readFileSync(f, 'utf8').replace(/(ship-console|footer)\.svg\?v=[\w.-]+/g, `$1.svg?v=${version}`);
  writeFileSync(f, md);
}

async function ship() {
  const title = (process.env.ISSUE_TITLE || '').trim().toLowerCase();
  const user = process.env.ISSUE_USER || '';
  const reply = (msg, ok) => {
    writeFileSync(process.env.REPLY_FILE || '/tmp/ship-reply.md', msg + '\n');
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `shipped=${ok}\n`);
  };
  const m = title.match(/^ship --([a-z-]+)$/);
  const type = m && SHIP_TYPES[m[1]] ? m[1] : null;
  if (!/^[a-z\d](?:[a-z\d-]{0,38})$/i.test(user)) return reply('Could not read your username.', false);
  if (!type) return reply(`Unknown command \`${esc(title)}\`. Try one of: ${Object.keys(SHIP_TYPES).map((k) => `\`ship --${k}\``).join(', ')}.`, false);

  const s = readJSON('data/ship.json');
  const recent = s.deploys.find((d) => d.user.toLowerCase() === user.toLowerCase());
  if (recent && Date.now() - Date.parse(recent.at) < 5 * 60 * 1000) {
    return reply(`Easy there, @${user}. The pipeline has a 5-minute cooldown per engineer. Try again in a few minutes.`, false);
  }

  const wasIncident = s.incident;
  const version = bump(s.version, SHIP_TYPES[type].bump);
  s.version = version;
  s.total = (s.total || s.deploys.length) + 1;
  if (type === 'friday-deploy') { s.incident = true; s.streak = 0; }
  else if (type === 'hotfix') { s.incident = false; s.streak += 1; }
  else if (!s.incident) s.streak += 1;
  s.deploys.unshift({ version, type, user, at: new Date().toISOString() });
  s.deploys = s.deploys.slice(0, 50);
  const known = new Set(s.knownShippers || []);
  known.add(user.toLowerCase());
  s.knownShippers = [...known];
  s.shippers = known.size;
  try {
    const res = await fetch(`https://avatars.githubusercontent.com/${user}?s=64`);
    if (res.ok) s.lastAvatar = `data:${res.headers.get('content-type') || 'image/png'};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
  } catch { /* avatar is optional */ }
  writeJSON('data/ship.json', s);
  bumpCacheKeys(version);

  const lines = {
    feature: `Shipped **v${version}** to prod. Nice feature, @${user}!`,
    fix: `Patched to **v${version}**. Bug squashed. Thanks, @${user}!`,
    hotfix: wasIncident
      ? `**v${version}** is live and the incident is resolved. You saved prod, @${user}!`
      : `**v${version}** is live. Prod was already healthy, but a hotfix never hurts, @${user}.`,
    'friday-deploy': `You deployed **v${version}** on a Friday, @${user}. Prod is now down. Someone needs to \`ship --hotfix\`.`,
  };
  reply(`${lines[type]}\n\nYour release will appear on [the profile](https://github.com/${OWNER}) within a minute or two. This issue closes automatically.`, true);
}

// ───────────────────────── main ─────────────────────────
const cmd = process.argv[2] || 'build';
if (cmd === 'stats') await stats();
if (cmd === 'ship') await ship();
build();
