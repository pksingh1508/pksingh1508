#!/usr/bin/env node
// Profile README generator.
//
//   node scripts/readme.mjs build   -> render every SVG in assets/{dark,light}
//   node scripts/readme.mjs stats   -> refresh data/stats.json from the GitHub API, then build
//   node scripts/readme.mjs ship    -> process a "ship --<type>" issue (used by the Action), then build
//
// The prose (intro, headings, links) lives in README.md. This script only draws the images.
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
// GitHub's own colours, so the images sit on the page like native UI.
// Backgrounds stay transparent: the page shows through in every GitHub theme.
const THEMES = {
  dark: {
    bg: '#0d1117', text: '#f0f6fc', muted: '#9198a1', border: '#3d444d', neutral: '#656c76',
    accent: '#4493f8', ok: '#3fb950', bad: '#f85149', warn: '#d29922',
    heat: ['#151b23', '#033a16', '#196c2e', '#2ea043', '#56d364'],
  },
  light: {
    bg: '#ffffff', text: '#1f2328', muted: '#59636e', border: '#d1d9e0', neutral: '#afb8c1',
    accent: '#0969da', ok: '#1a7f37', bad: '#d1242f', warn: '#9a6700',
    heat: ['#eff2f5', '#aceebb', '#4ac26b', '#2da44e', '#116329'],
  },
};

// The colours GitHub itself uses for each language.
const LANG_COLORS = {
  TypeScript: '#3178c6', JavaScript: '#f1e05a', HTML: '#e34c26', CSS: '#663399', PHP: '#4F5D95', Java: '#b07219',
  Python: '#3572A5', 'C++': '#f34b7d', C: '#555555', Dart: '#00B4AB', Kotlin: '#A97BFF', Go: '#00ADD8', Shell: '#89e051',
};

const W = 880;
const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans',Helvetica,Arial,sans-serif";
const MONO = "ui-monospace,SFMono-Regular,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function svg(w, h, body, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" fill="none" role="img" aria-label="${esc(title)}">
<title>${esc(title)}</title>
<style>text{font-family:${SANS};}.mono{font-family:${MONO};}</style>
${body}
</svg>
`;
}

const text = (x, y, s, { size = 14, fill, weight = 400, anchor = 'start', mono = false } = {}) =>
  `<text x="${x}" y="${y}"${mono ? ' class="mono"' : ''} font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}">${esc(s)}</text>`;

const frame = (t, w, h, stroke = t.border) =>
  `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="8" stroke="${stroke}"/>`;

const hline = (t, x1, x2, y) => `<line x1="${x1}" y1="${y + 0.5}" x2="${x2}" y2="${y + 0.5}" stroke="${t.border}"/>`;
const vline = (t, x, y1, y2) => `<line x1="${x + 0.5}" y1="${y1}" x2="${x + 0.5}" y2="${y2}" stroke="${t.border}"/>`;

// Rough width of sans text. System fonts differ per OS, so this errs on the wide side.
const textW = (s, size) => [...s].reduce((w, c) => w + (/[A-Z0-9]/.test(c) ? 0.68 : /[ .,·\-+]/.test(c) ? 0.32 : 0.56), 0) * size;

