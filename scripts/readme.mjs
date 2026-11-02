#!/usr/bin/env node
// Profile README generator.
//
//   node scripts/readme.mjs build   -> render every SVG in assets/{dark,light}
//   node scripts/readme.mjs stats   -> refresh data/stats.json from the GitHub API, then build
//   node scripts/readme.mjs ship    -> process a "ship --<type>" issue (used by the Action), then build
//
// No dependencies. Node 20+.

import { readFileSync, writeFileSync, mkdirSync, existsSync, appendFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = 'pksingh1508';
const p = (...a) => join(ROOT, ...a);
const readJSON = (f, d) => (existsSync(p(f)) ? JSON.parse(readFileSync(p(f), 'utf8')) : d);
const writeJSON = (f, v) => writeFileSync(p(f), JSON.stringify(v, null, 2) + '\n');

// ───────────────────────── design tokens ─────────────────────────
const THEMES = {
  dark: {
    surface: '#0F141B', surface2: '#151B24', border: '#222A35', borderHi: '#2E3846',
    text: '#E6EDF3', muted: '#8B96A3', faint: '#56606D',
    accent: '#2DD4BF', accentSoft: 'rgba(45,212,191,0.12)', accent2: '#A78BFA',
    ok: '#3FB950', okSoft: 'rgba(63,185,80,0.12)', bad: '#F85149', badSoft: 'rgba(248,81,73,0.12)', warn: '#E3B341',
    heat: ['#161C25', '#0F3F3A', '#146B60', '#1C9C8A', '#2DD4BF'],
    glow: 0.18,
  },
  light: {
    surface: '#FFFFFF', surface2: '#F5F7F9', border: '#DDE3E9', borderHi: '#C9D1D9',
    text: '#1F2328', muted: '#5B6570', faint: '#8C959F',
    accent: '#0D9488', accentSoft: 'rgba(13,148,136,0.10)', accent2: '#7C3AED',
    ok: '#1A7F37', okSoft: 'rgba(26,127,55,0.10)', bad: '#CF222E', badSoft: 'rgba(207,34,46,0.10)', warn: '#9A6700',
    heat: ['#EEF1F4', '#BDEBE3', '#73D3C3', '#26A694', '#0D7A6E'],
    glow: 0.10,
  },
};

const W = 880;
const SANS = "'SG','Space Grotesk',-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
const MONO = "'JBM','JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,Consolas,monospace";
const MONO_ADV = 0.6; // JetBrains Mono advance width in em

const font64 = (f) => readFileSync(p('scripts/fonts', f)).toString('base64');
const FONT_CSS = {
  sans: `@font-face{font-family:'SG';src:url(data:font/woff2;base64,${font64('SpaceGrotesk.woff2')}) format('woff2');font-weight:300 700;}`,
  mono: `@font-face{font-family:'JBM';src:url(data:font/woff2;base64,${font64('JetBrainsMono.woff2')}) format('woff2');font-weight:400 700;}`,
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const monoW = (text, size) => text.length * size * MONO_ADV;

function svg(w, h, body, { fonts = ['sans', 'mono'], css = '', title = '' } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>
${fonts.map((f) => FONT_CSS[f]).join('\n')}
.sans{font-family:${SANS};}
.mono{font-family:${MONO};}
${css}
@media (prefers-reduced-motion: reduce){*{animation:none!important;}}
</style>
${body}
</svg>
`;
}

const text = (x, y, s, { size = 14, cls = 'sans', fill, weight = 400, anchor = 'start', ls = 0, extra = '' } = {}) =>
  `<text x="${x}" y="${y}" class="${cls}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls ? ` letter-spacing="${ls}"` : ''} ${extra}>${esc(s)}</text>`;

const panel = (t, x, y, w, h, r = 14, fill = t.surface) =>
  `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="${h - 1}" rx="${r}" fill="${fill}" stroke="${t.border}"/>`;

const chip = (t, x, y, label, { color = t.muted, bg = t.surface2, border = t.border, size = 11 } = {}) => {
  const w = monoW(label, size) + 18;
  return {
    w,
    svg: `<rect x="${x + 0.5}" y="${y + 0.5}" width="${w - 1}" height="23" rx="6" fill="${bg}" stroke="${border}"/>${text(x + 9, y + 16, label, { size, cls: 'mono', fill: color })}`,
  };
};

function chips(t, x, y, labels, opts) {
  let out = '', cx = x;
  for (const l of labels) { const c = chip(t, cx, y, l, opts); out += c.svg; cx += c.w + 6; }
  return out;
}

function wrap(s, maxChars) {
  const lines = []; let line = '';
  for (const word of s.split(' ')) {
    if ((line + ' ' + word).trim().length > maxChars) { lines.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

const dotGrid = (t, id) =>
  `<defs><pattern id="${id}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="${t.border}"/></pattern></defs>`;

// ───────────────────────── content ─────────────────────────
const PROFILE = {
  name: 'Pawan Kumar',
  role: 'Software Development Engineer',
  location: 'Gorakhpur, India · UTC+5:30',
  rotating: ['web platforms', 'mobile apps', 'APIs & integrations', 'cloud infrastructure'],
  loop: ['Problem', 'Product', 'Interface', 'API', 'Data', 'Cloud', 'Observe'],
};

const PROJECTS = [
  { id: 'eu-work-support', icon: 'phone', tag: 'MOBILE APP + WEB', title: 'EU Work Support',
    desc: 'Work and visa guidance for Europe, with PRO access unlocked through a Stripe-powered companion site.',
    stack: ['Expo', 'Clerk', 'Supabase', 'Stripe'] },
  { id: 'eu-crm', icon: 'pipeline', tag: 'INTERNAL PLATFORM', title: 'EU CRM',
    desc: 'Lead pipeline from first contact to won, fed by a key-secured ingestion API and email integrations.',
    stack: ['Next.js', 'Supabase', 'React Query'] },
  { id: 'signflow', icon: 'pen', tag: 'SAAS', title: 'SignFlow',
    desc: 'Upload a PDF, send a time-limited signing link, and collect drawn e-signatures.',
    stack: ['Next.js', 'Supabase', 'pdf-lib'] },
  { id: 'eu-career-serwis', icon: 'globe', tag: 'PRODUCTION WEBSITE', title: 'EU Career Serwis',
    desc: 'Multilingual site for a European employment and visa consultancy, backed by a headless CMS.',
    stack: ['Next.js', 'next-intl', 'Strapi'] },
  { id: 'scanlabel', icon: 'scan', tag: 'MOBILE APP', title: 'ScanLabel',
    desc: 'Point the camera at a food label to get nutrition, ingredients, and allergens explained.',
    stack: ['Expo', 'Camera', 'Zod'] },
  { id: 'desi-run', icon: 'play', tag: '3D GAME', title: 'Desi Run',
    desc: 'Endless runner through Indian streets, written in raw Three.js with no game engine.',
    stack: ['Three.js', 'TypeScript', 'Next.js'] },
];

const STACK = [
  ['LANGUAGES', ['ts', 'js', 'php', 'cpp']],
  ['FRONTEND · MOBILE', ['react', 'nextjs', 'expo', 'tailwind', 'threejs']],
  ['BACKEND · APIS', ['nodejs', 'express', 'laravel', 'strapi', 'stripe', 'twilio']],
  ['DATA', ['postgres', 'supabase', 'mongodb', 'redis']],
  ['CLOUD · DEVOPS', ['aws', 'docker', 'nginx', 'githubactions', 'vercel']],
];

const SHIP_TYPES = {
  feature: { bump: 'minor', label: 'ship --feature', sub: 'minor release' },
  fix: { bump: 'patch', label: 'ship --fix', sub: 'patch release' },
  hotfix: { bump: 'patch', label: 'ship --hotfix', sub: 'restores prod' },
  'friday-deploy': { bump: 'major', label: 'ship --friday-deploy', sub: 'what could go wrong?' },
};

// ───────────────────────── icons ─────────────────────────
function glyph(kind, x, y, c) {
  const s = `stroke="${c}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const g = {
    phone: `<rect x="6" y="2" width="12" height="20" rx="3" ${s}/><path d="M10.5 18.5h3" ${s}/>`,
    pipeline: `<path d="M4 20V13M10 20V8M16 20V11M22 20V4" ${s}/><path d="M2 21.5h22" ${s}/>`,
    pen: `<path d="M3 19c3-1 4-6 6-6s1 5 3 5 3-4 5-4 2 2 4 2" ${s}/><path d="M15 3l5 5-7 7-5 1 1-5z" ${s}/>`,
    globe: `<circle cx="12" cy="12" r="9.5" ${s}/><path d="M2.5 12h19M12 2.5c3 3 3 16 0 19M12 2.5c-3 3-3 16 0 19" ${s}/>`,
    scan: `<path d="M3 8V5a2 2 0 012-2h3M16 3h3a2 2 0 012 2v3M21 16v3a2 2 0 01-2 2h-3M8 21H5a2 2 0 01-2-2v-3" ${s}/><path d="M7 12h10" ${s}/>`,
    play: `<path d="M8 5l11 7-11 7z" ${s}/>`,
  }[kind];
  return `<g transform="translate(${x} ${y})">${g}</g>`;
}

const ICON_CACHE = {};
function stackIcon(name, theme) {
  const key = `${name}-${theme}`;
  if (!ICON_CACHE[key]) ICON_CACHE[key] = readFileSync(p('scripts/icons', `${key}.svg`)).toString('base64');
  return `data:image/svg+xml;base64,${ICON_CACHE[key]}`;
}

// ───────────────────────── renderers ─────────────────────────
function hero(t) {
  const H = 320;
  const cx = 688, cy = 160, r = 92, period = 9;
  const n = PROFILE.loop.length;
  let nodes = '';
  PROFILE.loop.forEach((label, i) => {
    const a = (-90 + (i * 360) / n) * (Math.PI / 180);
    const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a);
    const lx = cx + (r + 16) * Math.cos(a), ly = cy + (r + 16) * Math.sin(a) + 4;
    const anchor = Math.abs(Math.cos(a)) < 0.2 ? 'middle' : Math.cos(a) > 0 ? 'start' : 'end';
    const dy = Math.abs(Math.cos(a)) < 0.2 ? (Math.sin(a) < 0 ? -6 : 10) : 0;
    nodes += `<circle class="node" style="animation-delay:${((i * period) / n).toFixed(2)}s" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="5" fill="${t.surface}" stroke="${t.accent}" stroke-width="1.6"/>`;
    nodes += text(lx.toFixed(1), (ly + dy).toFixed(1), label, { size: 11, cls: 'mono', fill: t.muted, anchor });
  });
  const orbit = `M ${cx} ${cy - r} a ${r} ${r} 0 1 1 0 ${2 * r} a ${r} ${r} 0 1 1 0 ${-2 * r}`;
  const words = PROFILE.rotating.map((w, i) =>
    `<tspan class="rot${i === 0 ? ' r0' : ''}" style="animation-delay:${i * 3}s" x="${40 + monoW('> building ', 15)}" fill="${t.accent}">${esc(w)}<tspan class="caret">▌</tspan></tspan>`).join('');

  const body = `
${dotGrid(t, 'g')}
<defs>
  <radialGradient id="glow" cx="78%" cy="45%" r="45%"><stop offset="0" stop-color="${t.accent}" stop-opacity="${t.glow}"/><stop offset="1" stop-color="${t.accent}" stop-opacity="0"/></radialGradient>
  <linearGradient id="edge" x1="0" x2="1"><stop offset="0" stop-color="${t.accent}" stop-opacity="0"/><stop offset=".5" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}" stop-opacity="0"/></linearGradient>
  <clipPath id="clip"><rect width="${W}" height="${H}" rx="18"/></clipPath>
</defs>
<g clip-path="url(#clip)">
  <rect width="${W}" height="${H}" fill="${t.surface}"/>
  <rect width="${W}" height="${H}" fill="url(#g)" opacity=".7"/>
  <rect width="${W}" height="${H}" fill="url(#glow)"/>
  <rect x="0" y="0" width="${W}" height="2" fill="url(#edge)"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="18" stroke="${t.border}"/>

${text(40, 62, '~/' + OWNER, { size: 13, cls: 'mono', fill: t.faint })}
${text(40, 132, PROFILE.name, { size: 60, weight: 700, fill: t.text, ls: -1.5 })}
${text(42, 170, PROFILE.role, { size: 21, weight: 500, fill: t.muted })}
<text x="40" y="212" class="mono" font-size="15" fill="${t.faint}">&gt; building ${words}</text>

<g transform="translate(40 244)">
  <rect x=".5" y=".5" width="${monoW('open to new opportunities', 12) + 38}" height="29" rx="14.5" fill="${t.okSoft}" stroke="${t.ok}" stroke-opacity=".45"/>
  <circle class="ping" cx="16" cy="15" r="4" fill="${t.ok}"/><circle cx="16" cy="15" r="4" fill="${t.ok}"/>
  ${text(28, 19.5, 'open to new opportunities', { size: 12, cls: 'mono', fill: t.ok })}
</g>
${text(40 + monoW('open to new opportunities', 12) + 54, 263.5, PROFILE.location, { size: 12, cls: 'mono', fill: t.faint })}

<line x1="540" y1="48" x2="540" y2="${H - 48}" stroke="${t.border}" stroke-dasharray="2 5"/>
<path d="${orbit}" stroke="${t.borderHi}" stroke-dasharray="3 6"/>
<path class="sweep" d="${orbit}" stroke="${t.accent}" stroke-width="2" stroke-linecap="round" pathLength="100" stroke-dasharray="14 86"/>
${nodes}
<circle r="5" fill="${t.accent}"><animateMotion dur="${period}s" repeatCount="indefinite" path="${orbit}"/></circle>
${text(cx, cy - 4, 'ship · measure', { size: 12, cls: 'mono', fill: t.text, anchor: 'middle' })}
${text(cx, cy + 14, 'learn · improve', { size: 12, cls: 'mono', fill: t.muted, anchor: 'middle' })}
`;
  const css = `
.rot{opacity:0;animation:rot 12s infinite;}
@media (prefers-reduced-motion: reduce){.r0{opacity:1;}}
@keyframes rot{0%{opacity:0}3%{opacity:1}22%{opacity:1}25%{opacity:0}100%{opacity:0}}
.caret{animation:blink 1.1s steps(1) infinite;}
@keyframes blink{50%{opacity:0}}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2s cubic-bezier(0,0,.2,1) infinite;}
@keyframes ping{0%{transform:scale(1);opacity:.8}80%,100%{transform:scale(2.6);opacity:0}}
.node{animation:node ${period}s linear infinite;}
@keyframes node{0%{fill:${t.accent}}12%{fill:${t.surface}}100%{fill:${t.surface}}}
.sweep{animation:sweep ${period}s linear infinite;}
@keyframes sweep{from{stroke-dashoffset:14}to{stroke-dashoffset:-86}}`;
  return svg(W, H, body, { css, title: `${PROFILE.name}, ${PROFILE.role}` });
}

function about(t) {
  const H = 150;
  const tiles = [
    ['NOW', 'Production systems and', 'call-operations tooling'],
    ['FOCUS', 'Next.js · React Native', 'Supabase · Node.js'],
    ['EXPLORING', 'DevOps · distributed', 'systems · AI workflows'],
  ];
  const tw = (W - 32) / 3;
  const body = `
${text(0, 30, 'I turn messy operational problems into calm, dependable software:', { size: 21, weight: 500, fill: t.text, ls: -0.3 })}
${text(0, 58, 'web, mobile, APIs, and the cloud underneath, shipped end to end.', { size: 21, weight: 500, fill: t.muted, ls: -0.3 })}
${tiles.map(([k, a, b], i) => {
    const x = i * (tw + 16);
    return `${panel(t, x, 78, tw, 70, 12)}
<rect x="${x + 16}" y="94" width="3" height="38" rx="1.5" fill="${i === 0 ? t.accent : i === 1 ? t.accent2 : t.faint}"/>
${text(x + 30, 100, k, { size: 10, cls: 'mono', fill: t.faint, ls: 1.2 })}
${text(x + 30, 118, a, { size: 14, fill: t.text })}
${text(x + 30, 136, b, { size: 14, fill: t.muted })}`;
  }).join('')}`;
  return svg(W, H, body, { title: 'About Pawan Kumar' });
}

function title(t, num, label, right = '') {
  const H = 64;
  const lw = label.length * 14.2;
  const body = `
${text(0, 40, num, { size: 13, cls: 'mono', fill: t.accent })}
${text(36, 41, label, { size: 26, weight: 600, fill: t.text, ls: -0.5 })}
<line x1="${36 + lw + 18}" y1="36" x2="${W - (right ? monoW(right, 12) + 18 : 0)}" y2="36" stroke="${t.border}"/>
${right ? text(W, 40, right, { size: 12, cls: 'mono', fill: t.faint, anchor: 'end' }) : ''}`;
  return svg(W, H, body, { title: label });
}

function card(t, pr) {
  const w = 430, h = 236;
  const lines = wrap(pr.desc, 46);
  const body = `
<defs><linearGradient id="top" x1="0" x2="1"><stop offset="0" stop-color="${t.accent}"/><stop offset="1" stop-color="${t.accent2}" stop-opacity="0"/></linearGradient>
<clipPath id="c"><rect width="${w}" height="${h}" rx="16"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="${w}" height="${h}" fill="${t.surface}"/><rect width="${w}" height="2" fill="url(#top)" opacity=".9"/></g>
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="16" stroke="${t.border}"/>
<rect x="24" y="24" width="44" height="44" rx="11" fill="${t.accentSoft}"/>
${glyph(pr.icon, 34, 34, t.accent)}
${text(w - 24, 44, '↗', { size: 18, fill: t.faint, anchor: 'end' })}
${text(84, 42, pr.tag, { size: 10, cls: 'mono', fill: t.faint, ls: 1.2 })}
${text(84, 64, pr.title, { size: 22, weight: 600, fill: t.text, ls: -0.4 })}
${lines.map((l, i) => text(24, 108 + i * 22, l, { size: 15, fill: t.muted })).join('')}
${chips(t, 24, h - 47, pr.stack)}`;
  return svg(w, h, body, { title: `${pr.title}: ${pr.desc}` });
}

function stack(t, theme) {
  const rowH = 64, H = STACK.length * rowH + 16;
  let body = panel(t, 0, 0, W, H, 16);
  STACK.forEach(([label, icons], r) => {
    const y = 8 + r * rowH;
    if (r) body += `<line x1="24" y1="${y}" x2="${W - 24}" y2="${y}" stroke="${t.border}" stroke-dasharray="2 4"/>`;
    body += text(28, y + rowH / 2 + 4, label, { size: 11, cls: 'mono', fill: t.faint, ls: 1.2 });
    icons.forEach((ic, i) => {
      body += `<image class="pop" style="animation-delay:${(r * 0.12 + i * 0.05).toFixed(2)}s" href="${stackIcon(ic, theme)}" x="${232 + i * 56}" y="${y + 12}" width="40" height="40"/>`;
    });
  });
  const css = `.pop{animation:pop .5s ease-out backwards;}@keyframes pop{from{opacity:0}}`;
  return svg(W, H, body, { fonts: ['mono'], css, title: 'Tech stack' });
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
const shortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: '2-digit', timeZone: 'UTC' }).toLowerCase();

function shipConsole(t, ship) {
  const H = 330;
  const last = ship.deploys[0];
  const incident = ship.incident;
  const stColor = incident ? t.bad : t.ok;
  const stLabel = incident ? 'prod: INCIDENT' : 'prod: operational';
  const stages = ['build', 'test', 'review', 'deploy'];
  const px = 470, pw = 360;
  const avatar = ship.lastAvatar
    ? `<clipPath id="av"><circle cx="54" cy="194" r="14"/></clipPath><image href="${ship.lastAvatar}" x="40" y="180" width="28" height="28" clip-path="url(#av)"/><circle cx="54" cy="194" r="14.5" stroke="${t.border}"/>`
    : `<circle cx="54" cy="194" r="14" fill="${t.surface2}" stroke="${t.border}"/>`;

  let pipe = `<line x1="${px}" y1="120" x2="${px + pw}" y2="120" stroke="${t.border}" stroke-width="2"/>
<line class="flow" x1="${px}" y1="120" x2="${px + pw}" y2="120" stroke="${incident ? t.bad : t.accent}" stroke-width="2" pathLength="100" stroke-dasharray="100" stroke-dashoffset="0"/>`;
  stages.forEach((s, i) => {
    const x = px + (i * pw) / (stages.length - 1);
    const failed = incident && i === stages.length - 1;
    pipe += `<circle cx="${x}" cy="120" r="13" fill="${t.surface}" stroke="${t.borderHi}" stroke-width="1.5"/>
<g class="st" style="animation-delay:${(0.5 + i * 0.9).toFixed(1)}s"><circle cx="${x}" cy="120" r="13" fill="${failed ? t.bad : t.accent}"/>
${failed ? `<path d="M${x - 4} ${116}l8 8M${x + 4} ${116}l-8 8" stroke="${t.surface}" stroke-width="2" stroke-linecap="round"/>`
        : `<path d="M${x - 5} 120.5l3.5 3.5 6.5-7" stroke="${t.surface}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`}</g>
${text(x, 152, s, { size: 11, cls: 'mono', fill: t.muted, anchor: 'middle' })}`;
  });

  const rows = ship.deploys.slice(0, 4).map((d, i) => {
    const y = 214 + i * 24;
    const typeColor = d.type === 'friday-deploy' ? t.bad : d.type === 'hotfix' ? t.warn : d.type === 'feature' ? t.accent : t.muted;
    return `${text(px, y, 'v' + d.version, { size: 12, cls: 'mono', fill: i === 0 ? t.text : t.muted })}
${text(px + 92, y, d.type, { size: 12, cls: 'mono', fill: typeColor })}
${text(px + 214, y, '@' + (d.user.length > 15 ? d.user.slice(0, 14) + '…' : d.user), { size: 12, cls: 'mono', fill: t.muted })}
${text(px + pw, y, shortDate(d.at), { size: 12, cls: 'mono', fill: t.faint, anchor: 'end' })}`;
  }).join('');

  const statBox = (x, label, value) => `${text(x, 286, value, { size: 22, weight: 600, fill: t.text })}${text(x, 304, label, { size: 10, cls: 'mono', fill: t.faint, ls: 1 })}`;

  const body = `
<defs><clipPath id="win"><rect width="${W}" height="${H}" rx="16"/></clipPath></defs>
<g clip-path="url(#win)">
  <rect width="${W}" height="${H}" fill="${t.surface}"/>
  <rect width="${W}" height="44" fill="${t.surface2}"/>
  <line x1="0" y1="44" x2="${W}" y2="44" stroke="${t.border}"/>
</g>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="16" stroke="${incident ? t.bad : t.border}" ${incident ? 'stroke-opacity=".6"' : ''}/>
<circle cx="24" cy="22" r="5" fill="${t.borderHi}"/><circle cx="42" cy="22" r="5" fill="${t.borderHi}"/><circle cx="60" cy="22" r="5" fill="${t.borderHi}"/>
${text(82, 26.5, 'release-console — ' + OWNER + '/' + OWNER, { size: 12, cls: 'mono', fill: t.muted })}
<g transform="translate(${W - 24 - (monoW(stLabel, 11) + 34)} 10)">
  <rect width="${monoW(stLabel, 11) + 34}" height="24" rx="12" fill="${incident ? t.badSoft : t.okSoft}"/>
  <circle class="${incident ? 'blinkfast' : 'ping'}" cx="14" cy="12" r="4" fill="${stColor}"/><circle cx="14" cy="12" r="4" fill="${stColor}"/>
  ${text(25, 16, stLabel, { size: 11, cls: 'mono', fill: stColor })}
</g>

${text(40, 86, 'CURRENT RELEASE', { size: 10, cls: 'mono', fill: t.faint, ls: 1.4 })}
${text(36, 150, 'v' + ship.version, { size: 62, weight: 700, fill: incident ? t.bad : t.accent, ls: -2 })}
${avatar}
${text(78, 190, 'shipped by @' + last.user, { size: 14, fill: t.text })}
${text(78, 207, `${last.type} · ${fmtDate(last.at)}`, { size: 11, cls: 'mono', fill: t.faint })}
${incident
    ? text(40, 246, 'someone deployed on a friday. prod needs a hotfix.', { size: 12, cls: 'mono', fill: t.bad })
    : text(40, 246, 'all systems green. ship something?', { size: 12, cls: 'mono', fill: t.muted })}
<line x1="40" y1="262" x2="400" y2="262" stroke="${t.border}"/>
${statBox(40, 'DEPLOYS', String(ship.total))}
${statBox(160, 'SHIPPERS', String(ship.shippers))}
${statBox(280, 'GREEN STREAK', String(ship.streak))}

<line x1="430" y1="68" x2="430" y2="${H - 24}" stroke="${t.border}" stroke-dasharray="2 5"/>
${text(px, 86, 'PIPELINE', { size: 10, cls: 'mono', fill: t.faint, ls: 1.4 })}
${pipe}
${text(px, 190, 'RECENT DEPLOYS', { size: 10, cls: 'mono', fill: t.faint, ls: 1.4 })}
${rows}`;
  const css = `
.flow{animation:flow 6s ease-in-out infinite;}
@keyframes flow{0%{stroke-dashoffset:100}55%,90%{stroke-dashoffset:0}100%{stroke-dashoffset:0;opacity:0}}
.st{animation:st 6s ease-out infinite backwards;}
@keyframes st{0%{opacity:0}6%,90%{opacity:1}100%{opacity:0}}
.ping{transform-box:fill-box;transform-origin:center;animation:ping 2s cubic-bezier(0,0,.2,1) infinite;}
@keyframes ping{0%{transform:scale(1);opacity:.8}80%,100%{transform:scale(2.6);opacity:0}}
.blinkfast{animation:bf .8s steps(1) infinite;}@keyframes bf{50%{opacity:0}}`;
  return svg(W, H, body, { css, title: `Release console: v${ship.version}, last shipped by @${last.user}` });
}

function button(t, label, sub, { danger = false, w = 211, prefix = '$' } = {}) {
  const h = 56;
  const c = danger ? t.bad : t.accent;
  const body = `
<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="12" fill="${t.surface}" stroke="${danger ? t.bad : t.border}" ${danger ? 'stroke-opacity=".55"' : ''}/>
${text(18, 26, prefix, { size: 13, cls: 'mono', fill: c })}
${text(18 + monoW(prefix + ' ', 13), 26, label, { size: 13, cls: 'mono', fill: t.text })}
${text(18, 44, sub, { size: 11, cls: 'mono', fill: t.faint })}`;
  return svg(w, h, body, { fonts: ['mono'], title: label });
}

function activity(t, s) {
  const tiles = [
    [s.contributions.toLocaleString('en-US'), 'CONTRIBUTIONS · 12 MO'],
    [String(s.publicRepos), 'PUBLIC REPOSITORIES'],
    [String(s.stars), 'STARS EARNED'],
    [String(new Date(s.since).getUTCFullYear()), 'BUILDING ON GITHUB SINCE'],
  ];
  const tw = (W - 48) / 4;
  let body = tiles.map(([v, k], i) => {
    const x = i * (tw + 16);
    return `${panel(t, x, 0, tw, 92, 14)}${text(x + 20, 50, v, { size: 30, weight: 600, fill: t.text, ls: -0.8 })}${text(x + 20, 72, k, { size: 10, cls: 'mono', fill: t.faint, ls: 1 })}`;
  }).join('');

  // heatmap
  const hy = 108, cell = 11, gap = 3, step = cell + gap;
  const weeks = s.calendar;
  const gw = weeks.length * step - gap;
  const hx = Math.round((W - gw) / 2);
  const max = Math.max(1, ...weeks.flat().map((d) => d.c));
  const lvl = (c) => (c === 0 ? 0 : Math.min(4, 1 + Math.floor((c / max) * 3.999)));
  body += panel(t, 0, hy, W, 178, 14);
  body += text(24, hy + 30, 'CONTRIBUTION GRAPH', { size: 10, cls: 'mono', fill: t.faint, ls: 1.2 });
  body += text(W - 24, hy + 30, `${s.contributions.toLocaleString('en-US')} in the last year`, { size: 11, cls: 'mono', fill: t.muted, anchor: 'end' });
  let lastMonth = -1;
  weeks.forEach((wk, wi) => {
    const m = new Date(wk[0].d).getUTCMonth();
    if (m !== lastMonth && wi < weeks.length - 2) {
      if (lastMonth !== -1 || new Date(wk[0].d).getUTCDate() <= 7) body += text(hx + wi * step, hy + 56, new Date(wk[0].d).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }).toLowerCase(), { size: 10, cls: 'mono', fill: t.faint });
      lastMonth = m;
    }
    wk.forEach((d) => {
      const di = new Date(d.d).getUTCDay();
      body += `<rect class="c" style="animation-delay:${(wi * 0.018).toFixed(3)}s" x="${hx + wi * step}" y="${hy + 66 + di * step}" width="${cell}" height="${cell}" rx="2.5" fill="${t.heat[lvl(d.c)]}"/>`;
    });
  });
  // languages bar
  const ly = hy + 194;
  const total = s.languages.reduce((a, l) => a + l.count, 0) || 1;
  const palette = [t.accent, t.accent2, t.warn, '#F78166', t.faint, t.borderHi];
  body += panel(t, 0, ly, W, 84, 14);
  body += text(24, ly + 28, 'LANGUAGES BY REPOSITORY', { size: 10, cls: 'mono', fill: t.faint, ls: 1.2 });
  body += `<clipPath id="bar"><rect x="24" y="${ly + 40}" width="${W - 48}" height="8" rx="4"/></clipPath><g clip-path="url(#bar)">`;
  let bx = 24, legend = '', lx = 24;
  s.languages.forEach((l, i) => {
    const bw = ((W - 48) * l.count) / total;
    body += `<rect x="${bx.toFixed(1)}" y="${ly + 40}" width="${(bw + 0.5).toFixed(1)}" height="8" fill="${palette[i % palette.length]}"/>`;
    bx += bw;
    const lab = `${l.name} ${Math.round((l.count / total) * 100)}%`;
    legend += `<circle cx="${lx + 4}" cy="${ly + 66}" r="4" fill="${palette[i % palette.length]}"/>${text(lx + 14, ly + 70, lab, { size: 11, cls: 'mono', fill: t.muted })}`;
    lx += monoW(lab, 11) + 34;
  });
  body += '</g>' + legend;
  const H = ly + 84;
  const css = `.c{animation:in .4s ease-out backwards;}@keyframes in{from{opacity:0}}`;
  return svg(W, H, body, { css, title: `GitHub activity: ${s.contributions} contributions in the last year` });
}

function footer(t, ship) {
  const H = 120;
  const body = `
<line x1="0" y1="1" x2="${W}" y2="1" stroke="${t.border}"/>
${text(W / 2, 58, 'If the problem is real, the code should be too.', { size: 24, weight: 500, fill: t.text, anchor: 'middle', ls: -0.4 })}
${text(W / 2, 90, `Pawan Kumar · Gorakhpur, India · profile v${ship.version}, last shipped by @${ship.deploys[0].user}`, { size: 11, cls: 'mono', fill: t.faint, anchor: 'middle' })}`;
  return svg(W, H, body, { title: 'If the problem is real, the code should be too.' });
}

// ───────────────────────── build ─────────────────────────
function build() {
  const stats = readJSON('data/stats.json');
  const ship = readJSON('data/ship.json');
  for (const theme of Object.keys(THEMES)) {
    const t = THEMES[theme];
    const dir = p('assets', theme);
    mkdirSync(dir, { recursive: true });
    const out = (name, content) => writeFileSync(join(dir, name), content);
    out('hero.svg', hero(t));
    out('about.svg', about(t));
    out('title-work.svg', title(t, '01', 'Selected work', `${PROJECTS.length} projects`));
    out('title-stack.svg', title(t, '02', 'Toolbox', 'daily drivers'));
    out('title-ship.svg', title(t, '03', 'Ship to my profile', 'interactive'));
    out('title-activity.svg', title(t, '04', 'Activity', `updated ${shortDate(stats.updatedAt)}`));
    PROJECTS.forEach((pr) => out(`card-${pr.id}.svg`, card(t, pr)));
    out('stack.svg', stack(t, theme));
    out('ship-console.svg', shipConsole(t, ship));
    for (const [k, v] of Object.entries(SHIP_TYPES)) out(`btn-${k}.svg`, button(t, v.label, v.sub, { danger: k === 'friday-deploy' }));
    out('link-linkedin.svg', button(t, 'linkedin', 'let’s connect', { prefix: '↗', w: 211 }));
    out('link-github.svg', button(t, 'github', 'all repositories', { prefix: '↗', w: 211 }));
    out('link-instagram.svg', button(t, 'instagram', 'behind the code', { prefix: '↗', w: 211 }));
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