function wrap(s, maxChars) {
  const lines = []; let line = '';
  for (const word of s.split(' ')) {
    if ((line + ' ' + word).trim().length > maxChars) { lines.push(line); line = word; } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  return lines;
}

// ───────────────────────── content ─────────────────────────
const PROJECTS = [
  { id: 'eu-work-support', tag: 'Mobile app + web', title: 'EU Work Support',
    desc: 'Work and visa guidance for Europe, with PRO access unlocked through a Stripe-powered companion site.',
    stack: ['Expo', 'Clerk', 'Supabase', 'Stripe'] },
  { id: 'eu-crm', tag: 'Internal platform', title: 'EU CRM',
    desc: 'Lead pipeline from first contact to won, fed by a key-secured ingestion API and email integrations.',
    stack: ['Next.js', 'Supabase', 'React Query'] },
  { id: 'signflow', tag: 'SaaS', title: 'SignFlow',
    desc: 'Upload a PDF, send a time-limited signing link, and collect drawn e-signatures.',
    stack: ['Next.js', 'Supabase', 'pdf-lib'] },
  { id: 'eu-career-serwis', tag: 'Production website', title: 'EU Career Serwis',
    desc: 'Multilingual site for a European employment and visa consultancy, backed by a headless CMS.',
    stack: ['Next.js', 'next-intl', 'Strapi'] },
  { id: 'scanlabel', tag: 'Mobile app', title: 'ScanLabel',
    desc: 'Point the camera at a food label to get nutrition, ingredients, and allergens explained.',
    stack: ['Expo', 'Camera', 'Zod'] },
  { id: 'desi-run', tag: '3D game', title: 'Desi Run',
    desc: 'Endless runner through Indian streets, written in raw Three.js with no game engine.',
    stack: ['Three.js', 'TypeScript', 'Next.js'] },
];

// [row label, [[icon file, display name], ...]]
const STACK = [
  ['Languages', [['ts', 'TypeScript'], ['js', 'JavaScript'], ['php', 'PHP'], ['cpp', 'C++']]],
  ['Frontend & mobile', [['react', 'React'], ['nextjs', 'Next.js'], ['expo', 'Expo'], ['tailwind', 'Tailwind'], ['threejs', 'Three.js']]],
  ['Backend & APIs', [['nodejs', 'Node.js'], ['express', 'Express'], ['laravel', 'Laravel'], ['strapi', 'Strapi'], ['stripe', 'Stripe'], ['twilio', 'Twilio']]],
  ['Data', [['postgres', 'PostgreSQL'], ['supabase', 'Supabase'], ['mongodb', 'MongoDB'], ['redis', 'Redis']]],
  ['Cloud & DevOps', [['aws', 'AWS'], ['docker', 'Docker'], ['nginx', 'Nginx'], ['githubactions', 'GitHub Actions'], ['vercel', 'Vercel']]],
];

const SHIP_TYPES = {
  feature: { bump: 'minor', label: 'ship --feature', sub: 'Minor release' },
  fix: { bump: 'patch', label: 'ship --fix', sub: 'Patch release' },
  hotfix: { bump: 'patch', label: 'ship --hotfix', sub: 'Restores prod' },
  'friday-deploy': { bump: 'major', label: 'ship --friday-deploy', sub: 'What could go wrong?' },
};

const ICON_CACHE = {};
function stackIcon(name, theme) {
  const key = `${name}-${theme}`;
  if (!ICON_CACHE[key]) ICON_CACHE[key] = readFileSync(p('scripts/icons', `${key}.svg`)).toString('base64');
  return `data:image/svg+xml;base64,${ICON_CACHE[key]}`;
}

// ───────────────────────── renderers ─────────────────────────
function card(t, pr) {
  const w = 430, h = 176;
  const body = `
${frame(t, w, h)}
${text(24, 43, pr.title, { size: 18, weight: 600, fill: t.accent })}
${text(w - 24, 42, pr.tag, { size: 12, fill: t.muted, anchor: 'end' })}
${wrap(pr.desc, 48).map((l, i) => text(24, 76 + i * 21, l, { size: 14, fill: t.text })).join('')}
${text(24, h - 24, pr.stack.join('  ·  '), { size: 12, fill: t.muted })}`;
  return svg(w, h, body, `${pr.title}: ${pr.desc}`);
}

function stack(t, theme) {
  const rowH = 48, H = STACK.length * rowH;
  let body = frame(t, W, H);
  STACK.forEach(([label, items], r) => {
    const y = r * rowH;
    if (r) body += hline(t, 0, W, y);
    body += text(24, y + 29, label, { size: 13, fill: t.muted });
    let x = 200;
    for (const [icon, name] of items) {
      body += `<image href="${stackIcon(icon, theme)}" x="${x}" y="${y + 13}" width="22" height="22"/>`;
      body += text(x + 30, y + 29, name, { size: 13, fill: t.text });
      x += 30 + Math.round(textW(name, 13)) + 20;
    }
  });
  return svg(W, H, body, 'Tech stack: ' + STACK.map(([l, items]) => `${l}: ${items.map((i) => i[1]).join(', ')}`).join('. '));
}

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
const shortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

function shipConsole(t, ship) {
  const H = 236;
  const last = ship.deploys[0];
  const incident = ship.incident;
  const stColor = incident ? t.bad : t.ok;
  const px = 456, pw = 400;
  const avatar = ship.lastAvatar
    ? `<clipPath id="av"><circle cx="38" cy="124" r="14"/></clipPath><image href="${ship.lastAvatar}" x="24" y="110" width="28" height="28" clip-path="url(#av)"/>`
    : `<circle cx="38" cy="124" r="13.5" stroke="${t.border}"/>`;

  const stages = ['Build', 'Test', 'Review', 'Deploy'];
  let pipe = `<line x1="${px + 10}" y1="76" x2="${px + pw - 10}" y2="76" stroke="${t.border}" stroke-width="2"/>`;
  stages.forEach((s, i) => {
    const x = px + 10 + (i * (pw - 20)) / (stages.length - 1);
    const failed = incident && i === stages.length - 1;
    const mark = failed
      ? `<path d="M${x - 3.5} 72.5l7 7M${x + 3.5} 72.5l-7 7" stroke="${t.bg}" stroke-width="2" stroke-linecap="round"/>`
      : `<path d="M${x - 4.5} 76.5l3 3 6-6.5" stroke="${t.bg}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    pipe += `<circle cx="${x}" cy="76" r="10" fill="${failed ? t.bad : t.ok}"/>${mark}`;
    pipe += text(i === 0 ? px : i === stages.length - 1 ? px + pw : x, 106, s, { size: 12, fill: t.muted, anchor: i === 0 ? 'start' : i === stages.length - 1 ? 'end' : 'middle' });
  });

  const rows = ship.deploys.slice(0, 3).map((d, i) => {
    const y = 172 + i * 22;
    const typeColor = d.type === 'friday-deploy' ? t.bad : d.type === 'hotfix' ? t.warn : t.muted;
    return `${text(px, y, 'v' + d.version, { size: 13, fill: i === 0 ? t.text : t.muted, weight: i === 0 ? 600 : 400 })}
${text(px + 84, y, d.type, { size: 13, fill: typeColor })}
${text(px + 196, y, '@' + (d.user.length > 16 ? d.user.slice(0, 15) + '…' : d.user), { size: 13, fill: t.muted })}
${text(px + pw, y, shortDate(d.at), { size: 13, fill: t.muted, anchor: 'end' })}`;
  }).join('');

  const stat = (x, value, label) => `${text(x, 196, value, { size: 18, weight: 600, fill: t.text })}${text(x, 214, label, { size: 12, fill: t.muted })}`;

  const body = `
${frame(t, W, H, incident ? t.bad : t.border)}
${text(24, 40, 'Current release', { size: 12, fill: t.muted })}
${text(23, 88, 'v' + ship.version, { size: 40, weight: 600, fill: incident ? t.bad : t.text })}
${avatar}
${text(62, 121, 'Shipped by @' + last.user, { size: 14, fill: t.text })}
${text(62, 138, `${last.type} · ${fmtDate(last.at)}`, { size: 12, fill: t.muted })}
${hline(t, 24, 404, 162)}
${stat(24, String(ship.total), 'Deploys')}
${stat(152, String(ship.shippers), 'Shippers')}
${stat(280, String(ship.streak), 'Green streak')}
${vline(t, 428, 24, H - 24)}
${text(px, 40, 'Pipeline', { size: 12, fill: t.muted })}
${text(px + pw, 40, incident ? '● Prod is down, needs a hotfix' : '● Prod is operational', { size: 12, weight: 500, fill: stColor, anchor: 'end' })}
${pipe}
${text(px, 146, 'Recent deploys', { size: 12, fill: t.muted })}
${rows}`;
  return svg(W, H, body, `Release console: v${ship.version}, last shipped by @${last.user}. ${incident ? 'Prod is down.' : 'Prod is operational.'}`);
}

function button(t, label, sub, danger = false) {
  const w = 211, h = 56;
  const body = `
${frame(t, w, h, danger ? t.bad : t.border)}
${text(16, 25, label, { size: 13, mono: true, weight: 600, fill: danger ? t.bad : t.text })}
${text(16, 42, sub, { size: 12, fill: t.muted })}`;
  return svg(w, h, body, `${label}: ${sub}`);
}

function activity(t, s) {
  const H = 330;
  let body = frame(t, W, H);

  // headline numbers
  const tiles = [
    [s.contributions.toLocaleString('en-US'), 'Contributions, last 12 months'],
    [String(s.publicRepos), 'Public repositories'],
    [String(s.stars), 'Stars earned'],
    [String(new Date(s.since).getUTCFullYear()), 'On GitHub since'],
  ];
  tiles.forEach(([v, k], i) => {
    const x = i * (W / 4);
    if (i) body += vline(t, x, 20, 68);
    body += text(x + 24, 42, v, { size: 24, weight: 600, fill: t.text }) + text(x + 24, 63, k, { size: 12, fill: t.muted });
  });
  body += hline(t, 0, W, 88);

  // contribution graph, in GitHub's greens
  const hy = 88, cell = 11, step = 14;
  const weeks = s.calendar;
  const hx = Math.round((W - (weeks.length * step - 3)) / 2);
  const max = Math.max(1, ...weeks.flat().map((d) => d.c));
  const lvl = (c) => (c === 0 ? 0 : Math.min(4, 1 + Math.floor((c / max) * 3.999)));
  let lastMonth = -1;
  weeks.forEach((wk, wi) => {
    const first = new Date(wk[0].d);
    const m = first.getUTCMonth();
    if (m !== lastMonth && wi < weeks.length - 2) {
      if (lastMonth !== -1 || first.getUTCDate() <= 7) body += text(hx + wi * step, hy + 28, first.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), { size: 11, fill: t.muted });
      lastMonth = m;
    }
    wk.forEach((d) => {
      body += `<rect x="${hx + wi * step}" y="${hy + 38 + new Date(d.d).getUTCDay() * step}" width="${cell}" height="${cell}" rx="2" fill="${t.heat[lvl(d.c)]}"/>`;
    });
  });
  const ky = hy + 146;
  body += text(hx, ky + 10, `Updated ${shortDate(s.updatedAt)}`, { size: 11, fill: t.muted });
  const kx = hx + weeks.length * step - 3 - 34 - 5 * step;
  body += text(kx - 6, ky + 10, 'Less', { size: 11, fill: t.muted, anchor: 'end' });
  t.heat.forEach((c, i) => { body += `<rect x="${kx + i * step}" y="${ky}" width="${cell}" height="${cell}" rx="2" fill="${c}"/>`; });
  body += text(kx + 5 * step + 3, ky + 10, 'More', { size: 11, fill: t.muted });
  body += hline(t, 0, W, 258);

  // languages, in the colours GitHub uses for them
  const ly = 258;
  const total = s.languages.reduce((a, l) => a + l.count, 0) || 1;
  const bw = W - 48;
  body += `<clipPath id="bar"><rect x="24" y="${ly + 22}" width="${bw}" height="8" rx="4"/></clipPath><g clip-path="url(#bar)">`;
  let bx = 24, lx = 24, legend = '';
  s.languages.forEach((l, i) => {
    const color = LANG_COLORS[l.name] || t.neutral;
    const seg = (bw * l.count) / total;
    const gap = i < s.languages.length - 1 ? 2 : 0;
    body += `<rect x="${bx.toFixed(1)}" y="${ly + 22}" width="${Math.max(0, seg - gap).toFixed(1)}" height="8" fill="${color}"/>`;
    bx += seg;
    const pct = `${Math.round((l.count / total) * 100)}%`;
    legend += `<circle cx="${lx + 4}" cy="${ly + 50}" r="4" fill="${color}"/>`;
    legend += `<text x="${lx + 14}" y="${ly + 54}" font-size="12" fill="${t.text}">${esc(l.name)} <tspan fill="${t.muted}">${pct}</tspan></text>`;
    lx += 14 + Math.round(textW(`${l.name} ${pct}`, 12)) + 20;
  });
  body += '</g>' + legend;
  return svg(W, H, body, `GitHub activity: ${s.contributions} contributions in the last year, ${s.publicRepos} public repositories, ${s.stars} stars. Languages: ${s.languages.map((l) => `${l.name} ${Math.round((l.count / total) * 100)}%`).join(', ')}`);
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
    PROJECTS.forEach((pr) => out(`card-${pr.id}.svg`, card(t, pr)));
    out('stack.svg', stack(t, theme));
    out('ship-console.svg', shipConsole(t, ship));
    for (const [k, v] of Object.entries(SHIP_TYPES)) out(`btn-${k}.svg`, button(t, v.label, v.sub, k === 'friday-deploy'));
    out('activity.svg', activity(t, stats));
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
